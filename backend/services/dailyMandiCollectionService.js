/**
 * KisanOS Daily Mandi Collection Engine (Milestone F.1.1 — Hardened)
 * 
 * Continuously harvests official daily wholesale market prices from data.gov.in
 * (DMI Agmarknet Bulletin: Resource 9ef84268-d588-465a-a308-a864a43d0070).
 * 
 * Reuses:
 * - historicalIngestionService.js (RFC 4180 streaming parser, validation, deterministic SHA-256 IDs)
 * - mandiService.js (API key detection & diagnostics)
 * - mandi_historical_observations table (19 columns, 6-dimension unique constraint)
 * 
 * Safeguards Enforced:
 * 1. Conditional upsert comparing 8 business fields + genuine provenance (source, ogd_updated_date)
 * 2. Strict exclusion of volatile ingestion metadata (fetched_at, created_at, harvest_batch_id, batch_lineage)
 * 3. Complete previous raw_payload & source preservation on every update (previous_state.previous_raw_payload)
 * 4. Immutable origin tracking (inserted_by_batch_id never overwritten by later updates)
 * 5. Overlapping-batch safe surgical rollback (only affects rows where target batch holds latest state)
 * 6. Idempotent repeated rollbacks
 * 7. Strict preservation of genuine publication timestamp (never fabricated)
 * 8. Preservation of missing arrivals as NULL
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const readline = require('readline');
const https = require('https');
const { Readable } = require('stream');
const {
  validateObservationRecord,
  isQuoteUnbalanced,
  parseCSVLine,
  DATA_GOV_RESOURCE_ID
} = require('./historicalIngestionService');
const {
  getDayScheduleType,
  validateBulletinSixGates
} = require('./bulletinValidationService');
const {
  AUDIT_LIFECYCLE_STATES,
  createBatchTelemetryRecord,
  InMemoryAuditStore
} = require('./auditTelemetryStore');

// API Key resolution helper with diagnostics
function resolveDataGovApiKey() {
  const envVars = [
    'DATA_GOV_API_KEY',
    'DATA_GOV_IN_API_KEY',
    'DATAGOV_API_KEY',
    'DATA_GOV_KEY',
    'DATAGOV_KEY',
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
 * Generate a deterministic, human-readable collection batch identifier:
 * harvest_YYYYMMDD_HHmmss_[window]
 */
function generateHarvestBatchId(windowName = 'w_manual', date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  const cleanWindow = String(windowName).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `harvest_${yyyy}${mm}${dd}_${hh}${min}${ss}_${cleanWindow}`;
}

/**
 * Fetch bulletin metadata from data.gov.in using limit=1 JSON request.
 * Extracts genuine OGD updated_date and total record count.
 * Never fabricates missing publication dates.
 */
async function fetchBulletinMetadata({
  apiKey = resolveDataGovApiKey(),
  resourceId = DATA_GOV_RESOURCE_ID,
  timeoutMs = 15000,
  fetchFn = null
} = {}) {
  const url = `https://api.data.gov.in/resource/${resourceId}?api-key=${encodeURIComponent(apiKey)}&format=json&limit=1`;

  if (fetchFn) {
    const res = await fetchFn(url, { timeout: timeoutMs });
    const data = typeof res.json === 'function' ? await res.json() : res;
    return extractMetadataFromPayload(data);
  }

  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode === 429) {
          return reject(new Error('HTTP 429: Rate limit exceeded on metadata probe'));
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: Failed to fetch bulletin metadata`));
        }
        try {
          const parsed = JSON.parse(body);
          resolve(extractMetadataFromPayload(parsed));
        } catch (e) {
          reject(new Error(`Failed to parse OGD metadata JSON: ${e.message}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Bulletin metadata probe timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => reject(err));
  });
}

/**
 * Normalize and extract genuine publication metadata.
 * If OGD does not supply updated_date, returns null (never fabricates).
 */
function extractMetadataFromPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ogdUpdatedDate: null, totalRecords: 0, sampleRecord: null };
  }

  let ogdUpdatedDate = null;
  if (payload.updated_date && typeof payload.updated_date === 'string' && payload.updated_date.trim() !== '') {
    const d = new Date(payload.updated_date);
    if (!isNaN(d.getTime())) {
      ogdUpdatedDate = d.toISOString();
    }
  } else if (payload.updated && typeof payload.updated === 'number') {
    const d = new Date(payload.updated * 1000);
    if (!isNaN(d.getTime())) {
      ogdUpdatedDate = d.toISOString();
    }
  }

  const totalRecords = typeof payload.total === 'number' ? payload.total : parseInt(payload.total, 10) || 0;
  const sampleRecord = Array.isArray(payload.records) && payload.records.length > 0 ? payload.records[0] : null;

  return {
    ogdUpdatedDate,
    totalRecords,
    sampleRecord
  };
}

/**
 * Normalizes CSV column headers handling standard tokens, spaces, and XML-escaped spaces (_x0020_).
 */
function normalizeCsvHeaders(headers) {
  return headers.map((h) => {
    return h
      .trim()
      .replace(/_x0020_/gi, '_')
      .replace(/[\s-]+/g, '_')
      .toLowerCase();
  });
}

/**
 * Parse an incoming CSV stream with RFC 4180 multiline handling, header normalization,
 * record validation, and batch metadata tagging.
 */
async function parseAndValidateBulletinStream(csvSource, {
  batchId,
  ogdUpdatedDate = null,
  sourceTag = `ogd:agmarknet-daily:${DATA_GOV_RESOURCE_ID}`
} = {}) {
  let stream;
  if (typeof csvSource === 'string') {
    stream = Readable.from([csvSource]);
  } else if (csvSource && typeof csvSource.pipe === 'function') {
    stream = csvSource;
  } else {
    throw new Error('Invalid CSV source: expected Readable stream or CSV string');
  }

  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  let rawHeaders = null;
  let normalizedHeaders = null;
  const validRecords = [];
  const rejectedRecords = [];
  let totalRows = 0;
  let multilineBuffer = '';

  for await (const rawLine of rl) {
    const cleanLine = rawLine.replace(/\r$/, '');
    if (!multilineBuffer && cleanLine.trim() === '') continue;

    if (multilineBuffer) {
      multilineBuffer += '\n' + cleanLine;
    } else {
      multilineBuffer = cleanLine;
    }

    if (isQuoteUnbalanced(multilineBuffer)) {
      continue;
    }

    const completeLine = multilineBuffer;
    multilineBuffer = '';

    const cols = parseCSVLine(completeLine);
    if (!rawHeaders) {
      rawHeaders = cols;
      normalizedHeaders = normalizeCsvHeaders(cols);
      continue;
    }

    totalRows++;
    const rowObj = {};
    for (let i = 0; i < normalizedHeaders.length; i++) {
      rowObj[normalizedHeaders[i]] = cols[i] !== undefined ? cols[i].trim() : null;
    }

    rowObj.source = sourceTag;
    const validation = validateObservationRecord(rowObj, sourceTag);

    if (!validation.valid) {
      rejectedRecords.push({
        row: totalRows,
        record: rowObj,
        errors: validation.errors
      });
      continue;
    }

    const norm = validation.normalized;
    // Enrich raw_payload with batch auditing & provenance metadata
    norm.raw_payload = {
      ...norm.raw_payload,
      harvest_batch_id: batchId,
      inserted_by_batch_id: batchId,
      batch_lineage: [batchId],
      ogd_updated_date: ogdUpdatedDate
    };

    validRecords.push(norm);
  }

  return {
    totalRows,
    validRecords,
    rejectedRecords
  };
}

/**
 * Execute chunked conditional upsert against mandi_historical_observations.
 * 
 * Change Detection Condition (WHERE ... IS DISTINCT FROM):
 * - Compares 8 business fields (prices, arrivals, grade)
 * - Compares genuine provenance (source column, ogd_updated_date)
 * - Strictly EXCLUDES volatile ingestion metadata (fetched_at, created_at, harvest_batch_id, batch_lineage)
 * 
 * Update Behavior:
 * - Preserves original inserted_by_batch_id verbatim
 * - Appends current batchId to batch_lineage
 * - Saves COMPLETE pre-update row & raw_payload inside raw_payload->'previous_state'
 */
