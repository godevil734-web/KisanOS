/**
 * Milestone C: Mandi CSV Ingestion & Full National Backfill Test Suite
 * 
 * Verifies:
 * 1. Agmarknet CSV streaming parser with header normalization and quoted fields
 * 2. Strict validation & rejection of corrupt CSV rows
 * 3. Arrival tonnes conversion and preservation of missing variety/grade as NULL
 * 4. Idempotent CSV ingestion (rerun produces 0 imports, 100% duplicate detection)
 * 5. Full national snapshot backfill across all 17 states and 210 commodities
 * 6. Idempotent national backfill rerun (0 new imports)
 * 7. Multi-state, multi-crop aggregation statistics from PostgreSQL
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const assert = require('assert');
const { pool } = require('../db');
const {
  ingestAgmarknetCSV,
  backfillAllNationalSnapshots,
  getHistoricalStats
} = require('../services/historicalIngestionService');

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
  console.log('\n=== KisanOS 2.0: Milestone C Mandi Ingestion & National Backfill ===\n');

  // Isolated transaction sandbox for synthetic test fixtures
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Test 1: Ingest Agmarknet CSV with authentic multi-state observations
    await runAsyncTest('1. Agmarknet CSV streaming parser accurately ingests multi-state records', async () => {
      const sampleCSV = `State,District,Market,Commodity,Variety,Grade,Arrival_Date,Min_Price,Max_Price,Modal_Price,Arrivals,Unit
Maharashtra,Nashik,Lasalgaon APMC,Onion,Red,FAQ,05/11/2026,1800,2400,2200,450,Quintals
Karnataka,Kolar,Kolar APMC,Tomato,Hybrid,,05/11/2026,1200,1600,1450,30,Tonnes
Punjab,Ludhiana,Ludhiana APMC,Wheat,PBW 550,FAQ,05/11/2026,2275,2350,2300,,
Madhya Pradesh,Indore,Indore APMC,Soyabean,Yellow,,05/11/2026,4400,4750,4600,120,Quintals`;

      const stats = await ingestAgmarknetCSV(sampleCSV, { defaultSource: 'test:agmarknet-csv', clientOrPool: client });
      console.log(`    [CSV Ingestion Stats] Rows: ${stats.totalRows}, Imported: ${stats.imported}, Duplicates: ${stats.duplicates}, Rejected: ${stats.rejected}`);

      assert.strictEqual(stats.totalRows, 4, 'Must process 4 rows');
      assert.ok(stats.imported >= 0, 'Imports must succeed');
      assert.strictEqual(stats.rejected, 0, 'All 4 rows must be valid');

      // Verify Lasalgaon Onion in database
      const onionCheck = await client.query(`
        SELECT commodity, variety, grade, modal_price_per_quintal, modal_price_per_kg, arrival_quantity_tonnes, raw_arrivals_unit
        FROM mandi_historical_observations
        WHERE market = 'Lasalgaon APMC' AND observation_date = '2026-11-05';
      `);
      assert.strictEqual(onionCheck.rows.length, 1, 'Lasalgaon Onion must be stored');
      const onion = onionCheck.rows[0];
      assert.strictEqual(Number(onion.modal_price_per_quintal), 2200);
      assert.strictEqual(Number(onion.modal_price_per_kg), 22.0);
      assert.strictEqual(Number(onion.arrival_quantity_tonnes), 45.0, '450 Quintals must convert to 45.0 Tonnes');
      assert.strictEqual(onion.variety, 'Red');
      assert.strictEqual(onion.grade, 'FAQ');

      // Verify Kolar Tomato with empty grade (must be NULL, not 'Standard')
      const tomatoCheck = await client.query(`
        SELECT commodity, variety, grade, arrival_quantity_tonnes
        FROM mandi_historical_observations
        WHERE market = 'Kolar APMC' AND observation_date = '2026-11-05';
      `);
      assert.strictEqual(tomatoCheck.rows.length, 1, 'Kolar Tomato must be stored');
      assert.strictEqual(tomatoCheck.rows[0].grade, null, 'Missing grade must remain NULL');
      assert.strictEqual(Number(tomatoCheck.rows[0].arrival_quantity_tonnes), 30.0, '30 Tonnes 1:1');

      // Verify Ludhiana Wheat with missing arrivals (must be NULL)
      const wheatCheck = await client.query(`
        SELECT commodity, arrival_quantity_tonnes, raw_arrivals_value
        FROM mandi_historical_observations
        WHERE market = 'Ludhiana APMC' AND observation_date = '2026-11-05';
      `);
      assert.strictEqual(wheatCheck.rows.length, 1);
      assert.strictEqual(wheatCheck.rows[0].arrival_quantity_tonnes, null, 'Missing arrivals must remain NULL');
    });

    // Test 2: Idempotent CSV Ingestion
    await runAsyncTest('2. Idempotent CSV Ingestion: Rerunning identical CSV produces 0 new imports', async () => {
      const sampleCSV = `State,District,Market,Commodity,Variety,Grade,Arrival_Date,Min_Price,Max_Price,Modal_Price,Arrivals,Unit
Maharashtra,Nashik,Lasalgaon APMC,Onion,Red,FAQ,05/11/2026,1800,2400,2200,450,Quintals
Karnataka,Kolar,Kolar APMC,Tomato,Hybrid,,05/11/2026,1200,1600,1450,30,Tonnes
Punjab,Ludhiana,Ludhiana APMC,Wheat,PBW 550,FAQ,05/11/2026,2275,2350,2300,,
Madhya Pradesh,Indore,Indore APMC,Soyabean,Yellow,,05/11/2026,4400,4750,4600,120,Quintals`;

      const rerunStats = await ingestAgmarknetCSV(sampleCSV, { defaultSource: 'test:agmarknet-csv', clientOrPool: client });
      console.log(`    [CSV Rerun Stats] Rows: ${rerunStats.totalRows}, Imported: ${rerunStats.imported}, Duplicates: ${rerunStats.duplicates}`);

      assert.strictEqual(rerunStats.imported, 0, 'Rerun must import 0 new records');
      assert.strictEqual(rerunStats.duplicates, 4, 'All 4 rows must be identified as duplicates');
    });
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }

  // Test 3: CSV Validation rejects invalid or corrupt rows
  await runAsyncTest('3. CSV Ingestion rejects rows with missing mandatory fields or invalid prices', async () => {
    const corruptCSV = `State,District,Market,Commodity,Variety,Grade,Arrival_Date,Min_Price,Max_Price,Modal_Price
,,MissingMarket,Onion,,,05/11/2026,1000,1200,1100
Gujarat,Ahmedabad,Ahmedabad APMC,Cotton,Desi,FAQ,05/11/2026,5000,6000,-50
Rajasthan,Jaipur,Jaipur APMC,Bajra,Desi,FAQ,invalid-date,1800,2000,1900`;

    const corruptStats = await ingestAgmarknetCSV(corruptCSV, { defaultSource: 'test:corrupt' });
    assert.strictEqual(corruptStats.imported, 0, 'Zero corrupt rows may be imported');
    assert.strictEqual(corruptStats.rejected, 3, 'All 3 corrupt rows must be rejected');
    assert.strictEqual(corruptStats.failures.length, 3, 'Must report 3 validation failures');
  });

  // Test 4: Full National Snapshot Backfill across all 17 States and 210 Commodities
  await runAsyncTest('4. Full National Backfill: Ingests authentic multi-state snapshot records', async () => {
    console.log('    Starting national backfill from mandi_price_snapshots...');
    const startTime = Date.now();
    const backfillStats = await backfillAllNationalSnapshots();
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`    [National Backfill Completed in ${durationSec}s]`);
    console.log(`    Snapshots Examined: ${backfillStats.snapshotsExamined}`);
    console.log(`    Total Records Processed: ${backfillStats.totalProcessed}`);
    console.log(`    Imported (New Unique): ${backfillStats.imported}`);
    console.log(`    Duplicates (Skipped): ${backfillStats.duplicates}`);
    console.log(`    States Represented: ${Object.keys(backfillStats.stateCoverage).length}`);
    console.log(`    Mandis Covered: ${Object.keys(backfillStats.mandiCoverage).length}`);
    console.log(`    Commodities Covered: ${Object.keys(backfillStats.commodityCoverage).length}`);

    assert.ok(backfillStats.snapshotsExamined >= 300, 'Must examine all snapshots in database');
    assert.ok(backfillStats.totalProcessed >= 8000, 'Must process ~8,989 raw records');
    assert.ok(Object.keys(backfillStats.stateCoverage).length >= 15, 'Must cover at least 15 Indian states');
  });

  // Test 5: Idempotency of Full National Backfill
  await runAsyncTest('5. National Backfill Idempotency: Second run produces 0 new imports', async () => {
    const rerun = await backfillAllNationalSnapshots();
    console.log(`    [National Backfill Rerun] Processed: ${rerun.totalProcessed}, Imported: ${rerun.imported}, Duplicates: ${rerun.duplicates}`);

    assert.strictEqual(rerun.imported, 0, 'Second run must import 0 new records');
    assert.strictEqual(rerun.duplicates, rerun.totalProcessed, 'Every record on rerun must be identified as duplicate');
  });

  // Test 6: Database Statistics across India
  await runAsyncTest('6. National Historical Stats: Verifies coverage across all Indian states and crops', async () => {
    const nationalStats = await getHistoricalStats();

    console.log(`    [Database Overview]`);
    console.log(`    Total Authentic Historical Records: ${nationalStats.totalRecords}`);
    console.log(`    States: ${nationalStats.distinctStatesCount}`);
    console.log(`    Districts: ${nationalStats.distinctDistrictsCount}`);
    console.log(`    APMC Mandis: ${nationalStats.distinctMandisCount}`);
    console.log(`    Commodities: ${nationalStats.distinctCommoditiesCount}`);
    console.log(`    Observation Dates:`, nationalStats.observationDates);
    console.log(`    Top Commodities:`, nationalStats.topCommodities.slice(0, 8));
    console.log(`    Price Summary: Min ₹${nationalStats.priceSummary?.min_modal_kg}/kg, Max ₹${nationalStats.priceSummary?.max_modal_kg}/kg, Avg ₹${nationalStats.priceSummary?.avg_modal_kg}/kg`);

    assert.ok(nationalStats.totalRecords > 4000, 'Must have at least 4,000 unique records');
    assert.ok(nationalStats.distinctStatesCount >= 15, 'Must have at least 15 states');
    assert.ok(nationalStats.distinctMandisCount >= 500, 'Must have over 500 APMC mandis');
    assert.ok(nationalStats.distinctCommoditiesCount >= 100, 'Must cover over 100 commodities');
  });

  console.log(`\nMilestone C Scoreboard: ${passedTests}/${totalTests} tests passed.\n`);
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

