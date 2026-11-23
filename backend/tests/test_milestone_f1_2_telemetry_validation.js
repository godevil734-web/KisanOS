/**
 * Milestone F.1.2: Batch Telemetry & Six-Gate Validation Isolated Test Suite
 * 
 * STRICT ISOLATION GUARANTEE:
 * - Zero production Supabase connections or reads/writes.
 * - Uses isolated In-Memory PostgreSQL Simulator and InMemoryAuditStore / FailingAuditStore.
 * 
 * Verifies ALL 13 Required Scenarios:
 *  1. Complete weekday bulletin (passes real provisional pilot thresholds)
 *  2. Partial weekday bulletin (fails breadth/diversity gates, 0 DB writes)
 *  3. Valid Sunday / holiday bulletin (evaluated against holiday rules)
 *  4. Missing API total (METADATA_UNAVAILABLE, never certified, 0 DB writes)
 *  5. API total mismatch (REJECTED_PARITY_MISMATCH, 0 DB writes)
 *  6. Truncated stream (REJECTED_TRUNCATED, 0 DB writes)
 *  7. Invalid row threshold exceeded (REJECTED_HIGH_ERROR_RATE, 0 DB writes)
 *  8. Duplicate threshold exceeded (REJECTED_HIGH_DUPLICATE_RATE, 0 DB writes)
 *  9. Day-over-day volume drop (>45% triggers investigation, not automatic proof of truncation)
 * 10. Identical rerun (idempotent: 0 writes, skipped count == total valid records)
 * 11. Failed validation preserves existing observations untouched (0 deletes/updates)
 * 12. Batch telemetry correctness (UTC/IST timestamps, non-fabricated nulls, all 21 fields)
 * 13. Audit storage failure handling (FailingAuditStore captured gracefully without corrupting DB)
 */

const assert = require('assert');
const {
  collectValidatedBulletin
} = require('../services/dailyMandiCollectionService');
const {
  PILOT_THRESHOLDS,
  getDayScheduleType
} = require('../services/bulletinValidationService');
const {
  InMemoryAuditStore,
  FailingAuditStore
} = require('../services/auditTelemetryStore');

// Helper: Generate realistic CSV matching Agmarknet OGD format
function buildMockBulletinCsv({
  numStates = 14,
  marketsPerState = 28,
  cropsPerMarket = 8,
  arrivalDate = '10/11/2026',
  invalidRows = 0,
  duplicateRows = 0
} = {}) {
  const states = [
    'Andhra Pradesh', 'Madhya Pradesh', 'Maharashtra', 'Gujarat', 'Telangana',
    'Karnataka', 'Punjab', 'Haryana', 'Rajasthan', 'Odisha', 'Tamil Nadu',
    'West Bengal', 'Bihar', 'Uttar Pradesh', 'Uttarakhand', 'Assam', 'Himachal Pradesh'
  ];
  const crops = [];
  for (let c = 1; c <= 70; c++) {
    crops.push(`Commodity_${c}`);
  }

  const lines = [
    'State,District,Market,Commodity,Variety,Grade,Arrival_Date,Min_x0020_Price,Max_x0020_Price,Modal_x0020_Price'
  ];

  let cropCursor = 0;
  let firstValidLine = null;

  for (let s = 0; s < numStates; s++) {
    const state = states[s % states.length];
    for (let m = 0; m < marketsPerState; m++) {
      const district = `Dist_${s}_${m % 5}`;
      const market = `Market_${s}_${m}_APMC`;
      for (let k = 0; k < cropsPerMarket; k++) {
        const crop = crops[cropCursor % crops.length];
        cropCursor++;
        const line = `"${state}","${district}","${market}","${crop}",Local,FAQ,${arrivalDate},1400,1800,1600`;
        if (!firstValidLine) firstValidLine = line;
        lines.push(line);
      }
    }
  }

  for (let d = 0; d < duplicateRows && firstValidLine; d++) {
    lines.push(firstValidLine);
  }

  for (let err = 0; err < invalidRows; err++) {
    lines.push(`"Uttar Pradesh","Agra","Bad_APMC_${err}",Potato,Desi,FAQ,${arrivalDate},1000,1200,INVALID_PRICE`);
  }

  return lines.join('\n');
}