async function upsertObservationsChunk(clientOrPool, chunk, batchId) {
  if (!chunk || chunk.length === 0) {
    return { imported: 0, updated: 0, skipped: 0 };
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const rec of chunk) {
    // Ensure initial insert payload always contains complete batch metadata
    const insertPayload = {
      ...(rec.raw_payload || {}),
      harvest_batch_id: batchId,
      inserted_by_batch_id: (rec.raw_payload && rec.raw_payload.inserted_by_batch_id) || batchId,
      batch_lineage: (rec.raw_payload && rec.raw_payload.batch_lineage) || [batchId],
      ogd_updated_date: rec.raw_payload && rec.raw_payload.ogd_updated_date !== undefined
        ? rec.raw_payload.ogd_updated_date
        : null
    };

    const query = `
      INSERT INTO mandi_historical_observations (
        id, state, district, market, commodity, variety, grade, observation_date,
        min_price_per_quintal, max_price_per_quintal, modal_price_per_quintal, modal_price_per_kg,
        raw_arrivals_value, raw_arrivals_unit, arrival_quantity_tonnes, source, raw_payload, fetched_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
      ON CONFLICT (state, district, market, commodity, variety, observation_date) DO UPDATE SET
        modal_price_per_quintal = EXCLUDED.modal_price_per_quintal,
        min_price_per_quintal = EXCLUDED.min_price_per_quintal,
        max_price_per_quintal = EXCLUDED.max_price_per_quintal,
        modal_price_per_kg = EXCLUDED.modal_price_per_kg,
        raw_arrivals_value = EXCLUDED.raw_arrivals_value,
        raw_arrivals_unit = EXCLUDED.raw_arrivals_unit,
        arrival_quantity_tonnes = EXCLUDED.arrival_quantity_tonnes,
        grade = EXCLUDED.grade,
        source = EXCLUDED.source,
        raw_payload = jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                EXCLUDED.raw_payload,
                '{inserted_by_batch_id}',
                COALESCE(mandi_historical_observations.raw_payload->'inserted_by_batch_id', 'null'::jsonb)
              ),
              '{updated_by_batch_id}',
              to_jsonb($18::text)
            ),
            '{batch_lineage}',
            COALESCE(mandi_historical_observations.raw_payload->'batch_lineage', '[]'::jsonb) || to_jsonb($18::text)
          ),
          '{previous_state}',
          jsonb_build_object(
            'modal_price_per_quintal', mandi_historical_observations.modal_price_per_quintal,
            'min_price_per_quintal', mandi_historical_observations.min_price_per_quintal,
            'max_price_per_quintal', mandi_historical_observations.max_price_per_quintal,
            'modal_price_per_kg', mandi_historical_observations.modal_price_per_kg,
            'raw_arrivals_value', mandi_historical_observations.raw_arrivals_value,
            'raw_arrivals_unit', mandi_historical_observations.raw_arrivals_unit,
            'arrival_quantity_tonnes', mandi_historical_observations.arrival_quantity_tonnes,
            'grade', mandi_historical_observations.grade,
            'source', mandi_historical_observations.source,
            'previous_fetched_at', mandi_historical_observations.fetched_at,
            'previous_raw_payload', mandi_historical_observations.raw_payload
          )
        ),
        fetched_at = NOW()
      WHERE
        -- 8 Business fields
        mandi_historical_observations.modal_price_per_quintal IS DISTINCT FROM EXCLUDED.modal_price_per_quintal
        OR mandi_historical_observations.min_price_per_quintal IS DISTINCT FROM EXCLUDED.min_price_per_quintal
        OR mandi_historical_observations.max_price_per_quintal IS DISTINCT FROM EXCLUDED.max_price_per_quintal
        OR mandi_historical_observations.modal_price_per_kg IS DISTINCT FROM EXCLUDED.modal_price_per_kg
        OR mandi_historical_observations.arrival_quantity_tonnes IS DISTINCT FROM EXCLUDED.arrival_quantity_tonnes
        OR mandi_historical_observations.raw_arrivals_value IS DISTINCT FROM EXCLUDED.raw_arrivals_value
        OR mandi_historical_observations.raw_arrivals_unit IS DISTINCT FROM EXCLUDED.raw_arrivals_unit
        OR mandi_historical_observations.grade IS DISTINCT FROM EXCLUDED.grade
        -- Genuine upstream provenance changes (strictly excluding volatile run IDs / fetched_at)
        OR mandi_historical_observations.source IS DISTINCT FROM EXCLUDED.source
        OR (mandi_historical_observations.raw_payload->>'ogd_updated_date') IS DISTINCT FROM (EXCLUDED.raw_payload->>'ogd_updated_date')
      RETURNING id, (xmax = 0) AS is_insert;
    `;

    const params = [
      rec.id,
      rec.state,
      rec.district,
      rec.market,
      rec.commodity,
      rec.variety,
      rec.grade,
      rec.observation_date,
      rec.min_price_per_quintal,
      rec.max_price_per_quintal,
      rec.modal_price_per_quintal,
      rec.modal_price_per_kg,
      rec.raw_arrivals_value,
      rec.raw_arrivals_unit,
      rec.arrival_quantity_tonnes,
      rec.source,
      JSON.stringify(insertPayload),
      batchId
    ];

    const res = await clientOrPool.query(query, params);
    if (res.rows && res.rows.length > 0) {
      if (res.rows[0].is_insert) {
        imported++;
      } else {
        updated++;
      }
    } else {
      skipped++;
    }
  }

  return { imported, updated, skipped };
}

