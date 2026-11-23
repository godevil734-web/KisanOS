/**
 * Historical Agmarknet & Mandi Data Ingestion Service
 * 
 * Ingests, normalizes, validates, and archives authentic government agricultural
 * market observations into `mandi_historical_observations`.
 * 
 * Strict Compliance:
 * - NO mock, interpolated, or fabricated data.
 * - Missing values remain NULL (no default variety or grade substitution).
 * - Original raw government payload and arrival units are preserved.
 * - Idempotent insertion using 6-dimension unique index:
 *   (state, district, market, commodity, variety, observation_date) NULLS NOT DISTINCT
 * - Deterministic SHA-256 ID generation matching the 6-dimension unique constraint.
 * - Dual Ingestion: Live data.gov.in REST API + Official Agmarknet CSV streaming parser.
 */

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const readline = require('readline');
const { Readable } = require('stream');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { pool } = require('../db');

const DATA_GOV_RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
const DEFAULT_SOURCE_TAG = `data.gov.in:agmarknet-bulletin:${DATA_GOV_RESOURCE_ID}`;

/**
 * Retrieve data.gov.in API key from environment
 */
function getApiKey() {
  const envVars = [
    'DATA_GOV_API_KEY',
    'DATA_GOV_IN_API_KEY',
    'DATAGOV_API_KEY',
    'DATA_GOV_KEY',
    'DATAGOV_KEY',
    'DATA_GOVERNMENT_API_KEY',
    'GOV_API_KEY',
    'MANDI_API_KEY'
  ];
  for (const v of envVars) {
    const val = process.env[v];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim().replace(/^["']|["']$/g, '').trim();
    }
  }
  return '';
}

/**
 * Normalize and parse observation date into ISO YYYY-MM-DD
 * Handles:
 * - DD/MM/YYYY (e.g. 07/11/2026)
 * - YYYY-MM-DD
 * - ISO string
 */
function parseObservationDate(rawDate) {
  if (!rawDate) return null;
  const s = String(rawDate).trim();
  
  // DD/MM/YYYY
  const parts = s.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    if (day.length === 2 && month.length === 2 && year.length === 4) {
      return `${year}-${month}-${day}`;
    }
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // Date object or ISO
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Clean string value, returning null if empty or sentinel 'NA'/'None'.
 * Sanitizes embedded line breaks and excess internal whitespace.
 */
function cleanNullableString(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
  if (s === '' || s.toLowerCase() === 'na' || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'none') {
    return null;
  }
  return s;
}

/**
 * Clean and parse positive number
 */
function parsePositiveNumber(val) {
  if (val === null || val === undefined) return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '').trim());
  return isFinite(n) && n >= 0 ? n : null;
}

/**
 * Compute arrival quantity in tonnes if and only if original unit is reliable.
 * Never guess or infer units when absent.
 */
function computeArrivalTonnes(rawValue, rawUnit) {
  if (rawValue === null || rawValue === undefined || rawUnit === null || rawUnit === undefined) {
    return null;
  }
  const qty = parsePositiveNumber(rawValue);
  if (qty === null) return null;

  const unit = String(rawUnit).trim().toLowerCase();
  if (unit === 'tonnes' || unit === 'tonne' || unit === 'ton' || unit === 'mt') {
    return Number(qty.toFixed(2));
  }
  if (unit === 'quintals' || unit === 'quintal' || unit === 'qtl') {
    return Number((qty / 10).toFixed(2));
  }
  if (unit === 'kg' || unit === 'kilograms' || unit === 'kgs') {
    return Number((qty / 1000).toFixed(2));
  }

  // Unknown or unverified unit: do not convert
  return null;
}

/**
 * Deterministic SHA-256 hash generator matching the 6-dimension unique index:
 * (state, district, market, commodity, variety, observation_date) NULLS NOT DISTINCT
 */
function generateDeterministicObservationId({ state, district, market, commodity, variety, observation_date }) {
  const normState = String(state || '').trim().toLowerCase();
  const normDistrict = String(district || '').trim().toLowerCase();
  const normMarket = String(market || '').trim().toLowerCase();
  const normCommodity = String(commodity || '').trim().toLowerCase();
  const normVariety = variety && String(variety).trim() !== '' ? String(variety).trim().toLowerCase() : '__NULL__';
  const normDate = String(observation_date || '').trim();

  const keyString = `${normState}::${normDistrict}::${normMarket}::${normCommodity}::${normVariety}::${normDate}`;
  return crypto.createHash('sha256').update(keyString, 'utf8').digest('hex');
}

