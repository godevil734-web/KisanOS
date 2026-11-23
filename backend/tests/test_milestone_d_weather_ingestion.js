/**
 * Milestone D: Historical Weather Ingestion Service & Pilot Test Suite
 * 
 * Verifies:
 * 1. Deterministic SHA-256 ID generation is consistent and NULL-safe
 * 2. Strict nullability: cleanNullableNumber preserves NULL and genuine 0.00 without DEFAULT 0
 * 3. WMO code interpretation converts standard codes to human conditions
 * 4. Transform daily weather payload normalizes Open-Meteo responses and preserves raw payload
 * 5. Idempotent database insertion inside isolated transaction (BEGIN ... ROLLBACK)
 * 6. Authentic Pilot Weather Coverage: verifies genuine ERA5 observations across 7 representative Indian states
 * 7. Case-insensitive source provenance exclusion (source NOT ILIKE 'test%') for ML queries
 * 8. Strict segregation: confirms weather_forecast_records and weather_disaster_alerts remain 0 rows
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const assert = require('assert');
const { pool } = require('../db');
const {
  PILOT_MANDI_LOCATIONS,
  WMO_CODE_MAP,
  interpretWmoCode,
  cleanNullableNumber,
  generateWeatherObservationId,
  transformDailyWeatherPayload,
  ingestWeatherObservations,
  getHistoricalWeatherStats,
  fetchMLWeatherObservations
} = require('../services/historicalWeatherService');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('\n=== KisanOS 2.0: Milestone D Historical Weather Ingestion Test Suite ===\n');

  // Test 1: Deterministic ID generation
  runTest('1. Deterministic SHA-256 ID generation is consistent, lowercased, and NULL-safe', () => {
    const id1 = generateWeatherObservationId('mandi:UP:Agra', '2026-11-01');
    const id2 = generateWeatherObservationId('mandi:up:agra ', '2026-11-01');
    assert.strictEqual(id1, id2, 'Case and whitespace variations must yield identical IDs');
    assert.strictEqual(id1.length, 64, 'ID must be 64-char SHA-256 hex string');

    assert.throws(() => generateWeatherObservationId(null, '2026-11-01'), /required/);
    assert.throws(() => generateWeatherObservationId('mandi:up:agra', null), /required/);
  });

  // Test 2: Strict Nullability (never convert missing to 0)
  runTest('2. Strict nullability: cleanNullableNumber preserves NULL and genuine 0.00 without DEFAULT 0', () => {
    assert.strictEqual(cleanNullableNumber(null), null);
    assert.strictEqual(cleanNullableNumber(undefined), null);
    assert.strictEqual(cleanNullableNumber(''), null);
    assert.strictEqual(cleanNullableNumber('NA'), null);
    assert.strictEqual(cleanNullableNumber(NaN), null);

    // Genuine 0 must be preserved as 0
    assert.strictEqual(cleanNullableNumber(0), 0);
    assert.strictEqual(cleanNullableNumber('0'), 0);
    assert.strictEqual(cleanNullableNumber(0.00, 2), 0);

    // Numeric rounding
    assert.strictEqual(cleanNullableNumber('25.678', 2), 25.68);
    assert.strictEqual(cleanNullableNumber(0.123456, 4), 0.1235);
  });

  // Test 3: WMO Code Interpretation
  runTest('3. WMO code interpretation converts standard codes to human conditions', () => {
    assert.strictEqual(interpretWmoCode(0), 'Clear sky');
    assert.strictEqual(interpretWmoCode(2), 'Partly cloudy');
    assert.strictEqual(interpretWmoCode(63), 'Moderate rain');
    assert.strictEqual(interpretWmoCode(95), 'Thunderstorm');
    assert.strictEqual(interpretWmoCode(null), null);
    assert.strictEqual(interpretWmoCode(undefined), null);
    assert.strictEqual(interpretWmoCode(999), 'Fair');
  });

  // Test 4: Transform daily payload
  runTest('4. Transform daily weather payload normalizes Open-Meteo responses and preserves raw payload', () => {
    const mockLoc = {
      location_id: 'mandi:test:sample',
      location_type: 'MANDI',
      state: 'Test State',
      district: 'Test District',
      latitude: 25.123456,
      longitude: 80.987654
    };

    const mockApi = {
      latitude: 25.12,
      longitude: 80.99,
      elevation: 150,
      timezone: 'Asia/Kolkata',
      daily_units: {
        temperature_2m_max: '°C',
        precipitation_sum: 'mm'
      },
      daily: {
        time: ['2026-11-01', '2026-11-02'],
        weather_code: [0, 61],
        temperature_2m_max: [32.5, null],
        temperature_2m_min: [20.1, 19.5],
        temperature_2m_mean: [26.3, 22.0],
        precipitation_sum: [0.0, 5.2],
        wind_speed_10m_max: [12.4, 18.2],
        relative_humidity_2m_mean: [55.0, 80.0],
        soil_moisture_0_to_7cm_mean: [0.1523, null],
        soil_moisture_7_to_28cm_mean: [0.2215, 0.2500],
        et0_fao_evapotranspiration: [4.5, 3.2]
      }
    };

    const records = transformDailyWeatherPayload(mockLoc, mockApi, 'test:weather-parser');
    assert.strictEqual(records.length, 2);

    const r1 = records[0];
    assert.strictEqual(r1.observation_date, '2026-11-01');
    assert.strictEqual(r1.weather_condition, 'Clear sky');
    assert.strictEqual(r1.temp_max_c, 32.5);
    assert.strictEqual(r1.rainfall_mm, 0.0);
    assert.strictEqual(r1.soil_moisture_0_to_7cm_m3m3, 0.1523);
    assert.ok(r1.raw_payload);
    assert.strictEqual(r1.raw_payload.elevation, 150);

    const r2 = records[1];
    assert.strictEqual(r2.temp_max_c, null, 'Missing temp_max must be preserved as NULL');
    assert.strictEqual(r2.rainfall_mm, 5.2);
    assert.strictEqual(r2.soil_moisture_0_to_7cm_m3m3, null, 'Missing soil moisture must be preserved as NULL');
    assert.strictEqual(r2.weather_condition, 'Slight rain');
  });

  // Test 5: Ingestion Idempotency inside isolated transaction (Clean ROLLBACK)
  await runAsyncTest('5. Idempotent database insertion inside isolated transaction (clean ROLLBACK)', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const loc = {
        location_id: 'mandi:trans-test:agra',
        location_type: 'MANDI',
        state: 'Uttar Pradesh',
        district: 'Agra',
        latitude: 27.1767,
        longitude: 78.0081
      };

      const mockApi = {
        latitude: 27.18,
        longitude: 78.01,
        elevation: 170,
        timezone: 'Asia/Kolkata',
        daily: {
          time: ['2026-11-01', '2026-11-02', '2026-11-03'],
          weather_code: [0, 1, 2],
          temperature_2m_max: [31.5, 30.2, 29.8],
          temperature_2m_min: [19.2, 18.5, 18.0],
          temperature_2m_mean: [25.3, 24.1, 23.9],
          precipitation_sum: [0.0, 0.0, 1.5],
          wind_speed_10m_max: [10.2, 11.0, 14.5],
          relative_humidity_2m_mean: [50.0, 52.0, 65.0],
          soil_moisture_0_to_7cm_mean: [0.12, 0.11, 0.15],
          soil_moisture_7_to_28cm_mean: [0.20, 0.20, 0.22],
          et0_fao_evapotranspiration: [4.2, 4.0, 3.8]
        }
      };

      const records = transformDailyWeatherPayload(loc, mockApi, 'test:weather-tx');

      // First insertion: all 3 must be imported
      const stats1 = await ingestWeatherObservations(records, { clientOrPool: client });
      assert.strictEqual(stats1.imported, 3, 'First pass must import 3 records');
      assert.strictEqual(stats1.updated, 0);

      // Second insertion (identical): must skip unchanged records without duplicating
      const stats2 = await ingestWeatherObservations(records, { clientOrPool: client });
      assert.strictEqual(stats2.imported, 0, 'Second pass must import 0 new records');
      assert.strictEqual(stats2.updated, 0, 'Second pass must update 0 records');
      assert.strictEqual(stats2.skipped, 3, 'Second pass must skip 3 identical records');
      assert.strictEqual(stats2.rejected, 0);

      // Verify row count inside transaction
      const countRes = await client.query(
        'SELECT COUNT(*)::int as count FROM weather_historical_observations WHERE location_id = $1',
        [loc.location_id]
      );
      assert.strictEqual(countRes.rows[0].count, 3, 'Must have exactly 3 rows, zero duplicate rows');

      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // Test 6: Authentic Pilot Weather Coverage in Production Database
  await runAsyncTest('6. Authentic Pilot Weather Coverage: verifies genuine ERA5 observations across 7 representative Indian states', async () => {
    const stats = await getHistoricalWeatherStats({ excludeTest: true });
    const overview = stats.overview;

    console.log(`    [Pilot Overview] Total Records: ${overview.total_records}, Locations: ${overview.location_count}, States: ${overview.state_count}`);
    console.log(`    [Date Range]: ${overview.earliest_date} to ${overview.latest_date}`);
    console.log(`    [Temp Range]: Min ${overview.min_temp_c}°C, Max ${overview.max_temp_c}°C, Avg Mean ${overview.avg_temp_mean_c}°C`);
    console.log(`    [Cumulative Rainfall]: ${overview.total_rainfall_mm}mm`);

    assert.ok(overview.total_records >= 250, 'Pilot should have at least 250 historical weather records');
    assert.strictEqual(overview.location_count, 7, 'Pilot should cover exactly 7 representative mandi locations');
    assert.strictEqual(overview.state_count, 7, 'Pilot should cover 7 distinct Indian states');
    assert.strictEqual(overview.district_count, 7, 'Pilot should cover 7 distinct districts');
    assert.strictEqual(overview.earliest_date, '2026-10-01');
    assert.strictEqual(overview.latest_date, '2026-11-06');
    assert.strictEqual(overview.null_rainfall_count, 0, 'Rainfall is fully reported by ERA5 reanalysis');
  });

  // Test 7: Case-insensitive source exclusion in ML queries
  await runAsyncTest('7. Case-insensitive source provenance exclusion (source NOT ILIKE "test%") for ML queries', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert uppercase and mixed-case test source rows
      await client.query(`
        INSERT INTO weather_historical_observations (
          id, location_id, location_type, state, district, latitude, longitude, observation_date,
          temp_mean_c, source, raw_payload
        ) VALUES 
          ('test-upper-weather-id', 'mandi:test:case', 'MANDI', 'State', 'District', 20.0, 75.0, '2026-11-01', 25.0, 'TEST:UPPERCASE', '{}'::jsonb),
          ('test-mixed-weather-id', 'mandi:test:case', 'MANDI', 'State', 'District', 20.0, 75.0, '2026-11-02', 26.0, 'Test:MixedCase', '{}'::jsonb);
      `);

      // ML Query with default excludeTest = true
      const mlRows = await fetchMLWeatherObservations({
        locationId: 'mandi:test:case',
        clientOrPool: client
      });
      assert.strictEqual(mlRows.length, 0, 'ML dataset query must exclude all test sources case-insensitively');

      // Query with excludeTest = false
      const allRows = await fetchMLWeatherObservations({
        locationId: 'mandi:test:case',
        excludeTest: false,
        clientOrPool: client
      });
      assert.strictEqual(allRows.length, 2, 'Explicit excludeTest: false must return test rows');

      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // Test 8: Strict Segregation (forecast and alerts tables untouched)
  await runAsyncTest('8. Strict segregation: confirms weather_forecast_records and weather_disaster_alerts remain 0 rows', async () => {
    const fRes = await pool.query('SELECT count(*)::int as count FROM weather_forecast_records');
    const aRes = await pool.query('SELECT count(*)::int as count FROM weather_disaster_alerts');

    assert.strictEqual(fRes.rows[0].count, 0, 'weather_forecast_records must have 0 rows');
    assert.strictEqual(aRes.rows[0].count, 0, 'weather_disaster_alerts must have 0 rows');
  });

  console.log(`\nMilestone D Weather Ingestion Scoreboard: ${passedTests}/${totalTests} tests passed.\n`);
  await pool.end();
}

main().catch(err => {
  console.error('\nMilestone D Test Suite Failed:', err);
  process.exit(1);
});