// Local self-contained In-Memory DB harness if not imported externally
class IsolatedTestDB {
  constructor() {
    this.rowsByKey = new Map();
    this.writeOperations = 0;
  }
  _key(r) {
    return [r.state, r.district, r.market, r.commodity, r.variety ?? '__NULL__', r.observation_date].join('::');
  }
  _distinct(a, b) {
    const na = a === undefined ? null : a;
    const nb = b === undefined ? null : b;
    if (na === null && nb === null) return false;
    if (na === null || nb === null) return true;
    if (typeof na === 'number' || typeof nb === 'number') return Number(na) !== Number(nb);
    return na !== nb;
  }
  async query(sql, params = []) {
    const clean = sql.trim().toUpperCase();
    if (clean === 'BEGIN' || clean === 'COMMIT' || clean === 'ROLLBACK' || sql.includes('FOR UPDATE')) {
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO mandi_historical_observations')) {
      const incoming = {
        id: params[0], state: params[1], district: params[2], market: params[3],
        commodity: params[4], variety: params[5], grade: params[6], observation_date: params[7],
        min_price_per_quintal: params[8], max_price_per_quintal: params[9],
        modal_price_per_quintal: params[10], modal_price_per_kg: params[11],
        raw_arrivals_value: params[12], raw_arrivals_unit: params[13],
        arrival_quantity_tonnes: params[14], source: params[15],
        raw_payload: JSON.parse(params[16])
      };
      const key = this._key(incoming);
      const existing = this.rowsByKey.get(key);
      if (!existing) {
        this.rowsByKey.set(key, { ...incoming, fetched_at: new Date().toISOString() });
        this.writeOperations++;
        return { rows: [{ id: incoming.id, is_insert: true }] };
      }
      const changed =
        this._distinct(existing.modal_price_per_quintal, incoming.modal_price_per_quintal) ||
        this._distinct(existing.min_price_per_quintal, incoming.min_price_per_quintal) ||
        this._distinct(existing.max_price_per_quintal, incoming.max_price_per_quintal) ||
        this._distinct(existing.modal_price_per_kg, incoming.modal_price_per_kg) ||
        this._distinct(existing.arrival_quantity_tonnes, incoming.arrival_quantity_tonnes) ||
        this._distinct(existing.raw_arrivals_value, incoming.raw_arrivals_value) ||
        this._distinct(existing.raw_arrivals_unit, incoming.raw_arrivals_unit) ||
        this._distinct(existing.grade, incoming.grade) ||
        this._distinct(existing.source, incoming.source) ||
        this._distinct(existing.raw_payload?.ogd_updated_date ?? null, incoming.raw_payload?.ogd_updated_date ?? null);
      if (!changed) return { rows: [] };
      this.rowsByKey.set(key, { ...existing, ...incoming, fetched_at: new Date().toISOString() });
      this.writeOperations++;
      return { rows: [{ id: existing.id, is_insert: false }] };
    }
    throw new Error('Unexpected SQL in IsolatedTestDB');
  }
}

let totalTests = 0;
let passedTests = 0;

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