/**
 * Validate and normalize a raw market observation record.
 * Rejects records with missing mandatory fields or invalid prices.
 */
function validateObservationRecord(raw, defaultSource = DEFAULT_SOURCE_TAG) {
  const errors = [];

  // Support both snake_case (data.gov.in raw), camelCase (cached snapshot), and Agmarknet CSV headers
  const state = cleanNullableString(raw.state || raw.State || raw.state_name || raw.State_Name);
  const district = cleanNullableString(raw.district || raw.District || raw.district_name || raw.District_Name);
  const market = cleanNullableString(raw.market || raw.Market || raw.market_name || raw.Market_Name || raw.mandi);
  const commodity = cleanNullableString(raw.commodity || raw.Commodity || raw.commodity_name || raw.Commodity_Name || raw.crop);
  const variety = cleanNullableString(raw.variety || raw.Variety || raw.variety_name || raw.Variety_Name);
  const grade = cleanNullableString(raw.grade || raw.Grade || raw.grade_name || raw.Grade_Name);

  const rawDate = raw.arrival_date || raw.arrivalDate || raw.Arrival_Date || raw.observation_date || raw.report_date || raw.date;
  const observation_date = parseObservationDate(rawDate);

  const modalPrice = parsePositiveNumber(raw.modal_price ?? raw.modalPrice ?? raw.Modal_Price ?? raw.modalprice ?? raw.modal_price_rs_qtl);
  const minPrice = parsePositiveNumber(raw.min_price ?? raw.minPrice ?? raw.Min_Price ?? raw.minprice ?? raw.min_price_rs_qtl);
  const maxPrice = parsePositiveNumber(raw.max_price ?? raw.maxPrice ?? raw.Max_Price ?? raw.maxprice ?? raw.max_price_rs_qtl);

  const rawArrivals = raw.arrivals ?? raw.arrival ?? raw.Arrivals ?? raw.raw_arrivals_value ?? raw.quantity;
  const rawArrivalsValue = rawArrivals !== undefined && rawArrivals !== null ? String(rawArrivals).trim() : null;
  const rawArrivalsUnit = cleanNullableString(raw.arrivalsUnit ?? raw.arrival_unit ?? raw.unit ?? raw.Unit ?? raw.raw_arrivals_unit);

  if (!state) errors.push('Missing state');
  if (!district) errors.push('Missing district');
  if (!market) errors.push('Missing market');
  if (!commodity) errors.push('Missing commodity');
  if (!observation_date) errors.push(`Invalid observation date: ${rawDate}`);
  if (modalPrice === null || modalPrice <= 0) errors.push(`Invalid modal price: ${raw.modal_price ?? raw.modalPrice ?? raw.modalprice}`);

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      normalized: null,
      raw
    };
  }

  // Calculate modal price per kg strictly from modal price per quintal (1 quintal = 100 kg)
  const modalPricePerKg = Number((modalPrice / 100).toFixed(2));
  const arrivalTonnes = computeArrivalTonnes(rawArrivalsValue, rawArrivalsUnit);

  const normalized = {
    state,
    district,
    market,
    commodity,
    variety, // remains null if missing
    grade,   // remains null if missing
    observation_date,
    min_price_per_quintal: minPrice,
    max_price_per_quintal: maxPrice,
    modal_price_per_quintal: modalPrice,
    modal_price_per_kg: modalPricePerKg,
    raw_arrivals_value: rawArrivalsValue,
    raw_arrivals_unit: rawArrivalsUnit,
    arrival_quantity_tonnes: arrivalTonnes,
    source: raw.source ? String(raw.source).trim() : defaultSource,
    raw_payload: raw
  };

  normalized.id = generateDeterministicObservationId(normalized);

  return {
    valid: true,
    errors: [],
    normalized,
    raw
  };
}

/**
 * Idempotently insert a single normalized observation into PostgreSQL.
 * Uses ON CONFLICT DO NOTHING against unique index.
 */
