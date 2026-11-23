/**
 * KisanOS Historical Weather Ingestion Service
 * 
 * Provides authentic meteorological data ingestion from the Open-Meteo Historical Archive API
 * for India-wide multi-crop mandi price forecasting.
 * 
 * Core Capabilities:
 * - Genuine daily ERA5 / ERA5-Land reanalysis observations.
 * - Strict segregation: writes exclusively to weather_historical_observations.
 * - Strict nullability: preserves NULL for missing values, never uses DEFAULT 0.
 * - Deterministic SHA-256 ID generation consistent with unique constraint (location_id, observation_date).
 * - Rate limiting, jittered backoff, and retry handling.
 * - Idempotent upsert with conflict detection.
 * - Support for transactional isolation in automated test suites.
 */

const crypto = require('crypto');
const { pool } = require('../db');

/**
 * Standard WMO Weather interpretation codes
 */
const WMO_CODE_MAP = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  62: 'Rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail'
};

function interpretWmoCode(code) {
  if (code === null || code === undefined || isNaN(Number(code))) return null;
  return WMO_CODE_MAP[Number(code)] || 'Fair';
}

/**
 * Representative pilot mandi locations across major Indian agrarian regions
 */
const PILOT_MANDI_LOCATIONS = [
  {
    location_id: 'mandi:up:agra',
    name: 'Agra / Samsabad APMC',
    location_type: 'MANDI',
    state: 'Uttar Pradesh',
    district: 'Agra',
    latitude: 27.1767,
    longitude: 78.0081,
    primary_crops: ['Potato', 'Mustard', 'Wheat']
  },
  {
    location_id: 'mandi:mh:lasalgaon',
    name: 'Lasalgaon APMC',
    location_type: 'MANDI',
    state: 'Maharashtra',
    district: 'Nashik',
    latitude: 20.1478,
    longitude: 74.2255,
    primary_crops: ['Onion', 'Tomato', 'Pomegranate']
  },
  {
    location_id: 'mandi:mp:indore',
    name: 'Indore APMC',
    location_type: 'MANDI',
    state: 'Madhya Pradesh',
    district: 'Indore',
    latitude: 22.7196,
    longitude: 75.8577,
    primary_crops: ['Soyabean', 'Wheat', 'Garlic']
  },
  {
    location_id: 'mandi:ka:kolar',
    name: 'Kolar APMC',
    location_type: 'MANDI',
    state: 'Karnataka',
    district: 'Kolar',
    latitude: 13.1367,
    longitude: 78.1292,
    primary_crops: ['Tomato', 'Mango', 'Ragi']
  },
  {
    location_id: 'mandi:pb:ludhiana',
    name: 'Ludhiana APMC',
    location_type: 'MANDI',
    state: 'Punjab',
    district: 'Ludhiana',
    latitude: 30.9010,
    longitude: 75.8573,
    primary_crops: ['Wheat', 'Paddy']
  },
  {
    location_id: 'mandi:rj:jodhpur',
    name: 'Jodhpur (F&V) APMC',
    location_type: 'MANDI',
    state: 'Rajasthan',
    district: 'Jodhpur',
    latitude: 26.2389,
    longitude: 73.0243,
    primary_crops: ['Cumin', 'Guar', 'Onion']
  },
  {
    location_id: 'mandi:as:guwahati',
    name: 'Pamohi(Garchuk) APMC',
    location_type: 'MANDI',
    state: 'Assam',
    district: 'Kamrup',
    latitude: 26.1158,
    longitude: 91.7086,
    primary_crops: ['Paddy', 'Ginger', 'Turmeric']
  }
];

/**
 * Clean numeric weather value, strictly returning null if undefined or NaN.
 * Never converts missing values to 0.00.
 */
function cleanNullableNumber(val, decimals) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  if (isNaN(n) || !isFinite(n)) return null;
  if (decimals !== undefined && decimals !== null) {
    return Number(n.toFixed(decimals));
  }
  return n;
}

/**
 * Generate deterministic SHA-256 ID for historical weather observation.
 * Formula: SHA-256("weather:" + location_id.trim().toLowerCase() + ":" + observation_date.trim())
 */
