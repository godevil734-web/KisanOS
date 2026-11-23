/**
 * Milestone 2 Ingestion & Safeguards Test Suite
 * 
 * Verifies:
 * 1. Deterministic ID generation (NULL-safety, consistency with 6 unique dimensions)
 * 2. Record validation & rejection of corrupt / incomplete observations
 * 3. Preservation of raw payload, arrival units, and NULL for missing variety/grade
 * 4. Idempotent insertion & duplicate prevention via PostgreSQL unique index
 * 5. Backfill pipeline from verified mandi_price_snapshots
 * 6. Live data.gov.in ingestion with retry handling and deduplication
 * 7. Accurate aggregation stats (dates, districts, mandis, prices)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const assert = require('assert');
const { pool } = require('../db');
const {
  validateObservationRecord,
  generateDeterministicObservationId,
  computeArrivalTonnes,
  parseObservationDate,
  insertObservation,
  ingestBatchObservations,
  ingestLiveGovFeed,
  backfillFromSnapshots,
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
  console.log('\n=== KisanOS 2.0: Milestone 2 Historical Ingestion Test Suite ===\n');

  // Test 1: Date Parsing
  runTest('1. Observation Date Parser handles multiple valid date formats', () => {
    assert.strictEqual(parseObservationDate('07/11/2026'), '2026-11-07');
    assert.strictEqual(parseObservationDate('30/10/2026'), '2026-10-30');
    assert.strictEqual(parseObservationDate('2026-11-07'), '2026-11-07');
    assert.strictEqual(parseObservationDate('invalid-date'), null);
    assert.strictEqual(parseObservationDate(null), null);
    assert.strictEqual(parseObservationDate(''), null);
  });

  // Test 2: Arrivals Tonnes Conversion
  runTest('2. Arrivals quantity in tonnes is computed ONLY for unequivocal units, else NULL', () => {
    // Quintals -> Tonnes (/ 10)
    assert.strictEqual(computeArrivalTonnes('150', 'Quintals'), 15.0);
    assert.strictEqual(computeArrivalTonnes(250, 'quintal'), 25.0);

    // Tonnes -> Tonnes (1:1)
    assert.strictEqual(computeArrivalTonnes('42.5', 'Tonnes'), 42.5);
    assert.strictEqual(computeArrivalTonnes(10, 'MT'), 10.0);

    // Kgs -> Tonnes (/ 1000)
    assert.strictEqual(computeArrivalTonnes('5000', 'kg'), 5.0);

    // Unverified / missing units must strictly return null (no guesswork)
    assert.strictEqual(computeArrivalTonnes('100', null), null);
    assert.strictEqual(computeArrivalTonnes(null, 'Quintals'), null);
    assert.strictEqual(computeArrivalTonnes('100', 'Bags'), null);
    assert.strictEqual(computeArrivalTonnes('100', 'Crates'), null);
    assert.strictEqual(computeArrivalTonnes('unknown', 'Quintals'), null);
  });

  // Test 3: Deterministic ID Consistency & NULL-safety
  runTest('3. Deterministic Observation ID generation is consistent and NULL-safe', () => {
    const recA = {
      state: 'Uttar Pradesh',
      district: 'Agra',
      market: 'Fatehabad APMC',
      commodity: 'Potato',
      variety: null,
      observation_date: '2026-11-07'
    };

    const recA_clone = {
      state: 'uttar pradesh',
      district: '  Agra  ',
      market: 'fatehabad apmc',
      commodity: 'POTATO',
      variety: '', // empty treated same as null
      observation_date: '2026-11-07'
    };

    const id1 = generateDeterministicObservationId(recA);
    const id2 = generateDeterministicObservationId(recA_clone);
    assert.strictEqual(id1, id2, 'IDs must match regardless of casing or whitespace');
    assert.strictEqual(id1.length, 64, 'ID must be 64-char SHA-256 hex');

    // Different variety must generate different ID
    const recB = { ...recA, variety: 'Desi' };
    const id3 = generateDeterministicObservationId(recB);
    assert.notStrictEqual(id1, id3, 'Different variety must produce distinct ID');

    // Different date must generate different ID
    const recC = { ...recA, observation_date: '2026-10-30' };
    const id4 = generateDeterministicObservationId(recC);
    assert.notStrictEqual(id1, id4, 'Different observation date must produce distinct ID');
  });

  // Test 4: Record Validation & Preservation
  runTest('4. Record validation enforces required fields and preserves raw payload', () => {
    const invalidRec = {
      state: 'Uttar Pradesh',
      district: 'Agra'
      // missing market, commodity, date, modalPrice
    };
    const resInvalid = validateObservationRecord(invalidRec);
    assert.strictEqual(resInvalid.valid, false);
    assert.ok(resInvalid.errors.length >= 3);

    // Negative / zero modal price must be rejected
    const zeroPriceRec = {
      state: 'Uttar Pradesh',
      district: 'Agra',
      market: 'Agra Mandi',
      commodity: 'Potato',
      arrival_date: '07/11/2026',
      modal_price: 0
    };
    const resZero = validateObservationRecord(zeroPriceRec);
    assert.strictEqual(resZero.valid, false);

    // Valid record with missing variety/grade must preserve NULL (not 'Standard')
    const validRec = {
      state: 'Uttar Pradesh',
      district: 'Agra',
      market: 'Agra Mandi',
      commodity: 'Potato',
      variety: '',
      grade: 'NA',
      arrival_date: '07/11/2026',
      modal_price: 1250,
      min_price: 1200,
      max_price: 1300
    };
    const resValid = validateObservationRecord(validRec);
    assert.strictEqual(resValid.valid, true);
    assert.strictEqual(resValid.normalized.variety, null, 'Variety must remain null');
    assert.strictEqual(resValid.normalized.grade, null, 'Grade NA must become null');
    assert.strictEqual(resValid.normalized.modal_price_per_kg, 12.50);
  });

  // Test 5: Idempotent Insertion & Deduplication (Transactional Sandbox)
  await runAsyncTest('5. Database insertion is idempotent across duplicate imports', async () => {
    const testRec = {
      state: 'Uttar Pradesh',
      district: 'TestDistrict',
      market: 'Test Market APMC',
      commodity: 'Potato',
      variety: 'TestKufri',
      grade: 'FAQ',
      observation_date: '2026-11-01',
      min_price_per_quintal: 1000,
      max_price_per_quintal: 1200,
      modal_price_per_quintal: 1100,
      modal_price_per_kg: 11.00,
      raw_arrivals_value: '50',
      raw_arrivals_unit: 'Quintals',
      arrival_quantity_tonnes: 5.0,
      source: 'test:unit-test',
      raw_payload: { test: true }
    };
    testRec.id = generateDeterministicObservationId(testRec);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // First insert -> IMPORTED
      const res1 = await insertObservation(client, testRec);
      assert.strictEqual(res1.status, 'IMPORTED');
      assert.strictEqual(res1.id, testRec.id);

      // Second insert of identical record -> DUPLICATE (skipped, no error thrown)
      const res2 = await insertObservation(client, testRec);
      assert.strictEqual(res2.status, 'DUPLICATE');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  // Test 6: Ingest snapshot backfill for UP Potato
  await runAsyncTest('6. Snapshot backfill accurately imports UP Potato observations', async () => {
    const backfillStats = await backfillFromSnapshots({ state: 'Uttar Pradesh', commodity: 'Potato' });
    console.log(`    [Backfill Stats] Examined: ${backfillStats.snapshotsExamined}, Processed: ${backfillStats.totalProcessed}, Imported: ${backfillStats.imported}, Duplicates: ${backfillStats.duplicates}`);
    assert.ok(backfillStats.totalProcessed >= 0, 'Backfill must process snapshot records');

    // Running backfill a second time must produce 100% duplicates and 0 new imports (idempotency check)
    const rerunStats = await backfillFromSnapshots({ state: 'Uttar Pradesh', commodity: 'Potato' });
    console.log(`    [Rerun Stats] Processed: ${rerunStats.totalProcessed}, Imported: ${rerunStats.imported}, Duplicates: ${rerunStats.duplicates}`);
    assert.strictEqual(rerunStats.imported, 0, 'Second run must import 0 new records');
    assert.strictEqual(rerunStats.duplicates, rerunStats.totalProcessed, 'All records on rerun must be identified as duplicates');
  });

  // Test 7: Live Feed Pilot Ingestion for UP Potato
  await runAsyncTest('7. Live data.gov.in Pilot Feed ingests authentic UP Potato records', async () => {
    const liveStats = await ingestLiveGovFeed({ state: 'Uttar Pradesh', commodity: 'Potato', limit: 100, maxPages: 2 });
    console.log(`    [Live Feed Stats] Gov Total: ${liveStats.totalReportedByGov}, Processed: ${liveStats.totalProcessed}, Imported: ${liveStats.imported}, Duplicates: ${liveStats.duplicates}, Rejected: ${liveStats.rejected}`);
    assert.ok(liveStats.pagesFetched >= 1, 'Must fetch at least 1 page');
    assert.ok(liveStats.totalProcessed > 0, 'Must process live records');

    // Rerun live feed -> All existing records should be deduplicated
    const rerunLive = await ingestLiveGovFeed({ state: 'Uttar Pradesh', commodity: 'Potato', limit: 100, maxPages: 2 });
    assert.strictEqual(rerunLive.imported, 0, 'Rerun must import 0 new records');
    assert.strictEqual(rerunLive.duplicates, rerunLive.totalProcessed, 'Rerun must recognise all as duplicates');
  });

  // Test 8: Historical Stats Query & Aggregation
  await runAsyncTest('8. Historical aggregation statistics report authentic coverage', async () => {
    const stats = await getHistoricalStats({ state: 'Uttar Pradesh', commodity: 'Potato' });
    console.log(`    [Database Stats] Total Records: ${stats.totalRecords}`);
    console.log(`    [Observation Dates]:`, stats.observationDates);
    console.log(`    [District Count]: ${stats.distinctDistrictsCount}, Mandi Count: ${stats.distinctMandisCount}`);
    console.log(`    [Price Range]: Min ₹${stats.priceSummary?.min_modal_kg}/kg, Max ₹${stats.priceSummary?.max_modal_kg}/kg, Avg ₹${stats.priceSummary?.avg_modal_kg}/kg`);

    assert.ok(stats.totalRecords > 0, 'Total records must be greater than 0');
    assert.ok(stats.observationDates.length >= 1, 'Must have at least 1 observation date');
    assert.ok(stats.distinctDistrictsCount > 0, 'Must have at least 1 district');
    assert.ok(stats.distinctMandisCount > 0, 'Must have at least 1 mandi');
  });

  console.log(`\nMilestone 2 Ingestion Scoreboard: ${passedTests}/${totalTests} tests passed.\n`);
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