async function insertObservation(clientOrPool, normalized) {
  const query = `
    INSERT INTO mandi_historical_observations (
      id,
      state,
      district,
      market,
      commodity,
      variety,
      grade,
      observation_date,
      min_price_per_quintal,
      max_price_per_quintal,
      modal_price_per_quintal,
      modal_price_per_kg,
      raw_arrivals_value,
      raw_arrivals_unit,
      arrival_quantity_tonnes,
      source,
      raw_payload,
      fetched_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
    ON CONFLICT (state, district, market, commodity, variety, observation_date)
    DO NOTHING
    RETURNING id;
  `;

  const values = [
    normalized.id,
    normalized.state,
    normalized.district,
    normalized.market,
    normalized.commodity,
    normalized.variety,
    normalized.grade,
    normalized.observation_date,
    normalized.min_price_per_quintal,
    normalized.max_price_per_quintal,
    normalized.modal_price_per_quintal,
    normalized.modal_price_per_kg,
    normalized.raw_arrivals_value,
    normalized.raw_arrivals_unit,
    normalized.arrival_quantity_tonnes,
    normalized.source,
    JSON.stringify(normalized.raw_payload)
  ];

  const res = await clientOrPool.query(query, values);
  if (res.rows && res.rows.length > 0) {
    return { status: 'IMPORTED', id: res.rows[0].id };
  }
  return { status: 'DUPLICATE', id: normalized.id };
}

/**
 * High-performance multi-row chunk insertion with atomic deduplication.
 * Inserts up to 100-200 records in a single query.
 */
async function insertChunkObservations(clientOrPool, normalizedBatch) {
  if (!normalizedBatch || normalizedBatch.length === 0) {
    return { imported: 0, duplicates: 0 };
  }

  const columnsPerRow = 17;
  const valueClauses = [];
  const params = [];

  normalizedBatch.forEach((norm, rowIndex) => {
    const offset = rowIndex * columnsPerRow;
    const placeholders = [];
    for (let c = 1; c <= columnsPerRow; c++) {
      placeholders.push(`$${offset + c}`);
    }
    valueClauses.push(`(${placeholders.join(', ')}, NOW())`);

    params.push(
      norm.id,
      norm.state,
      norm.district,
      norm.market,
      norm.commodity,
      norm.variety,
      norm.grade,
      norm.observation_date,
      norm.min_price_per_quintal,
      norm.max_price_per_quintal,
      norm.modal_price_per_quintal,
      norm.modal_price_per_kg,
      norm.raw_arrivals_value,
      norm.raw_arrivals_unit,
      norm.arrival_quantity_tonnes,
      norm.source,
      JSON.stringify(norm.raw_payload)
    );
  });

  const sql = `
    INSERT INTO mandi_historical_observations (
      id, state, district, market, commodity, variety, grade, observation_date,
      min_price_per_quintal, max_price_per_quintal, modal_price_per_quintal, modal_price_per_kg,
      raw_arrivals_value, raw_arrivals_unit, arrival_quantity_tonnes, source, raw_payload, fetched_at
    ) VALUES ${valueClauses.join(', ')}
    ON CONFLICT (state, district, market, commodity, variety, observation_date)
    DO NOTHING
    RETURNING id;
  `;

  const res = await clientOrPool.query(sql, params);
  const importedCount = res.rows ? res.rows.length : 0;
  const duplicateCount = normalizedBatch.length - importedCount;

  return {
    imported: importedCount,
    duplicates: duplicateCount
  };
}

/**
 * Ingest an array of raw records with validation and chunked atomic insertion.
 */