function generateWeatherObservationId(locationId, observationDate) {
  if (!locationId || !observationDate) {
    throw new Error('Both locationId and observationDate are required to generate weather ID');
  }
  const normalizedKey = `weather:${String(locationId).trim().toLowerCase()}:${String(observationDate).trim()}`;
  return crypto.createHash('sha256').update(normalizedKey).digest('hex');
}

/**
 * Pause execution for ms milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch daily historical weather from Open-Meteo Archive API with retries and backoff.
 */
async function fetchOpenMeteoDailyHistorical(latitude, longitude, startDate, endDate, {
  maxRetries = 3,
  timeoutMs = 12000,
  fetchFn = fetch
} = {}) {
  const normLat = Number(Number(latitude).toFixed(4));
  const normLon = Number(Number(longitude).toFixed(4));

  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${normLat}&longitude=${normLon}` +
    `&start_date=${startDate}&end_date=${endDate}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,rain_sum,wind_speed_10m_max,et0_fao_evapotranspiration,soil_moisture_0_to_7cm_mean,soil_moisture_7_to_28cm_mean,relative_humidity_2m_mean` +
    `&timezone=Asia%2FKolkata`;

  let attempt = 0;
  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchFn(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        // Rate limit hit: exponential backoff with jitter
        const backoffMs = Math.min(1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 500), 10000);
        console.warn(`[HISTORICAL WEATHER] Open-Meteo HTTP 429 Rate Limit (attempt ${attempt}/${maxRetries}), waiting ${backoffMs}ms`);
        await sleep(backoffMs);
        continue;
      }

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Open-Meteo HTTP ${res.status}: ${errorText.slice(0, 150)}`);
      }

      const json = await res.json();
      return json;
    } catch (err) {
      clearTimeout(timeoutId);
      if (attempt > maxRetries) {
        throw new Error(`Failed to fetch Open-Meteo historical weather after ${maxRetries} attempts: ${err.message}`);
      }
      const backoffMs = 800 * attempt + Math.floor(Math.random() * 300);
      console.warn(`[HISTORICAL WEATHER] Attempt ${attempt} failed (${err.message}), retrying in ${backoffMs}ms...`);
      await sleep(backoffMs);
    }
  }
}

/**
 * Transform Open-Meteo daily response into validated observation records.
 */
function transformDailyWeatherPayload(locationInfo, apiData, source = 'open-meteo:archive:era5') {
  if (!apiData || !apiData.daily || !Array.isArray(apiData.daily.time)) {
    return [];
  }

  const {
    location_id,
    location_type = 'MANDI',
    state,
    district,
    latitude,
    longitude
  } = locationInfo;

  const daily = apiData.daily;
  const times = daily.time || [];
  const records = [];

  for (let i = 0; i < times.length; i++) {
    const obsDate = times[i];
    if (!obsDate) continue;

    const weatherCode = daily.weather_code?.[i] ?? null;
    const weatherCondition = interpretWmoCode(weatherCode);

    const rainfallMm = cleanNullableNumber(daily.precipitation_sum?.[i] ?? daily.rain_sum?.[i], 2);
    const tempMinC = cleanNullableNumber(daily.temperature_2m_min?.[i], 2);
    const tempMaxC = cleanNullableNumber(daily.temperature_2m_max?.[i], 2);
    const tempMeanC = cleanNullableNumber(daily.temperature_2m_mean?.[i], 2);
    const relHumidityMeanPct = cleanNullableNumber(daily.relative_humidity_2m_mean?.[i], 2);
    const windSpeedMaxKmh = cleanNullableNumber(daily.wind_speed_10m_max?.[i], 2);
    const soilMoisture0To7 = cleanNullableNumber(daily.soil_moisture_0_to_7cm_mean?.[i], 4);
    const soilMoisture7To28 = cleanNullableNumber(daily.soil_moisture_7_to_28cm_mean?.[i], 4);
    const et0Mm = cleanNullableNumber(daily.et0_fao_evapotranspiration?.[i], 2);

    const id = generateWeatherObservationId(location_id, obsDate);

    // Build raw payload snapshot preserving exact API context for this day
    const rawPayload = {
      date: obsDate,
      latitude: apiData.latitude,
      longitude: apiData.longitude,
      elevation: apiData.elevation,
      timezone: apiData.timezone,
      weather_code: weatherCode,
      daily_units: apiData.daily_units || {},
      raw_values: {
        temperature_2m_max: daily.temperature_2m_max?.[i],
        temperature_2m_min: daily.temperature_2m_min?.[i],
        temperature_2m_mean: daily.temperature_2m_mean?.[i],
        precipitation_sum: daily.precipitation_sum?.[i],
        rain_sum: daily.rain_sum?.[i],
        wind_speed_10m_max: daily.wind_speed_10m_max?.[i],
        relative_humidity_2m_mean: daily.relative_humidity_2m_mean?.[i],
        soil_moisture_0_to_7cm_mean: daily.soil_moisture_0_to_7cm_mean?.[i],
        soil_moisture_7_to_28cm_mean: daily.soil_moisture_7_to_28cm_mean?.[i],
        et0_fao_evapotranspiration: daily.et0_fao_evapotranspiration?.[i]
      }
    };

    records.push({
      id,
      location_id,
      location_type,
      state,
      district,
      latitude: Number(Number(latitude).toFixed(4)),
      longitude: Number(Number(longitude).toFixed(4)),
      observation_date: obsDate,
      rainfall_mm: rainfallMm,
      temp_min_c: tempMinC,
      temp_max_c: tempMaxC,
      temp_mean_c: tempMeanC,
      relative_humidity_mean_pct: relHumidityMeanPct,
      wind_speed_max_kmh: windSpeedMaxKmh,
      soil_moisture_0_to_7cm_m3m3: soilMoisture0To7,
      soil_moisture_7_to_28cm_m3m3: soilMoisture7To28,
      et0_evapotranspiration_mm: et0Mm,
      weather_condition: weatherCondition,
      source,
      raw_payload: rawPayload
    });
  }

  return records;
}