/**
 * Execute complete collection batch against database.
 * Processes valid records in chunks and computes comprehensive summary metrics.
 */
async function executeCollectionBatch(clientOrPool, validRecords, batchId, { chunkSize = 100 } = {}) {
  const stats = {
    batchId,
    totalRecords: validRecords.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    distinctStates: new Set(),
    distinctMandis: new Set(),
    distinctCommodities: new Set(),
    distinctDates: new Set()
  };

  for (let i = 0; i < validRecords.length; i += chunkSize) {
    const chunk = validRecords.slice(i, i + chunkSize);
    const res = await upsertObservationsChunk(clientOrPool, chunk, batchId);
    stats.imported += res.imported;
    stats.updated += res.updated;
    stats.skipped += res.skipped;

    for (const r of chunk) {
      stats.distinctStates.add(r.state);
      stats.distinctMandis.add(r.market);
      stats.distinctCommodities.add(r.commodity);
      stats.distinctDates.add(r.observation_date);
    }
  }

  return {
    batchId: stats.batchId,
    totalRecords: stats.totalRecords,
    imported: stats.imported,
    updated: stats.updated,
    skipped: stats.skipped,
    stateCount: stats.distinctStates.size,
    mandiCount: stats.distinctMandis.size,
    commodityCount: stats.distinctCommodities.size,
    dateCount: stats.distinctDates.size
  };
}

/**
 * Overlapping-batch safe, transactional surgical rollback with safe transaction ownership.
 * 
 * Transaction Ownership Rules:
 * 1. Pool input (typeof clientOrPool.connect === 'function'):
 *    Acquires a dedicated connection, owns BEGIN / COMMIT / ROLLBACK, and releases in finally.
 * 2. Client input WITHOUT active caller transaction:
 *    Auto-detects via `SELECT txid_current_if_assigned() AS txid` (or `{ inCallerTransaction: false }`),
 *    then owns BEGIN / COMMIT / ROLLBACK cleanly.
 * 3. Client input INSIDE existing caller-owned transaction:
 *    Uses `SAVEPOINT sp_rollback_harvest_batch` / `RELEASE SAVEPOINT` (or `ROLLBACK TO SAVEPOINT` on error).
 *    NEVER commits or rolls back the caller's outer transaction!
 */