async function ingestBatchObservations(clientOrPool, rawRecords, defaultSource = DEFAULT_SOURCE_TAG, chunkSize = 100) {
  const stats = {
    totalProcessed: 0,
    imported: 0,
    duplicates: 0,
    rejected: 0,
    failures: [],
    observationDates: {},
    stateCoverage: {},
    districtCoverage: {},
    mandiCoverage: {},
    commodityCoverage: {}
  };

  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    return stats;
  }

  const validNormalized = [];

  for (const raw of rawRecords) {
    stats.totalProcessed++;
    const validation = validateObservationRecord(raw, defaultSource);

    if (!validation.valid) {
      stats.rejected++;
      stats.failures.push({
        errors: validation.errors,
        record: raw
      });
      continue;
    }

    const { normalized } = validation;
    validNormalized.push(normalized);

    // Track metadata
    stats.observationDates[normalized.observation_date] = (stats.observationDates[normalized.observation_date] || 0) + 1;
    stats.stateCoverage[normalized.state] = (stats.stateCoverage[normalized.state] || 0) + 1;
    stats.districtCoverage[normalized.district] = (stats.districtCoverage[normalized.district] || 0) + 1;
    stats.mandiCoverage[normalized.market] = (stats.mandiCoverage[normalized.market] || 0) + 1;
    stats.commodityCoverage[normalized.commodity] = (stats.commodityCoverage[normalized.commodity] || 0) + 1;
  }

  // Execute multi-row inserts in chunks
  for (let i = 0; i < validNormalized.length; i += chunkSize) {
    const chunk = validNormalized.slice(i, i + chunkSize);
    const chunkRes = await insertChunkObservations(clientOrPool, chunk);
    stats.imported += chunkRes.imported;
    stats.duplicates += chunkRes.duplicates;
  }

  return stats;
}

/**
 * Detect whether a CSV text buffer has an unclosed / unbalanced quotation mark.
 * Properly accounts for escaped double-quotes ("") according to RFC 4180.
 */
function isQuoteUnbalanced(text) {
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i++; // skip escaped quote ("")
      } else {
        inQuotes = !inQuotes;
      }
    }
  }
  return inQuotes;
}

/**
 * Parse a single CSV line with quote escaping
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Streaming parser & ingestion adapter for official Agmarknet CSV archives.
 * Supports file paths, raw CSV strings, or Node.js Readable streams.
 * Correctly handles multiline quoted fields without breaking streaming memory efficiency.
 * Supports optional clientOrPool for transaction-isolated test runs.
 */
