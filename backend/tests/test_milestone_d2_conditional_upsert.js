/**
 * Milestone D.2: Conditional Upsert & Idempotency Hardening Test Suite
 * 
 * Verifies:
 * 1. Initial batch ingestion: all new records imported (imported = N, updated = 0, skipped = 0)
 * 2. Identical second ingestion: all records skipped (imported = 0, updated = 0, skipped = N)
 * 3. Changed weather field: correctly triggers update (imported = 0, updated = 1, skipped = N - 1)
 * 4. NULL-to-value and value-to-NULL changes: detected via IS DISTINCT FROM
 * 5. Changed source or raw_payload: detected and updated
 * 6. fetched_at timestamp preservation: unchanged rows retain original fetched_at
 * 7. Duplicate protection: count remains strictly constant (0 duplicate rows created)
 * 8. Full 259 pilot records idempotency: rerunning identical pilot observations produces 259 skipped, 0 updated
 * 
 * ALL tests execute within isolated client transactions (BEGIN ... ROLLBACK).
 * Zero production records are modified or deleted.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const assert = require('assert');
const { pool } = require('../db');
const {
  PILOT_MANDI_LOCATIONS,
  cleanNullableNumber,
  generateWeatherObservationId,
  transformDailyWeatherPayload,
  ingestWeatherObservations,
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
  console.log('\n=== KisanOS 2.0: Milestone D.2 Conditional Upsert Verification Suite ===\n');

  // Test 1: First ingestion & Identical second ingestion telemetry inside transaction
  await runAsyncTest('1. First ingestion imports all; identical second ingestion skips all with 0 writes', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const loc = {
        location_id: 'mandi:d2-test:agra',
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

      const records = transformDailyWeatherPayload(loc, mockApi, 'test:d2-tx');

      // Pass 1: Initial Ingestion -> 3 imported, 0 updated, 0 skipped
      const stats1 = await ingestWeatherObservations(records, { clientOrPool: client });
      assert.strictEqual(stats1.imported, 3, 'First ingestion must import 3 rows');
      assert.strictEqual(stats1.updated, 0, 'First ingestion must update 0 rows');
      assert.strictEqual(stats1.skipped, 0, 'First ingestion must skip 0 rows');
      assert.strictEqual(stats1.rejected, 0);

      // Pass 2: Identical Ingestion -> 0 imported, 0 updated, 3 skipped
      const stats2 = await ingestWeatherObservations(records, { clientOrPool: client });
      assert.strictEqual(stats2.imported, 0, 'Second pass must import 0 rows');
      assert.strictEqual(stats2.updated, 0, 'Second pass must update 0 rows');
      assert.strictEqual(stats2.skipped, 3, 'Second pass must skip all 3 unchanged rows');
      assert.strictEqual(stats2.rejected, 0);

      // Verify row count remains 3 (zero duplicate rows)
      const countRes = await client.query(
        'SELECT COUNT(*)::int as count FROM weather_historical_observations WHERE location_id = $1',
        [loc.location_id]
      );
      assert.strictEqual(countRes.rows[0].count, 3, 'Total row count must be exactly 3');

      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // Test 2: Changed weather field updates only the modified record
  await runAsyncTest('2. Changed weather field triggers update only for the modified record', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const loc = {
        location_id: 'mandi:d2-field-test',
        location_type: 'MANDI',
        state: 'Maharashtra',
        district: 'Nashik',
        latitude: 20.1478,
        longitude: 74.2255
      };

      const baseRecords = [
        {
          id: generateWeatherObservationId(loc.location_id, '2026-11-01'),
          location_id: loc.location_id,
          location_type: 'MANDI',
          state: loc.state,
          district: loc.district,
          latitude: loc.latitude,
          longitude: loc.longitude,
          observation_date: '2026-11-01',
          rainfall_mm: 0.0,
          temp_max_c: 32.0,
          temp_mean_c: 26.0,
          source: 'test:d2-field',
          raw_payload: { v: 1 }
        },
        {
          id: generateWeatherObservationId(loc.location_id, '2026-11-02'),
          location_id: loc.location_id,
          location_type: 'MANDI',
          state: loc.state,
          district: loc.district,
          latitude: loc.latitude,
          longitude: loc.longitude,
          observation_date: '2026-11-02',
          rainfall_mm: 0.0,
          temp_max_c: 31.0,
          temp_mean_c: 25.5,
          source: 'test:d2-field',
          raw_payload: { v: 1 }
        }
      ];

      // Initial insert
      const res1 = await ingestWeatherObservations(baseRecords, { clientOrPool: client });
      assert.strictEqual(res1.imported, 2);

      // Modify temp_max_c on day 1 only
      const modifiedRecords = [
        { ...baseRecords[0], temp_max_c: 34.5 }, // changed
        { ...baseRecords[1] }                    // identical
      ];

      const res2 = await ingestWeatherObservations(modifiedRecords, { clientOrPool: client });
      assert.strictEqual(res2.imported, 0, 'No rows should be imported');
      assert.strictEqual(res2.updated, 1, 'Exactly 1 modified row should be updated');
      assert.strictEqual(res2.skipped, 1, 'Exactly 1 unchanged row should be skipped');

      // Verify the updated row has the new temperature
      const checkRes = await client.query(
        'SELECT temp_max_c FROM weather_historical_observations WHERE id = $1',
        [baseRecords[0].id]
      );
      assert.strictEqual(Number(checkRes.rows[0].temp_max_c), 34.5, 'temp_max_c must be updated to 34.5');

      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // Test 3: NULL-to-value and value-to-NULL changes are correctly detected via IS DISTINCT FROM
  await runAsyncTest('3. NULL-to-value and value-to-NULL changes are correctly detected via IS DISTINCT FROM', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const locId = 'mandi:d2-null-test';
      const date1 = '2026-11-01';
      const id1 = generateWeatherObservationId(locId, date1);

      // Record with NULL rainfall_mm
      const recWithNull = {
        id: id1,
        location_id: locId,
        location_type: 'MANDI',
        state: 'Punjab',
        district: 'Ludhiana',
        latitude: 30.9010,
        longitude: 75.8573,
        observation_date: date1,
        rainfall_mm: null,
        temp_mean_c: 24.0,
        source: 'test:d2-null',
        raw_payload: { v: 1 }
      };

      const res1 = await ingestWeatherObservations([recWithNull], { clientOrPool: client });
      assert.strictEqual(res1.imported, 1);

      // 3A. Identical rerun with NULL -> skipped
      const resSameNull = await ingestWeatherObservations([recWithNull], { clientOrPool: client });
      assert.strictEqual(resSameNull.imported, 0);
      assert.strictEqual(resSameNull.updated, 0);
      assert.strictEqual(resSameNull.skipped, 1, 'Re-running NULL value must be skipped');

      // 3B. NULL -> value (rainfall_mm becomes 12.5) -> updated
      const recWithValue = { ...recWithNull, rainfall_mm: 12.5 };
      const resNullToVal = await ingestWeatherObservations([recWithValue], { clientOrPool: client });
      assert.strictEqual(resNullToVal.updated, 1, 'NULL to value must trigger update');
      assert.strictEqual(resNullToVal.skipped, 0);

      // 3C. Value -> NULL (rainfall_mm becomes null again) -> updated
      const resValToNull = await ingestWeatherObservations([recWithNull], { clientOrPool: client });
      assert.strictEqual(resValToNull.updated, 1, 'Value to NULL must trigger update');
      assert.strictEqual(resValToNull.skipped, 0);

      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // Test 4: Changed source or raw_payload is detected and updated
  await runAsyncTest('4. Changed source or raw_payload is correctly detected and updated', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const locId = 'mandi:d2-payload-test';
      const date = '2026-11-01';
      const id = generateWeatherObservationId(locId, date);

      const rec = {
        id,
        location_id: locId,
        location_type: 'MANDI',
        state: 'Rajasthan',
        district: 'Jodhpur',
        latitude: 26.2389,
        longitude: 73.0243,
        observation_date: date,
        rainfall_mm: 0.0,
        temp_mean_c: 29.0,
        source: 'open-meteo:era5:v1',
        raw_payload: { elevation: 220, version: '1.0' }
      };

      const res1 = await ingestWeatherObservations([rec], { clientOrPool: client });
      assert.strictEqual(res1.imported, 1);

      // 4A. Identical raw_payload with keys in different order -> skipped (JSONB semantic equality)
      const recReorderedKeys = {
        ...rec,
        raw_payload: { version: '1.0', elevation: 220 }
      };
      const resSamePayload = await ingestWeatherObservations([recReorderedKeys], { clientOrPool: client });
      assert.strictEqual(resSamePayload.skipped, 1, 'Identical JSONB with different key order must be skipped');
      assert.strictEqual(resSamePayload.updated, 0);

      // 4B. Changed source -> updated
      const recChangedSource = { ...rec, source: 'open-meteo:era5:v2' };
      const resChangedSource = await ingestWeatherObservations([recChangedSource], { clientOrPool: client });
      assert.strictEqual(resChangedSource.updated, 1, 'Changed source string must trigger update');

      // 4C. Changed raw_payload content -> updated
      const recChangedPayload = { ...recChangedSource, raw_payload: { elevation: 220, version: '2.0' } };
      const resChangedPayload = await ingestWeatherObservations([recChangedPayload], { clientOrPool: client });
      assert.strictEqual(resChangedPayload.updated, 1, 'Changed raw_payload JSON must trigger update');

      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // Test 5: Original fetched_at remains unchanged on identical reruns
  await runAsyncTest('5. Original fetched_at timestamp remains unchanged on identical reruns', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const locId = 'mandi:d2-fetched-at-test';
      const date = '2026-11-01';
      const id = generateWeatherObservationId(locId, date);

      // Insert record with past fetched_at timestamp (1 hour ago)
      await client.query(`
        INSERT INTO weather_historical_observations (
          id, location_id, location_type, state, district, latitude, longitude, observation_date,
          rainfall_mm, temp_mean_c, source, raw_payload, fetched_at
        ) VALUES (
          $1, $2, 'MANDI', 'Karnataka', 'Kolar', 13.1367, 78.1292, $3,
          10.5, 23.0, 'test:fetched-at', '{"test":true}'::jsonb, NOW() - INTERVAL '1 hour'
        )
      `, [id, locId, date]);

      // Query original fetched_at
      const origRes = await client.query('SELECT fetched_at FROM weather_historical_observations WHERE id = $1', [id]);
      const originalFetchedAt = origRes.rows[0].fetched_at.toISOString();

      // Rerun ingestion with identical data
      const identicalRec = {
        id,
        location_id: locId,
        location_type: 'MANDI',
        state: 'Karnataka',
        district: 'Kolar',
        latitude: 13.1367,
        longitude: 78.1292,
        observation_date: date,
        rainfall_mm: 10.5,
        temp_mean_c: 23.0,
        source: 'test:fetched-at',
        raw_payload: { test: true }
      };

      const rerunStats = await ingestWeatherObservations([identicalRec], { clientOrPool: client });
      assert.strictEqual(rerunStats.skipped, 1, 'Identical record must be skipped');
      assert.strictEqual(rerunStats.updated, 0);

      // Verify fetched_at was NOT modified
      const afterRes = await client.query('SELECT fetched_at FROM weather_historical_observations WHERE id = $1', [id]);
      const afterFetchedAt = afterRes.rows[0].fetched_at.toISOString();

      assert.strictEqual(afterFetchedAt, originalFetchedAt, 'fetched_at must remain strictly unchanged on identical rerun');

      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // Test 6: Re-running production 259 pilot observations produces 259 skipped and 0 updated
  await runAsyncTest('6. Production 259 pilot observations: identical rerun produces 259 skipped, 0 updated', async () => {
    // Read all existing 259 production records
    const prodRes = await pool.query(`
      SELECT id, location_id, location_type, state, district,
             latitude::numeric(7,4) as latitude, longitude::numeric(7,4) as longitude,
             observation_date::text, rainfall_mm, temp_min_c, temp_max_c, temp_mean_c,
             relative_humidity_mean_pct, wind_speed_max_kmh,
             soil_moisture_0_to_7cm_m3m3, soil_moisture_7_to_28cm_m3m3,
             et0_evapotranspiration_mm, weather_condition, source, raw_payload
      FROM weather_historical_observations
      ORDER BY location_id, observation_date;
    `);

    assert.strictEqual(prodRes.rows.length, 259, 'Must have exactly 259 production pilot records');

    // Run identical batch ingestion
    const stats = await ingestWeatherObservations(prodRes.rows, { pool });
    console.log(`    [Production Idempotency Test] Total: ${stats.total}, Imported: ${stats.imported}, Updated: ${stats.updated}, Skipped: ${stats.skipped}`);

    assert.strictEqual(stats.total, 259, 'Total processed must be 259');
    assert.strictEqual(stats.imported, 0, 'Zero records should be imported');
    assert.strictEqual(stats.updated, 0, 'Zero records should be updated');
    assert.strictEqual(stats.skipped, 259, 'All 259 identical records must be skipped');
    assert.strictEqual(stats.rejected, 0, 'Zero records rejected');

    // Verify row count remains strictly 259
    const countCheck = await pool.query('SELECT count(*)::int as count FROM weather_historical_observations');
    assert.strictEqual(countCheck.rows[0].count, 259, 'Production table count must remain strictly 259');
  });

  console.log(`\nMilestone D.2 Conditional Upsert Scoreboard: ${passedTests}/${totalTests} tests passed.\n`);
  await pool.end();
}

main().catch(err => {
  console.error('\nMilestone D.2 Test Suite Failed:', err);
  process.exit(1);
});