async function rollbackHarvestBatch(clientOrPool, batchId, { inCallerTransaction } = {}) {
  if (!batchId || typeof batchId !== 'string') {
    throw new Error('Valid batchId is required for surgical rollback');
  }

  const isPool = typeof clientOrPool.connect === 'function';
  const client = isPool ? await clientOrPool.connect() : clientOrPool;

  let ownsTransaction = true;
  let usesSavepoint = false;
  let transactionMode = 'POOL_OWNED_TX';
  const savepointName = 'sp_rollback_harvest_batch';

  try {
    if (!isPool) {
      if (inCallerTransaction === true) {
        ownsTransaction = false;
        usesSavepoint = true;
        transactionMode = 'CALLER_SAVEPOINT';
      } else if (inCallerTransaction === false) {
        ownsTransaction = true;
        usesSavepoint = false;
        transactionMode = 'CLIENT_OWNED_TX';
      } else {
        // Auto-detect whether the client is already inside an open PostgreSQL transaction
        const txProbe = await client.query('SELECT txid_current_if_assigned() AS txid;');
        const activeTxId = txProbe.rows && txProbe.rows[0] ? txProbe.rows[0].txid : null;
        if (activeTxId !== null && activeTxId !== undefined) {
          ownsTransaction = false;
          usesSavepoint = true;
          transactionMode = 'CALLER_SAVEPOINT';
        } else {
          ownsTransaction = true;
          usesSavepoint = false;
          transactionMode = 'CLIENT_OWNED_TX';
        }
      }
    }

    if (ownsTransaction) {
      await client.query('BEGIN');
    } else if (usesSavepoint) {
      await client.query(`SAVEPOINT ${savepointName}`);
    }

    // Lock candidate rows exclusively for concurrent safety
    const lockSql = `
      SELECT id
      FROM mandi_historical_observations
      WHERE raw_payload->>'inserted_by_batch_id' = $1
         OR (raw_payload->'batch_lineage') ? $1
         OR raw_payload->>'updated_by_batch_id' = $1
      FOR UPDATE;
    `;
    await client.query(lockSql, [batchId]);

    // 1. Check for rows touched by target batch that were subsequently modified by a later batch
    const blockedCheckSql = `
      SELECT count(*) AS blocked_count
      FROM mandi_historical_observations
      WHERE (
        raw_payload->>'inserted_by_batch_id' = $1
        OR (raw_payload->'batch_lineage') ? $1
      )
      AND raw_payload->>'updated_by_batch_id' IS NOT NULL
      AND raw_payload->>'updated_by_batch_id' != $1;
    `;
    const blockedRes = await client.query(blockedCheckSql, [batchId]);
    const blockedByLaterBatch = blockedRes.rows && blockedRes.rows[0]
      ? parseInt(blockedRes.rows[0].blocked_count, 10) || 0
      : 0;

    // 2. Delete rows newly created by this batch (ONLY if never updated by any batch)
    const deleteSql = `
      DELETE FROM mandi_historical_observations
      WHERE raw_payload->>'inserted_by_batch_id' = $1
        AND raw_payload->>'updated_by_batch_id' IS NULL
        AND (raw_payload->'previous_state') IS NULL
      RETURNING id;
    `;
    const deleteRes = await client.query(deleteSql, [batchId]);
    const deletedCount = deleteRes.rows ? deleteRes.rows.length : 0;

    // 3. Restore COMPLETE pre-update raw_payload, source, and business fields where batchId is latest modifier
    const restoreSql = `
      UPDATE mandi_historical_observations
      SET
        modal_price_per_quintal = (raw_payload->'previous_state'->>'modal_price_per_quintal')::numeric,
        min_price_per_quintal = (raw_payload->'previous_state'->>'min_price_per_quintal')::numeric,
        max_price_per_quintal = (raw_payload->'previous_state'->>'max_price_per_quintal')::numeric,
        modal_price_per_kg = (raw_payload->'previous_state'->>'modal_price_per_kg')::numeric,
        raw_arrivals_value = raw_payload->'previous_state'->>'raw_arrivals_value',
        raw_arrivals_unit = raw_payload->'previous_state'->>'raw_arrivals_unit',
        arrival_quantity_tonnes = (raw_payload->'previous_state'->>'arrival_quantity_tonnes')::numeric,
        grade = raw_payload->'previous_state'->>'grade',
        source = COALESCE(raw_payload->'previous_state'->>'source', source),
        fetched_at = (raw_payload->'previous_state'->>'previous_fetched_at')::timestamptz,
        raw_payload = (raw_payload->'previous_state'->'previous_raw_payload')
      WHERE raw_payload->>'updated_by_batch_id' = $1
        AND (raw_payload->'previous_state'->'previous_raw_payload') IS NOT NULL
      RETURNING id;
    `;
    const restoreRes = await client.query(restoreSql, [batchId]);
    const restoredCount = restoreRes.rows ? restoreRes.rows.length : 0;

    if (ownsTransaction) {
      await client.query('COMMIT');
    } else if (usesSavepoint) {
      await client.query(`RELEASE SAVEPOINT ${savepointName}`);
    }

    return {
      batchId,
      transactionMode,
      deletedNewRows: deletedCount,
      restoredUpdatedRows: restoredCount,
      blockedByLaterBatch
    };
  } catch (err) {
    if (ownsTransaction) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
    } else if (usesSavepoint) {
      try {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        await client.query(`RELEASE SAVEPOINT ${savepointName}`);
      } catch (_) {}
    }
    throw err;
  } finally {
    if (isPool && typeof client.release === 'function') {
      client.release();
    }
  }
}