async function ingestAgmarknetCSV(csvSource, { defaultSource = 'agmarknet:csv-export', chunkSize = 200, clientOrPool = pool } = {}) {
  let stream;
  if (typeof csvSource === 'string') {
    if (fs.existsSync(csvSource)) {
      stream = fs.createReadStream(csvSource, { encoding: 'utf8' });
    } else {
      stream = Readable.from([csvSource]);
    }
  } else if (csvSource && typeof csvSource.pipe === 'function') {
    stream = csvSource;
  } else {
    throw new Error('Invalid CSV source: must be a valid file path, CSV string, or Readable stream');
  }

  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  let headers = null;
  let batch = [];
  const overallStats = {
    source: defaultSource,
    totalRows: 0,
    totalProcessed: 0,
    imported: 0,
    duplicates: 0,
    rejected: 0,
    failures: [],
    observationDates: {},
    stateCoverage: {},
    districtCoverage: {},
    mandiCoverage: {},
    commodityCoverage: {}
  };

  let multilineBuffer = '';

  for await (const rawLine of rl) {
    const cleanLine = rawLine.replace(/\r$/, '');
    if (!multilineBuffer && cleanLine.trim() === '') continue;

    if (multilineBuffer) {
      multilineBuffer += '\n' + cleanLine;
    } else {
      multilineBuffer = cleanLine;
    }

    // If quotation marks are unbalanced, wait for subsequent line(s) to close the field
    if (isQuoteUnbalanced(multilineBuffer)) {
      continue;
    }

    const completeLine = multilineBuffer;
    multilineBuffer = '';

    const cols = parseCSVLine(completeLine);
    if (!headers) {
      // Normalize header names: lowercase, replace spaces/dashes with underscores
      headers = cols.map(h => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
      continue;
    }

    overallStats.totalRows++;
    const rowObj = {};
    for (let i = 0; i < headers.length; i++) {
      rowObj[headers[i]] = cols[i] !== undefined ? cols[i].trim() : null;
    }

    batch.push(rowObj);
    if (batch.length >= chunkSize) {
      const batchStats = await ingestBatchObservations(clientOrPool, batch, defaultSource, chunkSize);
      accumulateStats(overallStats, batchStats);
      batch = [];
    }
  }

  // Handle trailing unclosed buffer if file ended without trailing newline
  if (multilineBuffer.trim() && headers) {
    const cols = parseCSVLine(multilineBuffer);
    overallStats.totalRows++;
    const rowObj = {};
    for (let i = 0; i < headers.length; i++) {
      rowObj[headers[i]] = cols[i] !== undefined ? cols[i].trim() : null;
    }
    batch.push(rowObj);
  }

  if (batch.length > 0) {
    const batchStats = await ingestBatchObservations(clientOrPool, batch, defaultSource, chunkSize);
    accumulateStats(overallStats, batchStats);
  }

  return overallStats;
}

/**
 * Helper to accumulate batch stats into overall stats
 */
function accumulateStats(overall, batch) {
  overall.totalProcessed += batch.totalProcessed;
  overall.imported += batch.imported;
  overall.duplicates += batch.duplicates;
  overall.rejected += batch.rejected;
  if (batch.failures && batch.failures.length > 0) {
    overall.failures.push(...batch.failures);
  }

  for (const [date, count] of Object.entries(batch.observationDates || {})) {
    overall.observationDates[date] = (overall.observationDates[date] || 0) + count;
  }
  for (const [state, count] of Object.entries(batch.stateCoverage || {})) {
    overall.stateCoverage[state] = (overall.stateCoverage[state] || 0) + count;
  }
  for (const [dist, count] of Object.entries(batch.districtCoverage || {})) {
    overall.districtCoverage[dist] = (overall.districtCoverage[dist] || 0) + count;
  }
  for (const [mandi, count] of Object.entries(batch.mandiCoverage || {})) {
    overall.mandiCoverage[mandi] = (overall.mandiCoverage[mandi] || 0) + count;
  }
  for (const [crop, count] of Object.entries(batch.commodityCoverage || {})) {
    overall.commodityCoverage[crop] = (overall.commodityCoverage[crop] || 0) + count;
  }
}

/**
 * Fetch a page from the official data.gov.in API with retries and exponential backoff.
 */
function fetchGovPage({ apiKey, state, commodity, limit = 100, offset = 0, timeoutMs = 15000 }) {
  return new Promise((resolve, reject) => {
    let url = `https://api.data.gov.in/resource/${DATA_GOV_RESOURCE_ID}?api-key=${encodeURIComponent(apiKey)}&format=json&limit=${limit}&offset=${offset}`;
    if (state) url += `&filters%5Bstate%5D=${encodeURIComponent(state)}`;
    if (commodity) url += `&filters%5Bcommodity%5D=${encodeURIComponent(commodity)}`;

    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 429) {
          return reject(new Error('HTTP 429: Rate limit exceeded'));
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse JSON response: ${e.message}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Ingest live government feed with pagination, retries, and duplicate protection.
 */
async function ingestLiveGovFeed({ state = 'Uttar Pradesh', commodity = 'Potato', limit = 100, maxPages = 5, retries = 3 } = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('data.gov.in API key is not configured in environment variables');
  }

  const overallStats = {
    source: DEFAULT_SOURCE_TAG,
    state,
    commodity,
    pagesFetched: 0,
    totalReportedByGov: 0,
    totalProcessed: 0,
    imported: 0,
    duplicates: 0,
    rejected: 0,
    failures: [],
    observationDates: {},
    stateCoverage: {},
    districtCoverage: {},
    mandiCoverage: {},
    commodityCoverage: {}
  };

  let offset = 0;
  for (let page = 0; page < maxPages; page++) {
    let attempt = 0;
    let pageData = null;

    while (attempt <= retries) {
      try {
        pageData = await fetchGovPage({ apiKey, state, commodity, limit, offset });
        break;
      } catch (err) {
        attempt++;
        if (attempt > retries) {
          throw new Error(`Failed to fetch page at offset ${offset} after ${retries} attempts: ${err.message}`);
        }
        const backoffMs = Math.pow(2, attempt) * 500;
        await new Promise(r => setTimeout(r, backoffMs));
      }
    }

    if (!pageData || !Array.isArray(pageData.records)) {
      break;
    }

    overallStats.pagesFetched++;
    overallStats.totalReportedByGov = pageData.total || pageData.records.length;

    const pageStats = await ingestBatchObservations(pool, pageData.records, DEFAULT_SOURCE_TAG);
    accumulateStats(overallStats, pageStats);

    offset += limit;
    if (offset >= overallStats.totalReportedByGov || pageData.records.length < limit) {
      break;
    }
  }

  return overallStats;
}

/**
 * Backfill authentic observations from existing mandi_price_snapshots into mandi_historical_observations.
 * Strictly validates every snapshot entry. Supports national multi-state backfill when state/commodity are null.
 */
async function backfillFromSnapshots({ state = null, commodity = null, chunkSize = 150 } = {}) {
  const query = `
    SELECT 
      cache_key,
      state,
      district,
      commodity,
      source,
      report_date,
      data
    FROM mandi_price_snapshots
    WHERE ($1::text IS NULL OR state ILIKE $1)
      AND ($2::text IS NULL OR commodity ILIKE $2 OR cache_key ILIKE '%' || $2 || '%');
  `;

  const snapshots = await pool.query(query, [state, commodity]);

  const overallStats = {
    source: 'mandi_price_snapshots:verified_backfill',
    snapshotsExamined: snapshots.rows.length,
    totalProcessed: 0,
    imported: 0,
    duplicates: 0,
    rejected: 0,
    failures: [],
    observationDates: {},
    stateCoverage: {},
    districtCoverage: {},
    mandiCoverage: {},
    commodityCoverage: {}
  };

  let accumulatedRecords = [];

  for (const snapshot of snapshots.rows) {
    const rawData = snapshot.data;
    if (!rawData || !Array.isArray(rawData.records)) continue;

    for (const rec of rawData.records) {
      if (commodity && rec.commodity && !rec.commodity.toLowerCase().includes(commodity.toLowerCase())) {
        continue;
      }
      accumulatedRecords.push({
        ...rec,
        source: snapshot.source || 'mandi_price_snapshots:historical'
      });
    }

    // Flush chunk when accumulated size exceeds 300
    if (accumulatedRecords.length >= 300) {
      const batchStats = await ingestBatchObservations(pool, accumulatedRecords, 'mandi_price_snapshots:historical', chunkSize);
      accumulateStats(overallStats, batchStats);
      accumulatedRecords = [];
    }
  }

  if (accumulatedRecords.length > 0) {
    const batchStats = await ingestBatchObservations(pool, accumulatedRecords, 'mandi_price_snapshots:historical', chunkSize);
    accumulateStats(overallStats, batchStats);
  }

  return overallStats;
}

/**
 * Backfill all 8,989 national snapshot entries across all 17 states and 210 commodities.
 */
async function backfillAllNationalSnapshots(options = {}) {
  return backfillFromSnapshots({ state: null, commodity: null, ...options });
}

/**
 * Get aggregated summary statistics of historical observations stored in database.
 * Strictly excludes synthetic test fixtures by default (excludeTest = true).
 */
async function getHistoricalStats({ state, commodity, excludeTest = true } = {}, clientOrPool = pool) {
  const whereClauses = [];
  const params = [];

  if (excludeTest) {
    whereClauses.push(`source NOT ILIKE 'test%'`);
  }
  if (state) {
    params.push(state);
    whereClauses.push(`state ILIKE $${params.length}`);
  }
  if (commodity) {
    params.push(commodity);
    whereClauses.push(`commodity ILIKE $${params.length}`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const totalRes = await clientOrPool.query(
    `SELECT COUNT(*)::int as total_count FROM mandi_historical_observations ${whereSql}`,
    params
  );

  const datesRes = await clientOrPool.query(
    `SELECT observation_date::text, COUNT(*)::int as record_count 
     FROM mandi_historical_observations ${whereSql}
     GROUP BY observation_date 
     ORDER BY observation_date ASC`,
    params
  );

  const statesRes = await clientOrPool.query(
    `SELECT state, COUNT(*)::int as count 
     FROM mandi_historical_observations ${whereSql}
     GROUP BY state 
     ORDER BY count DESC`,
    params
  );

  const commoditiesCountRes = await clientOrPool.query(
    `SELECT COUNT(DISTINCT commodity)::int as distinct_count FROM mandi_historical_observations ${whereSql}`,
    params
  );

  const commoditiesRes = await clientOrPool.query(
    `SELECT commodity, COUNT(*)::int as count 
     FROM mandi_historical_observations ${whereSql}
     GROUP BY commodity 
     ORDER BY count DESC
     LIMIT 25`,
    params
  );

  const districtsRes = await clientOrPool.query(
    `SELECT district, COUNT(*)::int as count 
     FROM mandi_historical_observations ${whereSql}
     GROUP BY district 
     ORDER BY count DESC`,
    params
  );

  const mandisRes = await clientOrPool.query(
    `SELECT market, district, COUNT(*)::int as count 
     FROM mandi_historical_observations ${whereSql}
     GROUP BY market, district 
     ORDER BY count DESC`,
    params
  );

  const priceStats = await clientOrPool.query(
    `SELECT 
       MIN(modal_price_per_quintal) as min_modal_quintal,
       MAX(modal_price_per_quintal) as max_modal_quintal,
       ROUND(AVG(modal_price_per_quintal), 2) as avg_modal_quintal,
       MIN(modal_price_per_kg) as min_modal_kg,
       MAX(modal_price_per_kg) as max_modal_kg,
       ROUND(AVG(modal_price_per_kg), 2) as avg_modal_kg
     FROM mandi_historical_observations ${whereSql}`,
    params
  );

  return {
    totalRecords: totalRes.rows[0]?.total_count || 0,
    observationDates: datesRes.rows,
    distinctStatesCount: statesRes.rows.length,
    states: statesRes.rows,
    distinctCommoditiesCount: commoditiesCountRes.rows[0]?.distinct_count || 0,
    topCommodities: commoditiesRes.rows,
    distinctDistrictsCount: districtsRes.rows.length,
    districts: districtsRes.rows,
    distinctMandisCount: mandisRes.rows.length,
    mandis: mandisRes.rows,
    priceSummary: priceStats.rows[0] || null
  };
}

/**
 * Extract verified historical observations for ML model dataset preparation.
 * Enforces production data hygiene rules:
 * - Excludes all test fixtures (source NOT LIKE 'test%') by default
 * - Requires positive modal price
 * - Preserves complete source provenance and audit metadata
 */
async function fetchMLDatasetObservations({
  state,
  district,
  market,
  commodity,
  startDate,
  endDate,
  excludeTest = true,
  limit,
  clientOrPool = pool
} = {}) {
  const whereClauses = ['modal_price_per_quintal > 0'];
  const params = [];

  if (excludeTest) {
    whereClauses.push(`source NOT ILIKE 'test%'`);
  }
  if (state) {
    params.push(state);
    whereClauses.push(`state ILIKE $${params.length}`);
  }
  if (district) {
    params.push(district);
    whereClauses.push(`district ILIKE $${params.length}`);
  }
  if (market) {
    params.push(market);
    whereClauses.push(`market ILIKE $${params.length}`);
  }
  if (commodity) {
    params.push(commodity);
    whereClauses.push(`commodity ILIKE $${params.length}`);
  }
  if (startDate) {
    params.push(startDate);
    whereClauses.push(`observation_date >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    whereClauses.push(`observation_date <= $${params.length}`);
  }

  let limitClause = '';
  if (limit && Number(limit) > 0) {
    params.push(Number(limit));
    limitClause = `LIMIT $${params.length}`;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const query = `
    SELECT id, state, district, market, commodity, variety, grade,
           observation_date::text, min_price_per_quintal, max_price_per_quintal,
           modal_price_per_quintal, modal_price_per_kg,
           raw_arrivals_value, raw_arrivals_unit, arrival_quantity_tonnes,
           source, fetched_at, created_at
    FROM mandi_historical_observations
    ${whereSql}
    ORDER BY observation_date ASC, market ASC, commodity ASC
    ${limitClause};
  `;

  const res = await clientOrPool.query(query, params);
  return res.rows;
}

module.exports = {
  validateObservationRecord,
  generateDeterministicObservationId,
  computeArrivalTonnes,
  parseObservationDate,
  isQuoteUnbalanced,
  parseCSVLine,
  insertObservation,
  insertChunkObservations,
  ingestBatchObservations,
  ingestAgmarknetCSV,
  fetchGovPage,
  ingestLiveGovFeed,
  backfillFromSnapshots,
  backfillAllNationalSnapshots,
  getHistoricalStats,
  fetchMLDatasetObservations,
  DATA_GOV_RESOURCE_ID,
  DEFAULT_SOURCE_TAG
};