/**
 * Ingest weather observation records into PostgreSQL database idempotently.
 * Supports transactional client or connection pool.
 */
async function ingestWeatherObservations(records = [], {
  chunkSize = 100,
  clientOrPool = pool
} = {}) {
  const stats = {
    total: records.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    rejected: 0,
    errors: []
  };

  if (!records || records.length === 0) return stats;

  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);

    for (const rec of chunk) {
      try {
        const query = `
          INSERT INTO weather_historical_observations (
            id, location_id, location_type, state, district, latitude, longitude, observation_date,
            rainfall_mm, temp_min_c, temp_max_c, temp_mean_c, relative_humidity_mean_pct,
            wind_speed_max_kmh, soil_moisture_0_to_7cm_m3m3, soil_moisture_7_to_28cm_m3m3,
            et0_evapotranspiration_mm, weather_condition, source, raw_payload, fetched_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13,
            $14, $15, $16,
            $17, $18, $19, $20, NOW()
          )
          ON CONFLICT (location_id, observation_date) DO UPDATE SET
            rainfall_mm = EXCLUDED.rainfall_mm,
            temp_min_c = EXCLUDED.temp_min_c,
            temp_max_c = EXCLUDED.temp_max_c,
            temp_mean_c = EXCLUDED.temp_mean_c,
            relative_humidity_mean_pct = EXCLUDED.relative_humidity_mean_pct,
            wind_speed_max_kmh = EXCLUDED.wind_speed_max_kmh,
            soil_moisture_0_to_7cm_m3m3 = EXCLUDED.soil_moisture_0_to_7cm_m3m3,
            soil_moisture_7_to_28cm_m3m3 = EXCLUDED.soil_moisture_7_to_28cm_m3m3,
            et0_evapotranspiration_mm = EXCLUDED.et0_evapotranspiration_mm,
            weather_condition = EXCLUDED.weather_condition,
            source = EXCLUDED.source,
            raw_payload = EXCLUDED.raw_payload,
            fetched_at = NOW()
          WHERE
            weather_historical_observations.rainfall_mm IS DISTINCT FROM EXCLUDED.rainfall_mm
            OR weather_historical_observations.temp_min_c IS DISTINCT FROM EXCLUDED.temp_min_c
            OR weather_historical_observations.temp_max_c IS DISTINCT FROM EXCLUDED.temp_max_c
            OR weather_historical_observations.temp_mean_c IS DISTINCT FROM EXCLUDED.temp_mean_c
            OR weather_historical_observations.relative_humidity_mean_pct IS DISTINCT FROM EXCLUDED.relative_humidity_mean_pct
            OR weather_historical_observations.wind_speed_max_kmh IS DISTINCT FROM EXCLUDED.wind_speed_max_kmh
            OR weather_historical_observations.soil_moisture_0_to_7cm_m3m3 IS DISTINCT FROM EXCLUDED.soil_moisture_0_to_7cm_m3m3
            OR weather_historical_observations.soil_moisture_7_to_28cm_m3m3 IS DISTINCT FROM EXCLUDED.soil_moisture_7_to_28cm_m3m3
            OR weather_historical_observations.et0_evapotranspiration_mm IS DISTINCT FROM EXCLUDED.et0_evapotranspiration_mm
            OR weather_historical_observations.weather_condition IS DISTINCT FROM EXCLUDED.weather_condition
            OR weather_historical_observations.source IS DISTINCT FROM EXCLUDED.source
            OR weather_historical_observations.raw_payload IS DISTINCT FROM EXCLUDED.raw_payload
          RETURNING id, (xmax = 0) AS is_insert;
        `;

        const params = [
          rec.id,
          rec.location_id,
          rec.location_type || 'MANDI',
          rec.state,
          rec.district,
          rec.latitude,
          rec.longitude,
          rec.observation_date,
          rec.rainfall_mm,
          rec.temp_min_c,
          rec.temp_max_c,
          rec.temp_mean_c,
          rec.relative_humidity_mean_pct,
          rec.wind_speed_max_kmh,
          rec.soil_moisture_0_to_7cm_m3m3,
          rec.soil_moisture_7_to_28cm_m3m3,
          rec.et0_evapotranspiration_mm,
          rec.weather_condition,
          rec.source,
          rec.raw_payload
        ];

        const res = await clientOrPool.query(query, params);
        if (res.rows.length > 0) {
          if (res.rows[0].is_insert) {
            stats.imported++;
          } else {
            stats.updated++;
          }
        } else {
          stats.skipped++;
        }
      } catch (err) {
        stats.rejected++;
        stats.errors.push({ id: rec.id, error: err.message });
      }
    }
  }

  return stats;
}