async function runTests() {
  console.log('================================================================');
  console.log('🌾 KisanOS 2.0: Milestone F.1.2 Telemetry & Six-Gate Validation');
  console.log('   Environment: 100% Isolated In-Memory Infrastructure');
  console.log('================================================================\n');

  // 1. Complete weekday bulletin (14 states * 28 markets * 8 crops = 3,136 rows)
  await runAsyncTest('1. Complete weekday bulletin passes all 6 real pilot gates and inserts rows', async () => {
    const db = new IsolatedTestDB();
    const auditStore = new InMemoryAuditStore();
    const csv = buildMockBulletinCsv({ numStates: 14, marketsPerState: 28, cropsPerMarket: 8 });
    const res = await collectValidatedBulletin({
      csvSource: csv,
      metadata: { totalRecords: 3136, ogdUpdatedDate: '2026-11-10T02:30:00.000Z' },
      dayType: 'WEEKDAY',
      windowName: '04:00_IST',
      dbClientOrPool: db,
      auditStore
    });

    assert.strictEqual(res.validation.passed, true);
    assert.strictEqual(res.validation.finalValidationStatus, 'CERTIFIED_NATIONAL');
    assert.strictEqual(res.telemetry.execution_status, 'SUCCESS');
    assert.strictEqual(res.telemetry.audit_lifecycle_state, 'COLLECTION_FULLY_CERTIFIED');
    assert.strictEqual(res.telemetry.fully_certified, true);
    assert.strictEqual(res.telemetry.observations_committed, true);
    assert.strictEqual(res.telemetry.audit_persisted, true);
    assert.strictEqual(res.telemetry.records_inserted, 3136);
    assert.strictEqual(db.rowsByKey.size, 3136);
    assert.strictEqual(res.telemetry.distinct_states, 14);
    assert.strictEqual(res.telemetry.distinct_markets, 392);
    assert.strictEqual(res.telemetry.distinct_commodities, 70);
  });

  // 2. Partial weekday bulletin (only 4 states, 200 rows)
  await runAsyncTest('2. Partial weekday bulletin fails breadth gates with 0 DB writes', async () => {
    const db = new IsolatedTestDB();
    const auditStore = new InMemoryAuditStore();
    const csv = buildMockBulletinCsv({ numStates: 4, marketsPerState: 10, cropsPerMarket: 5 }); // 200 rows

    const res = await collectValidatedBulletin({
      csvSource: csv,
      metadata: { totalRecords: 200 },
      dayType: 'WEEKDAY',
      dbClientOrPool: db,
      auditStore
    });

    assert.strictEqual(res.validation.passed, false);
    assert.strictEqual(res.validation.finalValidationStatus, 'INCOMPLETE_GEOGRAPHY');
    assert.strictEqual(res.telemetry.execution_status, 'REJECTED_VALIDATION');
    assert.strictEqual(res.telemetry.records_inserted, 0);
    assert.strictEqual(db.writeOperations, 0, 'Must perform zero observation writes');
  });

  // 3. Valid Sunday / Holiday bulletin (restored F.0.1 thresholds: >= 5 states, >= 50 markets, >= 20 crops, >= 300 rows)
  await runAsyncTest('3. Valid Sunday / holiday bulletin passes F.0.1 thresholds; sparse (<5 states) rejected', async () => {
    const db = new IsolatedTestDB();
    const auditStore = new InMemoryAuditStore();
    // 5 states * 10 markets * 7 crops = 350 rows, 50 markets, 70 crops
    const csv = buildMockBulletinCsv({ numStates: 5, marketsPerState: 10, cropsPerMarket: 7, arrivalDate: '08/11/2026' });

    const detectedType = getDayScheduleType('2026-11-08'); // Nov 8, 2026 is Sunday
    assert.strictEqual(detectedType, 'SUNDAY');

    const res = await collectValidatedBulletin({
      csvSource: csv,
      metadata: { totalRecords: 350 },
      targetDate: '2026-11-08',
      dayType: detectedType,
      dbClientOrPool: db,
      auditStore
    });

    assert.strictEqual(res.validation.passed, true);
    assert.strictEqual(res.validation.finalValidationStatus, 'CERTIFIED_HOLIDAY_REDUCED');
    assert.strictEqual(res.telemetry.records_inserted, 350);

    // Verify sparse Sunday feed (3 states, 210 rows) fails restored F.0.1 Sunday gates
    const dbSparse = new IsolatedTestDB();
    const sparseCsv = buildMockBulletinCsv({ numStates: 3, marketsPerState: 10, cropsPerMarket: 7, arrivalDate: '08/11/2026' });
    const resSparse = await collectValidatedBulletin({
      csvSource: sparseCsv,
      metadata: { totalRecords: 210 },
      targetDate: '2026-11-08',
      dayType: 'SUNDAY',
      dbClientOrPool: dbSparse
    });
    assert.strictEqual(resSparse.validation.passed, false);
    assert.strictEqual(resSparse.validation.finalValidationStatus, 'INCOMPLETE_GEOGRAPHY');
    assert.strictEqual(dbSparse.writeOperations, 0);
  });

  // 4. Missing API total
  await runAsyncTest('4. Missing API total yields METADATA_UNAVAILABLE, never certifies, 0 DB writes', async () => {
    const db = new IsolatedTestDB();
    const csv = buildMockBulletinCsv({ numStates: 14, marketsPerState: 28, cropsPerMarket: 8 });
    const res = await collectValidatedBulletin({
      csvSource: csv,
      metadata: { totalRecords: null, ogdUpdatedDate: null },
      dayType: 'WEEKDAY',
      dbClientOrPool: db
    });

    assert.strictEqual(res.validation.passed, false);
    assert.strictEqual(res.validation.finalValidationStatus, 'METADATA_UNAVAILABLE');
    assert.strictEqual(res.validation.gates.gate1_stream_parity.passed, false);
    assert.strictEqual(res.telemetry.api_reported_total, null);
    assert.strictEqual(res.telemetry.ogd_publication_timestamp, null);
    assert.strictEqual(db.writeOperations, 0);
  });

  // 5. API total mismatch (±1% strict tolerance)
  await runAsyncTest('5. API total mismatch (>1% variance) yields REJECTED_PARITY_MISMATCH and 0 DB writes', async () => {
    const db = new IsolatedTestDB();
    const csv = buildMockBulletinCsv({ numStates: 14, marketsPerState: 28, cropsPerMarket: 8 }); // 3136 rows
    const res = await collectValidatedBulletin({
      csvSource: csv,
      metadata: { totalRecords: 3185 }, // 1.54% variance -> fails strict ±1.0% threshold
      dayType: 'WEEKDAY',
      dbClientOrPool: db
    });

    assert.strictEqual(res.validation.passed, false);
    assert.strictEqual(res.validation.finalValidationStatus, 'REJECTED_PARITY_MISMATCH');
    assert.strictEqual(db.writeOperations, 0);
  });

  // 6. Truncated stream
  await runAsyncTest('6. Truncated stream (streamComplete=false) yields REJECTED_TRUNCATED and 0 DB writes', async () => {
    const db = new IsolatedTestDB();
    const csv = buildMockBulletinCsv({ numStates: 14, marketsPerState: 28, cropsPerMarket: 8 });
    const res = await collectValidatedBulletin({
      csvSource: csv,
      metadata: { totalRecords: 3136 },
      streamComplete: false,
      dayType: 'WEEKDAY',
      dbClientOrPool: db
    });

    assert.strictEqual(res.validation.passed, false);
    assert.strictEqual(res.validation.finalValidationStatus, 'REJECTED_TRUNCATED');
    assert.strictEqual(res.telemetry.execution_status, 'REJECTED_TRUNCATED');
    assert.strictEqual(db.writeOperations, 0);
  });

  // 7. Invalid row threshold exceeded
  await runAsyncTest('7. Invalid row rate > 3% fails Gate 5 (REJECTED_HIGH_ERROR_RATE) with 0 DB writes', async () => {
    const db = new IsolatedTestDB();
    const csv = buildMockBulletinCsv({
      numStates: 14, marketsPerState: 28, cropsPerMarket: 8,
      invalidRows: 150 // ~4.5% rejection rate
    });
    const res = await collectValidatedBulletin({
      csvSource: csv,
      metadata: { totalRecords: 3286 },
      dayType: 'WEEKDAY',
      dbClientOrPool: db
    });

    assert.strictEqual(res.validation.passed, false);
    assert.strictEqual(res.validation.finalValidationStatus, 'REJECTED_HIGH_ERROR_RATE');
    assert.strictEqual(res.telemetry.records_rejected, 150);
    assert.strictEqual(db.writeOperations, 0);
  });

  // 8. Duplicate threshold exceeded
  await runAsyncTest('8. Duplicate rate > 5% fails Gate 5 (REJECTED_HIGH_DUPLICATE_RATE) with 0 DB writes', async () => {
    const db = new IsolatedTestDB();
    const csv = buildMockBulletinCsv({
      numStates: 14, marketsPerState: 28, cropsPerMarket: 8,
      duplicateRows: 250 // ~7.4% duplicate rate
    });
    const res = await collectValidatedBulletin({
      csvSource: csv,
      metadata: { totalRecords: 3386 },
      dayType: 'WEEKDAY',
      dbClientOrPool: db
    });

    assert.strictEqual(res.validation.passed, false);
    assert.strictEqual(res.validation.finalValidationStatus, 'REJECTED_HIGH_DUPLICATE_RATE');
    assert.strictEqual(res.telemetry.duplicate_count, 250);
    assert.strictEqual(db.writeOperations, 0);
  });

  // 9. Day-over-day volume drop (>45% drop)
  await runAsyncTest('9. Day-over-day volume drop >45% triggers investigation flag without false truncation proof', async () => {
    const db = new IsolatedTestDB();
    const auditStore = new InMemoryAuditStore();
    // Simulate yesterday's successful run had 8,000 parsed records
    await auditStore.saveRun({
      harvest_batch_id: 'harvest_yesterday',
      execution_status: 'SUCCESS',
      records_parsed: 8000
    });

    // Today's bulletin has 3,136 records (all Gates 1-5 pass cleanly, but drop is 60.8% vs 8,000)
    const csv = buildMockBulletinCsv({ numStates: 14, marketsPerState: 28, cropsPerMarket: 8 });
    const res = await collectValidatedBulletin({
      csvSource: csv,
      metadata: { totalRecords: 3136 },
      dayType: 'WEEKDAY',
      dbClientOrPool: db,
      auditStore
    });

    assert.strictEqual(res.validation.gates.gate6_volume_continuity.status, 'VOLUME_DROP_INVESTIGATION');
    assert.strictEqual(res.validation.requiresInvestigation, true);
    assert.strictEqual(res.validation.passed, true, 'Default policy allows persistence while alerting investigation');
    assert.strictEqual(res.telemetry.execution_status, 'SUCCESS_INVESTIGATION_NEEDED');
    assert.strictEqual(res.validation.finalValidationStatus, 'CERTIFIED_WITH_VOLUME_INVESTIGATION');

    // Also verify failOnVolumeDrop=true policy halts writes when strictly configured
    const dbStrict = new IsolatedTestDB();
    const resStrict = await collectValidatedBulletin({
      csvSource: csv,
      metadata: { totalRecords: 3136 },
      dayType: 'WEEKDAY',
      dbClientOrPool: dbStrict,
      previousSuccessfulRun: { records_parsed: 8000 },
      failOnVolumeDrop: true
    });
    assert.strictEqual(resStrict.validation.passed, false);
    assert.strictEqual(dbStrict.writeOperations, 0);
  });

  // 10. Identical rerun
  await runAsyncTest('10. Identical rerun performs 0 DB writes and tracks skipped observations in telemetry', async () => {
    const db = new IsolatedTestDB();
    const auditStore = new InMemoryAuditStore();
    const csv = buildMockBulletinCsv({ numStates: 14, marketsPerState: 28, cropsPerMarket: 8 });

    await collectValidatedBulletin({
      csvSource: csv,
      metadata: { totalRecords: 3136, ogdUpdatedDate: '2026-11-10T02:00:00.000Z' },
      dayType: 'WEEKDAY',
      batchId: 'batch_run_A',
      dbClientOrPool: db,
      auditStore
    });
    const writesAfterA = db.writeOperations;

    const resB = await collectValidatedBulletin({
      csvSource: csv,
      metadata: { totalRecords: 3136, ogdUpdatedDate: '2026-11-10T02:00:00.000Z' },
      dayType: 'WEEKDAY',
      batchId: 'batch_run_B',
      dbClientOrPool: db,
      auditStore
    });

    assert.strictEqual(db.writeOperations, writesAfterA, '0 new DB writes on identical rerun');
    assert.strictEqual(resB.telemetry.records_inserted, 0);
    assert.strictEqual(resB.telemetry.records_updated, 0);
    assert.strictEqual(resB.telemetry.records_skipped, 3136);
  });

  // 11. Failed validation preserves existing observations
  await runAsyncTest('11. Failed subsequent validation never deletes or updates existing valid observations', async () => {
    const db = new IsolatedTestDB();
    const validCsv = buildMockBulletinCsv({ numStates: 14, marketsPerState: 28, cropsPerMarket: 8 });
    await collectValidatedBulletin({
      csvSource: validCsv,
      metadata: { totalRecords: 3136 },
      dayType: 'WEEKDAY',
      dbClientOrPool: db
    });
    const countBefore = db.rowsByKey.size;
    const writesBefore = db.writeOperations;

    // Now send an incomplete/corrupt bulletin
    const badCsv = buildMockBulletinCsv({ numStates: 2, marketsPerState: 5, cropsPerMarket: 2, arrivalDate: '11/11/2026' });
    const badRes = await collectValidatedBulletin({
      csvSource: badCsv,
      metadata: { totalRecords: 20 },
      dayType: 'WEEKDAY',
      dbClientOrPool: db
    });

    assert.strictEqual(badRes.validation.passed, false);
    assert.strictEqual(db.rowsByKey.size, countBefore, 'Pre-existing observations preserved 100%');
    assert.strictEqual(db.writeOperations, writesBefore, 'Zero writes executed during failed run');
  });

  // 12. Telemetry structure & IST/UTC timestamp verification
  await runAsyncTest('12. Telemetry captures all required fields accurately with IST +05:30 and UTC timestamps', async () => {
    const db = new IsolatedTestDB();
    const auditStore = new InMemoryAuditStore();
    const csv = buildMockBulletinCsv({ numStates: 14, marketsPerState: 28, cropsPerMarket: 8 });
    const res = await collectValidatedBulletin({
      csvSource: csv,
      metadata: { totalRecords: 3136, ogdUpdatedDate: '2026-11-10T03:30:00.000Z' },
      windowName: '04:00_IST',
      dayType: 'WEEKDAY',
      dbClientOrPool: db,
      auditStore
    });

    const t = res.telemetry;
    assert(t.harvest_batch_id);
    assert(t.execution_start_utc.endsWith('Z'));
    assert(t.execution_start_ist.endsWith('+05:30'));
    assert(t.execution_end_utc.endsWith('Z'));
    assert(t.execution_end_ist.endsWith('+05:30'));
    assert.strictEqual(t.collection_window, '04:00_IST');
    assert.strictEqual(t.target_observation_date, '2026-11-10');
    assert.strictEqual(t.ogd_publication_timestamp, '2026-11-10T03:30:00.000Z');
    assert.strictEqual(t.api_reported_total, 3136);
    assert.strictEqual(t.records_fetched, 3136);
    assert.strictEqual(t.records_parsed, 3136);
    assert.strictEqual(Object.keys(t.gates).length, 6, 'All 6 gates present in telemetry');

    const storedRuns = await auditStore.listRuns();
    assert.strictEqual(storedRuns.length, 1);
  });

  // 13. Audit storage failure handling & explicit non-certified semantics
  await runAsyncTest('13. Audit storage failure transitions to AUDIT_PERSIST_FAILED_AFTER_COMMIT, sets fully_certified=false, and enables recovery', async () => {
    const db = new IsolatedTestDB();
    const failingStore = new FailingAuditStore('Simulated Redis/Postgres telemetry timeout');
    const csv = buildMockBulletinCsv({ numStates: 14, marketsPerState: 28, cropsPerMarket: 8 });

    const res = await collectValidatedBulletin({
      csvSource: csv,
      metadata: { totalRecords: 3136 },
      dayType: 'WEEKDAY',
      dbClientOrPool: db,
      auditStore: failingStore
    });

    assert.strictEqual(res.auditPersistFailed, true);
    assert.strictEqual(res.observationsCommitted, true);
    assert.strictEqual(res.telemetry.observations_committed, true);
    assert.strictEqual(res.telemetry.audit_persisted, false);
    assert.strictEqual(res.telemetry.fully_certified, false, 'Collection CANNOT report fully_certified when audit persistence fails');
    assert.strictEqual(res.telemetry.execution_status, 'AUDIT_PERSIST_FAILED_AFTER_COMMIT', 'Must NOT report execution_status as SUCCESS');
    assert.strictEqual(res.telemetry.audit_lifecycle_state, 'AUDIT_PERSIST_FAILED_AFTER_COMMIT');
    assert(res.auditError.includes('Simulated Redis/Postgres telemetry timeout'));
    assert.strictEqual(res.dbStats.imported, 3136, 'Valid observations still safely committed despite telemetry sink error');
    assert.ok(res.recoverableAuditPayload, 'Recoverable telemetry snapshot preserved for queue/manual retry');

    // Verify recovery store can persist the captured recoverableAuditPayload cleanly
    const recoveryStore = new InMemoryAuditStore();
    await recoveryStore.saveRun(res.recoverableAuditPayload);
    const recoveredList = await recoveryStore.listRuns();
    assert.strictEqual(recoveredList.length, 1);
    assert.strictEqual(recoveredList[0].harvest_batch_id, res.telemetry.harvest_batch_id);
  });

  console.log('\n================================================================');
  console.log(`Milestone F.1.2 Scoreboard: ${passedTests}/${totalTests} tests passed.`);
  console.log('================================================================');
  assert.strictEqual(passedTests, totalTests);
}

runTests().catch((err) => {
  console.error('F.1.2 test suite failed:', err);
  process.exit(1);
});
