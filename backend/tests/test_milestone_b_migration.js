/**
 * Milestone B: Weather & Disaster Alert Migration Test Suite
 * 
 * Verifies:
 * 1. Schema integrity for weather_historical_observations, weather_forecast_records, weather_disaster_alerts
 * 2. Strict nullability verification (NO DEFAULT 0 on measured weather fields)
 * 3. Canonical unique constraints: (location_id, observation_date)
 * 4. Coordinate independence (multiple location IDs sharing GPS coordinates without collision)
 * 5. Idempotent insertion and duplicate protection via ON CONFLICT
 * 6. Segregated forecast records preserving forecast_issued_at vs target_timestamp
 * 7. Official disaster alerts deduplication on (source_agency, source_alert_id)
 * 8. Supabase RLS policy verification & FARM_FIELD privacy protections
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const assert = require('assert');
const crypto = require('crypto');
const { pool } = require('../db');

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
  console.log('\n=== KisanOS 2.0: Milestone B Weather Database Migration Verification ===\n');

  // Test 1: Verify all 3 tables exist in public schema
  await runAsyncTest('1. PostgreSQL tables created: weather_historical, weather_forecast, weather_alerts', async () => {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('weather_historical_observations', 'weather_forecast_records', 'weather_disaster_alerts')
      ORDER BY table_name;
    `);
    const tables = res.rows.map(r => r.table_name);
    assert.strictEqual(tables.length, 3, 'All 3 tables must exist');
    assert.ok(tables.includes('weather_historical_observations'));
    assert.ok(tables.includes('weather_forecast_records'));
    assert.ok(tables.includes('weather_disaster_alerts'));
  });

  // Test 2: Verify measured weather fields have NO DEFAULT 0 (NULL = unmeasured, 0 = measured zero)
  await runAsyncTest('2. Strict nullability: rainfall_mm and measured fields have NO DEFAULT 0', async () => {
    const res = await pool.query(`
      SELECT column_name, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'weather_historical_observations'
        AND column_name IN ('rainfall_mm', 'temp_min_c', 'temp_max_c', 'temp_mean_c', 'relative_humidity_mean_pct', 'soil_moisture_0_to_7cm_m3m3');
    `);
    
    for (const col of res.rows) {
      assert.strictEqual(col.is_nullable, 'YES', `${col.column_name} must be nullable`);
      assert.strictEqual(col.column_default, null, `${col.column_name} must NOT have a default value`);
      assert.ok(!String(col.column_default).includes('0'), `${col.column_name} must NOT default to 0`);
    }
  });

  // Test 3: Verify Unique Constraints and Indexes
  await runAsyncTest('3. Canonical unique constraints exist on location_id + date (coordinates are non-unique)', async () => {
    const indexesRes = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'weather_historical_observations';
    `);
    const indexDefs = indexesRes.rows.map(r => r.indexdef);
    
    // Check canonical unique index on (location_id, observation_date)
    const hasLocDateUnique = indexDefs.some(def => 
      def.includes('UNIQUE') && def.includes('location_id') && def.includes('observation_date')
    );
    assert.ok(hasLocDateUnique, 'Must have UNIQUE index on (location_id, observation_date)');

    // Ensure coordinates are NOT part of a unique constraint (permits distinct entities to share coordinates)
    const hasCoordUnique = indexDefs.some(def => 
      def.includes('UNIQUE') && def.includes('latitude') && def.includes('longitude')
    );
    assert.strictEqual(hasCoordUnique, false, 'Coordinates must NOT be a unique constraint');
  });

  // Test 4: Coordinate Independence Test
  // Two distinct location IDs (e.g. mandi vs nearby farm field) sharing identical coordinates must NOT collide
  await runAsyncTest('4. Coordinate Independence: Multiple location IDs sharing GPS coordinates insert safely', async () => {
    const date = '2026-11-01';
    const sharedLat = 27.1800;
    const sharedLon = 78.0100;

    const mandiLocId = 'mandi:agra-imperial-test';
    const farmLocId = 'field:farmer-sharma-test-p1';

    const mandiId = crypto.createHash('sha256').update(`${mandiLocId.toLowerCase()}::${date}`).digest('hex');
    const farmId = crypto.createHash('sha256').update(`${farmLocId.toLowerCase()}::${date}`).digest('hex');

    // Clean up any test rows
    await pool.query('DELETE FROM weather_historical_observations WHERE id IN ($1, $2)', [mandiId, farmId]);

    // Insert Mandi weather observation
    const resMandi = await pool.query(`
      INSERT INTO weather_historical_observations (
        id, location_id, location_type, state, district, latitude, longitude, observation_date,
        rainfall_mm, temp_min_c, temp_max_c, temp_mean_c, relative_humidity_mean_pct,
        wind_speed_max_kmh, soil_moisture_0_to_7cm_m3m3, source, raw_payload
      ) VALUES ($1, $2, 'MANDI', 'Uttar Pradesh', 'Agra', $3, $4, $5, 0.00, 18.5, 32.0, 25.2, 55.0, 12.0, 0.125, 'test:mandi-test', '{}'::jsonb)
      ON CONFLICT (location_id, observation_date) DO NOTHING
      RETURNING id;
    `, [mandiId, mandiLocId, sharedLat, sharedLon, date]);
    assert.strictEqual(resMandi.rows.length, 1, 'Mandi weather must insert');

    // Insert Farm Field weather observation sharing the same exact lat/lon
    const resFarm = await pool.query(`
      INSERT INTO weather_historical_observations (
        id, location_id, location_type, state, district, latitude, longitude, observation_date,
        rainfall_mm, temp_min_c, temp_max_c, temp_mean_c, relative_humidity_mean_pct,
        wind_speed_max_kmh, soil_moisture_0_to_7cm_m3m3, source, raw_payload
      ) VALUES ($1, $2, 'FARM_FIELD', 'Uttar Pradesh', 'Agra', $3, $4, $5, 0.00, 18.5, 32.0, 25.2, 55.0, 12.0, 0.142, 'test:farm-test', '{}'::jsonb)
      ON CONFLICT (location_id, observation_date) DO NOTHING
      RETURNING id;
    `, [farmId, farmLocId, sharedLat, sharedLon, date]);
    assert.strictEqual(resFarm.rows.length, 1, 'Farm Field sharing coordinates must insert without conflict');

    // Deduplication test: re-inserting Mandi weather must DO NOTHING (duplicate skipped)
    const resDup = await pool.query(`
      INSERT INTO weather_historical_observations (
        id, location_id, location_type, state, district, latitude, longitude, observation_date,
        rainfall_mm, temp_min_c, temp_max_c, temp_mean_c, relative_humidity_mean_pct,
        wind_speed_max_kmh, soil_moisture_0_to_7cm_m3m3, source, raw_payload
      ) VALUES ($1, $2, 'MANDI', 'Uttar Pradesh', 'Agra', $3, $4, $5, 0.00, 18.5, 32.0, 25.2, 55.0, 12.0, 0.125, 'test:mandi-test', '{}'::jsonb)
      ON CONFLICT (location_id, observation_date) DO NOTHING
      RETURNING id;
    `, [mandiId, mandiLocId, sharedLat, sharedLon, date]);
    assert.strictEqual(resDup.rows.length, 0, 'Duplicate insertion must be skipped cleanly');

    // Clean up
    await pool.query('DELETE FROM weather_historical_observations WHERE id IN ($1, $2)', [mandiId, farmId]);
  });

  // Test 5: Weather Forecast Records Segregation (ML Data Leakage Guard)
  await runAsyncTest('5. Forecast Records: Accurately preserves forecast_issued_at vs target_timestamp', async () => {
    const locId = 'mandi:agra-imperial-test';
    const issuedAt = '2026-11-01T06:00:00Z';
    const targetTime = '2026-11-08T00:00:00Z'; // 7-day ahead forecast
    const horizonHours = 168; // 7 days * 24 hours

    const forecastId = crypto.createHash('sha256')
      .update(`${locId.toLowerCase()}::${issuedAt}::${targetTime}::open_meteo_forecast`)
      .digest('hex');

    await pool.query('DELETE FROM weather_forecast_records WHERE id = $1', [forecastId]);

    const res = await pool.query(`
      INSERT INTO weather_forecast_records (
        id, location_id, state, district, latitude, longitude,
        forecast_issued_at, target_timestamp, forecast_horizon_hours,
        temperature_min_c, temperature_max_c, precipitation_mm, precipitation_probability_pct,
        source, raw_payload
      ) VALUES ($1, $2, 'Uttar Pradesh', 'Agra', 27.18, 78.01, $3, $4, $5, 17.0, 31.5, 0.0, 10.0, 'open_meteo_forecast', '{}'::jsonb)
      ON CONFLICT (location_id, forecast_issued_at, target_timestamp, source) DO NOTHING
      RETURNING id;
    `, [forecastId, locId, issuedAt, targetTime, horizonHours]);

    assert.strictEqual(res.rows.length, 1, 'Forecast record must insert');

    // Duplicate test
    const resDup = await pool.query(`
      INSERT INTO weather_forecast_records (
        id, location_id, state, district, latitude, longitude,
        forecast_issued_at, target_timestamp, forecast_horizon_hours,
        temperature_min_c, temperature_max_c, precipitation_mm, precipitation_probability_pct,
        source, raw_payload
      ) VALUES ($1, $2, 'Uttar Pradesh', 'Agra', 27.18, 78.01, $3, $4, $5, 17.0, 31.5, 0.0, 10.0, 'open_meteo_forecast', '{}'::jsonb)
      ON CONFLICT (location_id, forecast_issued_at, target_timestamp, source) DO NOTHING
      RETURNING id;
    `, [forecastId, locId, issuedAt, targetTime, horizonHours]);
    assert.strictEqual(resDup.rows.length, 0, 'Duplicate forecast must be safely skipped');

    // Clean up
    await pool.query('DELETE FROM weather_forecast_records WHERE id = $1', [forecastId]);
  });

  // Test 6: Disaster Alerts Deduplication on (source_agency, source_alert_id)
  await runAsyncTest('6. Disaster Alerts: Native alert ID deduplication prevents double-counting', async () => {
    const alertId = crypto.createHash('sha256').update('IMD::TEST-ALERT-UP-2026-99').digest('hex');
    await pool.query('DELETE FROM weather_disaster_alerts WHERE id = $1', [alertId]);

    const res = await pool.query(`
      INSERT INTO weather_disaster_alerts (
        id, source_agency, source_alert_id, state, district, alert_type, severity,
        headline, description, issued_at, effective_from, effective_to, raw_payload
      ) VALUES (
        $1, 'IMD', 'TEST-ALERT-UP-2026-99', 'Uttar Pradesh', 'Agra', 'HAILSTORM', 'ORANGE_ALERT',
        'Isolated hailstorm expected in Western UP', 'Precautionary advisory for standing potato crops',
        NOW(), NOW(), NOW() + INTERVAL '24 hours', '{}'::jsonb
      )
      ON CONFLICT (source_agency, source_alert_id) DO NOTHING
      RETURNING id;
    `, [alertId]);
    assert.strictEqual(res.rows.length, 1, 'Alert must insert');

    // Duplicate alert
    const resDup = await pool.query(`
      INSERT INTO weather_disaster_alerts (
        id, source_agency, source_alert_id, state, district, alert_type, severity,
        headline, description, issued_at, effective_from, effective_to, raw_payload
      ) VALUES (
        $1, 'IMD', 'TEST-ALERT-UP-2026-99', 'Uttar Pradesh', 'Agra', 'HAILSTORM', 'ORANGE_ALERT',
        'Isolated hailstorm expected in Western UP', 'Precautionary advisory for standing potato crops',
        NOW(), NOW(), NOW() + INTERVAL '24 hours', '{}'::jsonb
      )
      ON CONFLICT (source_agency, source_alert_id) DO NOTHING
      RETURNING id;
    `, [alertId]);
    assert.strictEqual(resDup.rows.length, 0, 'Duplicate alert must be safely skipped');

    // Clean up
    await pool.query('DELETE FROM weather_disaster_alerts WHERE id = $1', [alertId]);
  });

  // Test 7: Row Level Security Policies
  await runAsyncTest('7. Supabase RLS: Policies are enabled with FARM_FIELD privacy restrictions', async () => {
    const policiesRes = await pool.query(`
      SELECT tablename, policyname, roles::text[] as roles, cmd, qual
      FROM pg_policies
      WHERE tablename IN ('weather_historical_observations', 'weather_forecast_records', 'weather_disaster_alerts')
      ORDER BY tablename, policyname;
    `);

    console.log(`    [RLS Policies Verified]: ${policiesRes.rows.length} policies registered across weather tables.`);
    
    // Check that write policies are restricted to service_role
    const writePolicies = policiesRes.rows.filter(p => p.policyname.includes('Service role write'));
    assert.strictEqual(writePolicies.length, 3, 'All 3 tables must have exclusive service_role write policies');

    // Check that public read filters out private farm fields
    const publicHistRead = policiesRes.rows.find(p => p.policyname === 'Public read public weather locations');
    assert.ok(publicHistRead, 'Public read policy on weather_historical must exist');
    assert.ok(publicHistRead.qual.includes('MANDI'), 'Public policy must permit MANDI');
    assert.ok(!publicHistRead.qual.includes('FARM_FIELD'), 'Public policy must NOT permit unrestricted FARM_FIELD');
  });

  console.log(`\nMilestone B Verification Scoreboard: ${passedTests}/${totalTests} tests passed.\n`);
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Test Suite Failed:', err);
    await pool.end();
    process.exit(1);
  });