/**
 * Full F.1.2 Collection Orchestrator:
 * 1. Parses and validates incoming CSV stream against 6 completeness gates BEFORE DB writes
 * 2. Prevents incomplete/rejected bulletins from modifying any DB observations (0 DB writes)
 * 3. Executes conditional upsert strictly on passing bulletins
 * 4. Builds & persists full batch telemetry safely via AuditTelemetryStore
 */
async function collectValidatedBulletin({
  csvSource,
  metadata = {},
  streamComplete = true,
  windowName = 'MANUAL',
  targetDate = null,
  dayType = null,
  isHoliday = false,
  previousSuccessfulRun = null,
  dbClientOrPool,
  auditStore = new InMemoryAuditStore(),
  customThresholds = null,
  failOnVolumeDrop = false,
  batchId = null,
  sourceTag = `ogd:agmarknet-daily:${DATA_GOV_RESOURCE_ID}`
} = {}) {
  const startTime = new Date();
  const resolvedBatchId = batchId || generateHarvestBatchId(windowName, startTime);

  let parsedResult = { totalRows: 0, validRecords: [], rejectedRecords: [] };
  let validation = null;
  let dbStats = { imported: 0, updated: 0, skipped: 0 };
  let resolvedTargetDate = targetDate;
  let errorDetails = null;
  let executionStatus = 'FAILED';
  let observationsCommitted = false;

  try {
    // 1. Parse and validate records in stream
    parsedResult = await parseAndValidateBulletinStream(csvSource, {
      batchId: resolvedBatchId,
      ogdUpdatedDate: metadata.ogdUpdatedDate || null,
      sourceTag
    });

    // Infer observation date from first valid record if not explicitly passed
    if (!resolvedTargetDate && parsedResult.validRecords.length > 0) {
      resolvedTargetDate = parsedResult.validRecords[0].observation_date;
    }

    const scheduleDayType = dayType || getDayScheduleType(resolvedTargetDate || startTime, { isHoliday });

    // Retrieve previous baseline from audit store safely if not passed
    let priorRun = previousSuccessfulRun;
    if (!priorRun && auditStore && typeof auditStore.getLastSuccessfulRun === 'function') {
      try {
        priorRun = await auditStore.getLastSuccessfulRun({ excludeBatchId: resolvedBatchId });
      } catch (_lookupErr) {
        // Non-fatal: continue with null baseline (Gate 6 evaluates as NO_BASELINE)
        priorRun = null;
      }
    }

    // 2. Run Six-Gate Completeness Validation BEFORE any database writes
    validation = validateBulletinSixGates({
      metadata,
      parsedResult,
      streamComplete,
      previousSuccessfulRun: priorRun,
      dayType: scheduleDayType,
      customThresholds,
      failOnVolumeDrop
    });

    // 3. Enforce Gate Decision
    if (!validation.passed) {
      executionStatus = validation.finalValidationStatus === 'REJECTED_TRUNCATED'
        ? 'REJECTED_TRUNCATED'
        : 'REJECTED_VALIDATION';
      errorDetails = `Six-gate validation failed: ${validation.finalValidationStatus}`;
    } else {
      // Certified bulletin -> proceed with idempotent conditional upsert
      if (!dbClientOrPool) {
        throw new Error('dbClientOrPool is required when persisting certified observations');
      }
      dbStats = await executeCollectionBatch(
        dbClientOrPool,
        validation.deduplicatedRecords,
        resolvedBatchId
      );
      observationsCommitted = true;
      executionStatus = validation.requiresInvestigation
        ? 'SUCCESS_INVESTIGATION_NEEDED'
        : 'SUCCESS';
    }
  } catch (err) {
    executionStatus = 'FAILED';
    errorDetails = err.message;
  }

  const endTime = new Date();
  const m = validation ? validation.metrics : {};

  // 4. Construct Complete Batch Telemetry (never fabricating missing values)
  const telemetry = createBatchTelemetryRecord({
    harvest_batch_id: resolvedBatchId,
    execution_start_utc: startTime.toISOString(),
    execution_end_utc: endTime.toISOString(),
    collection_window: windowName,
    target_observation_date: resolvedTargetDate || null,
    ogd_publication_timestamp: metadata.ogdUpdatedDate || null,
    api_reported_total: metadata.totalRecords !== undefined ? metadata.totalRecords : (metadata.apiReportedTotal ?? null),
    records_fetched: parsedResult.totalRows,
    records_parsed: m.uniqueValidCount !== undefined ? m.uniqueValidCount : parsedResult.validRecords.length,
    records_inserted: dbStats.imported,
    records_updated: dbStats.updated,
    records_skipped: dbStats.skipped,
    records_rejected: parsedResult.rejectedRecords.length,
    duplicate_count: m.duplicateCount || 0,
    distinct_states: m.distinctStates || 0,
    distinct_markets: m.distinctMarkets || 0,
    distinct_commodities: m.distinctCommodities || 0,
    gates: validation ? validation.gates : {},
    final_validation_status: validation ? validation.finalValidationStatus : 'ERROR',
    execution_status: executionStatus,
    observations_committed: observationsCommitted,
    audit_persisted: false,
    fully_certified: false,
    audit_lifecycle_state: observationsCommitted
      ? AUDIT_LIFECYCLE_STATES.OBSERVATIONS_COMMITTED
      : AUDIT_LIFECYCLE_STATES.REJECTED_AUDIT_PERSISTED,
    error_details: errorDetails
  });

  // 5. Persist Telemetry safely — collection CANNOT be reported as fully successful if audit fails
  let auditPersistFailed = false;
  let auditError = null;
  let recoverableAuditPayload = null;

  if (auditStore && typeof auditStore.saveRun === 'function') {
    // Prepare target certified states prior to persistence so stored record reflects complete certification
    telemetry.audit_persisted = true;
    if (observationsCommitted) {
      telemetry.audit_lifecycle_state = AUDIT_LIFECYCLE_STATES.COLLECTION_FULLY_CERTIFIED;
      telemetry.fully_certified = !(validation && validation.requiresInvestigation);
    } else {
      telemetry.audit_lifecycle_state = AUDIT_LIFECYCLE_STATES.REJECTED_AUDIT_PERSISTED;
      telemetry.fully_certified = false;
    }

    try {
      await auditStore.saveRun(telemetry);
    } catch (auditErr) {
      auditPersistFailed = true;
      auditError = auditErr.message;
      telemetry.audit_persisted = false;
      telemetry.fully_certified = false;

      if (observationsCommitted) {
        telemetry.execution_status = 'AUDIT_PERSIST_FAILED_AFTER_COMMIT';
        telemetry.audit_lifecycle_state = AUDIT_LIFECYCLE_STATES.AUDIT_PERSIST_FAILED_AFTER_COMMIT;
      } else {
        telemetry.execution_status = 'AUDIT_PERSIST_FAILED';
        telemetry.audit_lifecycle_state = AUDIT_LIFECYCLE_STATES.REJECTED_AUDIT_FAILED;
      }

      telemetry.error_details = telemetry.error_details
        ? `${telemetry.error_details} | Audit store error: ${auditError}`
        : `Audit store error: ${auditError}`;

      // Provide complete recoverable snapshot for manual or queued audit retry
      recoverableAuditPayload = JSON.parse(JSON.stringify(telemetry));
    }
  } else {
    // No durable audit store provided -> cannot be fully certified
    telemetry.audit_persisted = false;
    telemetry.fully_certified = false;
  }

  return {
    telemetry,
    validation,
    dbStats,
    observationsCommitted,
    auditPersistFailed,
    auditError,
    recoverableAuditPayload
  };
}

module.exports = {
  resolveDataGovApiKey,
  generateHarvestBatchId,
  fetchBulletinMetadata,
  extractMetadataFromPayload,
  normalizeCsvHeaders,
  parseAndValidateBulletinStream,
  upsertObservationsChunk,
  executeCollectionBatch,
  rollbackHarvestBatch,
  collectValidatedBulletin
};