/**
 * Execute Pilot Historical Weather Ingestion for representative mandi locations.
 */
async function ingestPilotHistoricalWeather({
  locations = PILOT_MANDI_LOCATIONS,
  startDate = '2026-10-01',
  endDate = '2026-11-06',
  source = 'open-meteo:archive:era5',
  staggerDelayMs = 350,
  clientOrPool = pool
} = {}) {
  const pilotReport = {
    startDate,
    endDate,
    locationsProcessed: 0,
    totalRecordsFetched: 0,
    imported: 0,
    updated: 0,
    skipped: 0,
    rejected: 0,
    locationSummaries: [],
    errors: []
  };

  for (const loc of locations) {
    try {
      console.log(`[PILOT WEATHER] Fetching ${loc.name} (${loc.location_id}) from ${startDate} to ${endDate}...`);
      const apiData = await fetchOpenMeteoDailyHistorical(loc.latitude, loc.longitude, startDate, endDate);
      const records = transformDailyWeatherPayload(loc, apiData, source);

      pilotReport.totalRecordsFetched += records.length;

      const ingestStats = await ingestWeatherObservations(records, { clientOrPool });
      pilotReport.imported += ingestStats.imported;
      pilotReport.updated += ingestStats.updated;
      pilotReport.skipped += ingestStats.skipped;
      pilotReport.rejected += ingestStats.rejected;
      pilotReport.locationsProcessed++;

      pilotReport.locationSummaries.push({
        location_id: loc.location_id,
        name: loc.name,
        state: loc.state,
        district: loc.district,
        recordsFetched: records.length,
        imported: ingestStats.imported,
        updated: ingestStats.updated,
        skipped: ingestStats.skipped,
        rejected: ingestStats.rejected
      });

      if (staggerDelayMs > 0) {
        await sleep(staggerDelayMs);
      }
    } catch (err) {
      console.error(`[PILOT WEATHER] Failed processing ${loc.location_id}:`, err.message);
      pilotReport.errors.push({ location_id: loc.location_id, error: err.message });
    }
  }

  return pilotReport;
}

/**
 * Aggregate summary statistics of historical weather database table.
 */
async function getHistoricalWeatherStats({
  state,
  district,
  locationId,
  excludeTest = true
} = {}, clientOrPool = pool) {
  const whereClauses = [];
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
  if (locationId) {
    params.push(locationId);
    whereClauses.push(`location_id = $${params.length}`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const overviewQuery = `
    SELECT 
      COUNT(*)::int as total_records,
      COUNT(DISTINCT location_id)::int as location_count,
      COUNT(DISTINCT state)::int as state_count,
      COUNT(DISTINCT district)::int as district_count,
      MIN(observation_date)::text as earliest_date,
      MAX(observation_date)::text as latest_date,
      ROUND(AVG(temp_mean_c), 2) as avg_temp_mean_c,
      ROUND(MIN(temp_min_c), 2) as min_temp_c,
      ROUND(MAX(temp_max_c), 2) as max_temp_c,
      ROUND(SUM(rainfall_mm), 2) as total_rainfall_mm,
      COUNT(*) FILTER (WHERE rainfall_mm IS NULL)::int as null_rainfall_count,
      COUNT(*) FILTER (WHERE soil_moisture_0_to_7cm_m3m3 IS NULL)::int as null_soil_moisture_count,
      COUNT(*) FILTER (WHERE relative_humidity_mean_pct IS NULL)::int as null_humidity_count
    FROM weather_historical_observations
    ${whereSql};
  `;

  const locationsQuery = `
    SELECT 
      location_id,
      state,
      district,
      latitude::numeric(7,4) as latitude,
      longitude::numeric(7,4) as longitude,
      COUNT(*)::int as record_count,
      MIN(observation_date)::text as min_date,
      MAX(observation_date)::text as max_date,
      ROUND(AVG(temp_mean_c), 2) as avg_temp_c,
      ROUND(SUM(rainfall_mm), 2) as total_rainfall_mm
    FROM weather_historical_observations
    ${whereSql}
    GROUP BY location_id, state, district, latitude, longitude
    ORDER BY state, district, location_id;
  `;

  const [overviewRes, locationsRes] = await Promise.all([
    clientOrPool.query(overviewQuery, params),
    clientOrPool.query(locationsQuery, params)
  ]);

  return {
    overview: overviewRes.rows[0],
    locations: locationsRes.rows
  };
}

/**
 * Query historical weather observations for ML dataset preparation.
 * Strictly excludes test fixtures case-insensitively by default.
 */
async function fetchMLWeatherObservations({
  locationId,
  state,
  district,
  startDate,
  endDate,
  excludeTest = true,
  limit,
  clientOrPool = pool
} = {}) {
  const whereClauses = [];
  const params = [];

  if (excludeTest) {
    whereClauses.push(`source NOT ILIKE 'test%'`);
  }
  if (locationId) {
    params.push(locationId);
    whereClauses.push(`location_id = $${params.length}`);
  }
  if (state) {
    params.push(state);
    whereClauses.push(`state ILIKE $${params.length}`);
  }
  if (district) {
    params.push(district);
    whereClauses.push(`district ILIKE $${params.length}`);
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
    SELECT 
      id, location_id, location_type, state, district,
      latitude, longitude, observation_date::text,
      rainfall_mm, temp_min_c, temp_max_c, temp_mean_c,
      relative_humidity_mean_pct, wind_speed_max_kmh,
      soil_moisture_0_to_7cm_m3m3, soil_moisture_7_to_28cm_m3m3,
      et0_evapotranspiration_mm, weather_condition,
      source, fetched_at, created_at
    FROM weather_historical_observations
    ${whereSql}
    ORDER BY observation_date ASC, location_id ASC
    ${limitClause};
  `;

  const res = await clientOrPool.query(query, params);
  return res.rows;
}

module.exports = {
  PILOT_MANDI_LOCATIONS,
  WMO_CODE_MAP,
  interpretWmoCode,
  cleanNullableNumber,
  generateWeatherObservationId,
  fetchOpenMeteoDailyHistorical,
  transformDailyWeatherPayload,
  ingestWeatherObservations,
  ingestPilotHistoricalWeather,
  getHistoricalWeatherStats,
  fetchMLWeatherObservations
};

