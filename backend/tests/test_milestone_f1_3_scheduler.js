/**
 * Milestone F.1.3: Inactive Scheduler & Runtime Feature Flag Isolated Test Suite
 * 
 * STRICT ISOLATION GUARANTEE:
 * - Zero production Supabase connections or external HTTP requests.
 * - Zero production crons activated.
 * 
 * Verifies ALL Part E Requirements:
 *  1. Missing feature flag defaults strictly to disabled
 *  2. Explicit false disables execution
 *  3. Runtime flag changes are respected dynamically on every call
 *  4. Disabled execution performs ZERO network calls and ZERO DB queries
 *  5. Correct IST window resolution (01:30, 04:00, 06:00 IST)
 *  6. Duplicate / overlapping invocation prevention (with lock release on error)
 *  7. Bounded exponential backoff with jitter for 429/5xx/timeouts & fast-fail for 4xx
 *  8. Earlier successful window suppresses redundant bulk CSV downloads when OGD unchanged
 *  9. Failed validation returns REJECTED_VALIDATION cleanly without retries or bypassing gates
 * 10. Inactive CLI entrypoint stays dormant when flag is unset/false
 */

const assert = require('assert');
const {
  PROVISIONAL_IST_WINDOWS,
  isDailyHarvestEnabled,
  resolveIstWindow,
  InMemoryLockProvider,
  PostgresAdvisoryLockProvider,
  executeWithBackoff,
  findAlreadyCertifiedRun,
  runScheduledHarvestCycle
} = require('../services/dailyMandiSchedulerService');
const { executeCliRun } = require('../jobs/dailyMandiHarvestRunner');
const { InMemoryAuditStore } = require('../services/auditTelemetryStore');

function buildCompleteWeekdayCsv(arrivalDate = '10/11/2026') {
  const states = [
    'Andhra Pradesh', 'Madhya Pradesh', 'Maharashtra', 'Gujarat', 'Telangana',
    'Karnataka', 'Punjab', 'Haryana', 'Rajasthan', 'Odisha', 'Tamil Nadu',
    'West Bengal', 'Bihar', 'Uttar Pradesh'
  ];
  const lines = [
    'State,District,Market,Commodity,Variety,Grade,Arrival_Date,Min_x0020_Price,Max_x0020_Price,Modal_x0020_Price'
  ];
  let cropIdx = 1;
  for (let s = 0; s < 14; s++) {
    for (let m = 0; m < 28; m++) {
      for (let k = 0; k < 8; k++) {
        const crop = `Crop_${(cropIdx++ % 65) + 1}`;
        lines.push(`"${states[s]}","Dist_${s}_${m % 4}","Mkt_${s}_${m}_APMC","${crop}",Local,FAQ,${arrivalDate},1400,1800,1600`);
      }
    }
  }
  return lines.join('\n'); // 3,136 valid rows across 14 states, 392 markets, 65 crops
}

class IsolatedSchedulerDB {
  constructor() {
    this.rowsByKey = new Map();
    this.queryCount = 0;
  }
  _key(r) {
    return [r.state, r.district, r.market, r.commodity, r.variety ?? '__NULL__', r.observation_date].join('::');
  }
  async query(sql, params = []) {
    this.queryCount++;
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
      if (!this.rowsByKey.has(key)) {
        this.rowsByKey.set(key, incoming);
        return { rows: [{ id: incoming.id, is_insert: true }] };
      }
      return { rows: [] };
    }
    throw new Error('Unexpected SQL in IsolatedSchedulerDB');
  }
}

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

async function runSchedulerTests() {
  console.log('================================================================');
  console.log('🌾 KisanOS 2.0: Milestone F.1.3 Inactive Scheduler & Flag Tests');
  console.log('   Environment: 100% Isolated Mocks (NO Crons, NO Supabase)');
  console.log('================================================================\n');

  // 1 & 2. Missing feature flag defaults to disabled; explicit false disables
  runTest('1. Feature flag defaults strictly to disabled when missing or false', () => {
    assert.strictEqual(isDailyHarvestEnabled({}), false, 'Missing env must disable');
    assert.strictEqual(isDailyHarvestEnabled({ MANDI_DAILY_HARVEST_ENABLED: '' }), false);
    assert.strictEqual(isDailyHarvestEnabled({ MANDI_DAILY_HARVEST_ENABLED: 'false' }), false);
    assert.strictEqual(isDailyHarvestEnabled({ MANDI_DAILY_HARVEST_ENABLED: 'FALSE' }), false);
    assert.strictEqual(isDailyHarvestEnabled({ MANDI_DAILY_HARVEST_ENABLED: '0' }), false);
    assert.strictEqual(isDailyHarvestEnabled({ MANDI_DAILY_HARVEST_ENABLED: 'random_str' }), false);
    assert.strictEqual(isDailyHarvestEnabled({ MANDI_DAILY_HARVEST_ENABLED: 'true' }), true);
    assert.strictEqual(isDailyHarvestEnabled({ MANDI_DAILY_HARVEST_ENABLED: 'TRUE' }), true);
  });

  // 3 & 4. Runtime flag changes respected dynamically; disabled performs 0 HTTP & 0 DB calls
  await runAsyncTest('2. Dynamic runtime flag toggle respected; disabled executes 0 HTTP & 0 DB queries', async () => {
    const db = new IsolatedSchedulerDB();
    const auditStore = new InMemoryAuditStore();
    let httpCalls = 0;
    const dynamicEnv = { MANDI_DAILY_HARVEST_ENABLED: 'false' };

    const resOff = await runScheduledHarvestCycle({
      env: dynamicEnv,
      dbClientOrPool: db,
      auditStore,
      fetchMetadataFn: async () => { httpCalls++; return { totalRecords: 3136 }; },
      fetchCsvFn: async () => { httpCalls++; return buildCompleteWeekdayCsv(); }
    });

    assert.strictEqual(resOff.executed, false);
    assert.strictEqual(resOff.status, 'DISABLED_BY_FEATURE_FLAG');
    assert.strictEqual(httpCalls, 0, 'Must perform 0 HTTP requests when disabled');
    assert.strictEqual(db.queryCount, 0, 'Must perform 0 DB queries when disabled');

    // Toggle flag ON dynamically in memory without module reload
    dynamicEnv.MANDI_DAILY_HARVEST_ENABLED = 'true';
    const resOn = await runScheduledHarvestCycle({
      now: new Date('2026-11-09T22:30:00.000Z'), // 04:00 IST Nov 10
      env: dynamicEnv,
      dbClientOrPool: db,
      auditStore,
      fetchMetadataFn: async () => { httpCalls++; return { totalRecords: 3136, ogdUpdatedDate: '2026-11-09T22:00:00.000Z' }; },
      fetchCsvFn: async () => { httpCalls++; return buildCompleteWeekdayCsv(); }
    });

    assert.strictEqual(resOn.executed, true);
    assert.strictEqual(resOn.status, 'SUCCESS');
    assert.strictEqual(httpCalls, 2);
    assert.ok(db.queryCount > 0);

    // Toggle back OFF dynamically
    dynamicEnv.MANDI_DAILY_HARVEST_ENABLED = 'false';
    const queriesBefore = db.queryCount;
    const resOff2 = await runScheduledHarvestCycle({
      env: dynamicEnv,
      dbClientOrPool: db,
      auditStore,
      fetchMetadataFn: async () => { httpCalls++; return { totalRecords: 3136 }; }
    });
    assert.strictEqual(resOff2.status, 'DISABLED_BY_FEATURE_FLAG');
    assert.strictEqual(httpCalls, 2, 'No extra HTTP calls after disabling');
    assert.strictEqual(db.queryCount, queriesBefore, 'No extra DB queries after disabling');
  });

  // 5. IST Window resolution
  runTest('3. Correctly resolves provisional IST schedule windows (01:30, 04:00, 06:00 IST)', () => {
    assert.strictEqual(PROVISIONAL_IST_WINDOWS.length, 3);

    // 2026-11-09T20:00:00Z = 2026-11-10 01:30:00 IST
    const w1 = resolveIstWindow(new Date('2026-11-09T20:00:00.000Z'));
    assert.strictEqual(w1.matched, true);
    assert.strictEqual(w1.windowName, '01:30_IST');
    assert.strictEqual(w1.istDateStr, '2026-11-10');

    // 2026-11-09T22:30:00Z = 2026-11-10 04:00:00 IST
    const w2 = resolveIstWindow(new Date('2026-11-09T22:30:00.000Z'));
    assert.strictEqual(w2.matched, true);
    assert.strictEqual(w2.windowName, '04:00_IST');
    assert.strictEqual(w2.istDateStr, '2026-11-10');

    // 2026-11-10T00:30:00Z = 2026-11-10 06:00:00 IST
    const w3 = resolveIstWindow(new Date('2026-11-10T00:30:00.000Z'));
    assert.strictEqual(w3.matched, true);
    assert.strictEqual(w3.windowName, '06:00_IST');
    assert.strictEqual(w3.istDateStr, '2026-11-10');

    // 2026-11-10T09:00:00Z = 2026-11-10 14:30:00 IST (outside schedule)
    const wOut = resolveIstWindow(new Date('2026-11-10T09:00:00.000Z'));
    assert.strictEqual(wOut.matched, false);
    assert.strictEqual(wOut.windowName, 'OUTSIDE_SCHEDULE_WINDOW');
  });

  // 6. Duplicate invocation prevention & lock cleanup
  await runAsyncTest('4. Concurrent invocation prevented cleanly via advisory lock; lock released after error', async () => {
    const lockProvider = new InMemoryLockProvider();
    await lockProvider.tryAcquire(); // Simulate active running worker

    let networkCalled = false;
    const resLocked = await runScheduledHarvestCycle({
      env: { MANDI_DAILY_HARVEST_ENABLED: 'true' },
      lockProvider,
      fetchMetadataFn: async () => { networkCalled = true; return {}; }
    });

    assert.strictEqual(resLocked.executed, false);
    assert.strictEqual(resLocked.status, 'SKIPPED_LOCKED_CONCURRENT_RUN');
    assert.strictEqual(networkCalled, false);

    // Release and simulate a failing run -> lock must still be released in finally
    await lockProvider.release();
    const resErr = await runScheduledHarvestCycle({
      env: { MANDI_DAILY_HARVEST_ENABLED: 'true' },
      lockProvider,
      retryOptions: { maxRetries: 0 },
      fetchMetadataFn: async () => { throw new Error('HTTP 403 Forbidden'); }
    });
    assert.strictEqual(resErr.status, 'FETCH_FAILED');
    assert.strictEqual(await lockProvider.tryAcquire(), true, 'Lock must be released even after failure');
    await lockProvider.release();

    // Verify PostgresAdvisoryLockProvider SQL calls cleanly against mock pool
    const lockQueries = [];
    const mockPgPool = {
      async connect() {
        return {
          query: async (sql, params) => {
            lockQueries.push({ sql, params });
            if (sql.includes('pg_advisory_unlock')) return { rows: [{ unlocked: true }] };
            return { rows: [{ acquired: true }] };
          },
          release: () => lockQueries.push({ released: true })
        };
      }
    };
    const pgLock = new PostgresAdvisoryLockProvider(mockPgPool);
    assert.strictEqual(await pgLock.tryAcquire(999), true);
    await pgLock.release(999);
    assert(lockQueries.some((q) => q.sql && q.sql.includes('pg_try_advisory_lock')));
    assert(lockQueries.some((q) => q.sql && q.sql.includes('pg_advisory_unlock')));
    assert(lockQueries.some((q) => q.released === true));
  });

  // 7. Bounded retry, backoff with jitter, timeout, and 4xx fast-fail
  await runAsyncTest('5. Bounded exponential backoff + jitter handles 429/5xx/timeouts; 4xx fails fast', async () => {
    const delays = [];
    let attempt = 0;

    // 429 twice then success on attempt 3
    const result = await executeWithBackoff(async () => {
      attempt++;
      if (attempt < 3) throw new Error('HTTP 429: Rate limit exceeded');
      return 'OK';
    }, {
      maxRetries: 3,
      baseDelayMs: 500,
      maxDelayMs: 5000,
      jitterFn: () => 50,
      sleepFn: async (ms) => delays.push(ms)
    });

    assert.strictEqual(result, 'OK');
    assert.strictEqual(attempt, 3);
    assert.deepStrictEqual(delays, [550, 1050]);

    // Timeout retries bounded then fails cleanly
    let timeoutAttempts = 0;
    const timeoutDelays = [];
    await assert.rejects(async () => {
      await executeWithBackoff(async () => {
        timeoutAttempts++;
        throw new Error('Bulletin metadata probe timed out after 15000ms');
      }, {
        maxRetries: 2,
        baseDelayMs: 200,
        jitterFn: () => 10,
        sleepFn: async (ms) => timeoutDelays.push(ms)
      });
    }, /timed out/);
    assert.strictEqual(timeoutAttempts, 3); // 1 initial + 2 retries
    assert.strictEqual(timeoutDelays.length, 2);

    // HTTP 401 fails immediately with 0 retries
    let authAttempts = 0;
    await assert.rejects(async () => {
      await executeWithBackoff(async () => {
        authAttempts++;
        throw new Error('HTTP 401: Unauthorized');
      }, { maxRetries: 3, sleepFn: async () => {} });
    }, /HTTP 401/);
    assert.strictEqual(authAttempts, 1, 'Non-transient 401 must fail fast with zero retries');
  });

  // 8. Earlier successful window skips redundant CSV downloads unless OGD updated
  await runAsyncTest('6. Earlier COLLECTION_FULLY_CERTIFIED window skips duplicate work when OGD timestamp matches', async () => {
    const db = new IsolatedSchedulerDB();
    const auditStore = new InMemoryAuditStore();
    const env = { MANDI_DAILY_HARVEST_ENABLED: 'true' };
    let csvDownloads = 0;

    // Window 1 (01:30 IST Nov 10) certifies release T1
    const w1Res = await runScheduledHarvestCycle({
      now: new Date('2026-11-09T20:00:00.000Z'), // 01:30 IST Nov 10
      env,
      dbClientOrPool: db,
      auditStore,
      fetchMetadataFn: async () => ({ totalRecords: 3136, ogdUpdatedDate: '2026-11-09T19:50:00.000Z' }),
      fetchCsvFn: async () => { csvDownloads++; return buildCompleteWeekdayCsv('10/11/2026'); }
    });
    assert.strictEqual(w1Res.status, 'SUCCESS');
    assert.strictEqual(w1Res.telemetry.fully_certified, true);
    assert.strictEqual(csvDownloads, 1);

    // Window 2 (04:00 IST Nov 10) probes metadata -> same T1 -> skips bulk CSV!
    const w2Res = await runScheduledHarvestCycle({
      now: new Date('2026-11-09T22:30:00.000Z'), // 04:00 IST Nov 10
      env,
      dbClientOrPool: db,
      auditStore,
      fetchMetadataFn: async () => ({ totalRecords: 3136, ogdUpdatedDate: '2026-11-09T19:50:00.000Z' }),
      fetchCsvFn: async () => { csvDownloads++; return buildCompleteWeekdayCsv('10/11/2026'); }
    });
    assert.strictEqual(w2Res.executed, false);
    assert.strictEqual(w2Res.status, 'SKIPPED_ALREADY_CERTIFIED');
    assert.strictEqual(w2Res.certifiedBatchId, w1Res.batchId);
    assert.strictEqual(csvDownloads, 1, 'No redundant bulk CSV downloaded');

    // Window 3 (06:00 IST Nov 10): Suppose OGD published a late revision T2 -> runs cleanly!
    const w3Res = await runScheduledHarvestCycle({
      now: new Date('2026-11-10T00:30:00.000Z'), // 06:00 IST Nov 10
      env,
      dbClientOrPool: db,
      auditStore,
      fetchMetadataFn: async () => ({ totalRecords: 3136, ogdUpdatedDate: '2026-11-09T22:15:00.000Z' }),
      fetchCsvFn: async () => { csvDownloads++; return buildCompleteWeekdayCsv('10/11/2026'); }
    });
    assert.strictEqual(w3Res.executed, true);
    assert.strictEqual(csvDownloads, 2, 'New OGD timestamp triggers delta run');
  });

  // 9. Failed validation does NOT retry and does NOT bypass six-gate checks
  await runAsyncTest('7. Validation failure returns REJECTED_VALIDATION once without retries or DB writes', async () => {
    const db = new IsolatedSchedulerDB();
    const auditStore = new InMemoryAuditStore();
    let csvFetches = 0;

    // Incomplete bulletin (only 1 row vs 3136 reported)
    const partialCsv = 'State,District,Market,Commodity,Variety,Grade,Arrival_Date,Min_x0020_Price,Max_x0020_Price,Modal_x0020_Price\n"UP","Agra","Agra APMC",Potato,Desi,FAQ,10/11/2026,1400,1600,1500';
    const res = await runScheduledHarvestCycle({
      now: new Date('2026-11-09T22:30:00.000Z'),
      env: { MANDI_DAILY_HARVEST_ENABLED: 'true' },
      dbClientOrPool: db,
      auditStore,
      retryOptions: { maxRetries: 3, sleepFn: async () => {} },
      fetchMetadataFn: async () => ({ totalRecords: 3136, ogdUpdatedDate: '2026-11-09T22:00:00.000Z' }),
      fetchCsvFn: async () => { csvFetches++; return partialCsv; }
    });

    assert.strictEqual(res.executed, true);
    assert.strictEqual(res.status, 'REJECTED_VALIDATION');
    assert.strictEqual(csvFetches, 1, 'Invalid bulletin must NOT trigger HTTP retries');
    assert.strictEqual(db.rowsByKey.size, 0, '0 DB rows written when Six-Gate fails');
  });

  // 10. Inactive CLI Entrypoint returns DISABLED_BY_FEATURE_FLAG safely
  await runAsyncTest('8. Dormant CLI entrypoint exits safely when MANDI_DAILY_HARVEST_ENABLED is unset/false', async () => {
    const originalVal = process.env.MANDI_DAILY_HARVEST_ENABLED;
    delete process.env.MANDI_DAILY_HARVEST_ENABLED;
    try {
      const cliRes = await executeCliRun();
      assert.strictEqual(cliRes.executed, false);
      assert.strictEqual(cliRes.status, 'DISABLED_BY_FEATURE_FLAG');
    } finally {
      if (originalVal !== undefined) process.env.MANDI_DAILY_HARVEST_ENABLED = originalVal;
    }
  });

  // 9. Same-Connection PostgreSQL Advisory Lock Ownership (Correction 1)
  await runAsyncTest('9. PostgresAdvisoryLockProvider acquires, holds, unlocks, and releases strictly on the SAME dedicated client', async () => {
    const lifecycleEvents = [];
    let connSeq = 0;

    // Multi-connection mock pool tracking individual client identities & ordered calls
    const createTrackedPool = ({ acquireResult = true, failOnLock = false, failOnUnlock = false } = {}) => ({
      async connect() {
        const cid = `conn-${++connSeq}`;
        lifecycleEvents.push(`connect:${cid}`);
        return {
          cid,
          query: async (sql, _params) => {
            if (sql.includes('pg_try_advisory_lock')) {
              lifecycleEvents.push(`lock:${cid}`);
              if (failOnLock) throw new Error('Lock RPC failure');
              return { rows: [{ acquired: acquireResult }] };
            }
            if (sql.includes('pg_advisory_unlock')) {
              lifecycleEvents.push(`unlock:${cid}`);
              if (failOnUnlock) throw new Error('Unlock RPC failure');
              return { rows: [{ unlocked: true }] };
            }
            throw new Error(`Unexpected query on ${cid}`);
          },
          release: (errArg) => {
            lifecycleEvents.push(`release:${cid}${errArg ? ':withErr' : ''}`);
          }
        };
      }
    });

    // 9a. Full protected execution: connect -> lock(conn-1) -> work -> unlock(conn-1) -> release(conn-1)
    const lock1 = new PostgresAdvisoryLockProvider(createTrackedPool({ acquireResult: true }));
    const db = new IsolatedSchedulerDB();
    const auditStore = new InMemoryAuditStore();

    const cycleRes = await runScheduledHarvestCycle({
      now: new Date('2026-11-09T22:30:00.000Z'),
      env: { MANDI_DAILY_HARVEST_ENABLED: 'true' },
      dbClientOrPool: db,
      auditStore,
      lockProvider: lock1,
      fetchMetadataFn: async () => {
        lifecycleEvents.push('collection_metadata');
        return { totalRecords: 3136, ogdUpdatedDate: '2026-11-09T22:00:00.000Z' };
      },
      fetchCsvFn: async () => {
        lifecycleEvents.push('collection_csv');
        return buildCompleteWeekdayCsv();
      }
    });

    assert.strictEqual(cycleRes.status, 'SUCCESS');
    assert.deepStrictEqual(lifecycleEvents, [
      'connect:conn-1',
      'lock:conn-1',
      'collection_metadata',
      'collection_csv',
      'unlock:conn-1',
      'release:conn-1'
    ], 'Exact same conn-1 used for lock & unlock; release happens STRICTLY after unlock');

    // Double tryAcquire on same active provider must refuse without leaking a new connection
    const lockDouble = new PostgresAdvisoryLockProvider(createTrackedPool({ acquireResult: true }));
    assert.strictEqual(await lockDouble.tryAcquire(), true);
    assert.strictEqual(await lockDouble.tryAcquire(), false, 'Guard prevents overwriting heldClient');
    await lockDouble.release();

    // 9b. Lock acquisition returns false -> immediate release WITHOUT calling pg_advisory_unlock
    lifecycleEvents.length = 0;
    const lockContended = new PostgresAdvisoryLockProvider(createTrackedPool({ acquireResult: false }));
    const acquiredFalse = await lockContended.tryAcquire();
    assert.strictEqual(acquiredFalse, false);
    assert.strictEqual(await lockContended.release(), false, 'Must not call unlock when lock was never acquired');
    assert.deepStrictEqual(lifecycleEvents, [
      'connect:conn-3',
      'lock:conn-3',
      'release:conn-3'
    ]);

    // 9c. Lock query throws error -> releases client with error cleanly
    lifecycleEvents.length = 0;
    const lockErr = new PostgresAdvisoryLockProvider(createTrackedPool({ failOnLock: true }));
    await assert.rejects(async () => lockErr.tryAcquire(), /Lock RPC failure/);
    assert.deepStrictEqual(lifecycleEvents, [
      'connect:conn-4',
      'lock:conn-4',
      'release:conn-4:withErr'
    ]);

    // 9d. Collection error inside runScheduledHarvestCycle STILL unlocks & releases exact same conn
    lifecycleEvents.length = 0;
    const lockAfterExc = new PostgresAdvisoryLockProvider(createTrackedPool({ acquireResult: true }));
    const errRes = await runScheduledHarvestCycle({
      env: { MANDI_DAILY_HARVEST_ENABLED: 'true' },
      lockProvider: lockAfterExc,
      retryOptions: { maxRetries: 0 },
      fetchMetadataFn: async () => { throw new Error('HTTP 401: Auth error'); }
    });
    assert.strictEqual(errRes.status, 'FETCH_FAILED');
    assert.deepStrictEqual(lifecycleEvents, [
      'connect:conn-5',
      'lock:conn-5',
      'unlock:conn-5',
      'release:conn-5'
    ]);
  });

  // 10. Durable Certified-Run Lookup guards (Correction 2)
  await runAsyncTest('10. Durable certified-run lookup ignores incomplete/audit-failed/null-timestamp runs and storage errors', async () => {
    const store = new InMemoryAuditStore();

    // Save various NON-certifiable runs for 2026-11-10
    await store.saveRun({
      harvest_batch_id: 'b_incomplete',
      target_observation_date: '2026-11-10',
      ogd_publication_timestamp: '2026-11-10T01:30:00.000Z',
      execution_status: 'REJECTED_VALIDATION',
      audit_lifecycle_state: 'REJECTED_AUDIT_PERSISTED',
      fully_certified: false,
      audit_persisted: true,
      observations_committed: false
    });
    await store.saveRun({
      harvest_batch_id: 'b_audit_failed',
      target_observation_date: '2026-11-10',
      ogd_publication_timestamp: '2026-11-10T01:30:00.000Z',
      execution_status: 'AUDIT_PERSIST_FAILED_AFTER_COMMIT',
      audit_lifecycle_state: 'AUDIT_PERSIST_FAILED_AFTER_COMMIT',
      fully_certified: false,
      audit_persisted: false,
      observations_committed: true
    });
    await store.saveRun({
      harvest_batch_id: 'b_investigation',
      target_observation_date: '2026-11-10',
      ogd_publication_timestamp: '2026-11-10T01:30:00.000Z',
      execution_status: 'SUCCESS_INVESTIGATION_NEEDED',
      audit_lifecycle_state: 'COLLECTION_FULLY_CERTIFIED',
      fully_certified: false,
      audit_persisted: true,
      observations_committed: true
    });

    // Must return null (ignore all 3 above)
    assert.strictEqual(
      await findAlreadyCertifiedRun(store, '2026-11-10', '2026-11-10T01:30:00.000Z'),
      null,
      'Must ignore incomplete, audit-failed, and non-certified runs'
    );

    // Save genuine COLLECTION_FULLY_CERTIFIED run
    await store.saveRun({
      harvest_batch_id: 'b_certified',
      target_observation_date: '2026-11-10',
      ogd_publication_timestamp: '2026-11-10T01:30:00.000Z',
      execution_status: 'SUCCESS',
      audit_lifecycle_state: 'COLLECTION_FULLY_CERTIFIED',
      fully_certified: true,
      audit_persisted: true,
      observations_committed: true
    });

    // Missing genuine OGD timestamp (null) must NOT suppress a window
    assert.strictEqual(
      await findAlreadyCertifiedRun(store, '2026-11-10', null),
      null,
      'Null OGD publication timestamp cannot prove release identity'
    );

    // Matching genuine date & OGD timestamp finds certified run
    const match = await findAlreadyCertifiedRun(store, '2026-11-10', '2026-11-10T01:30:00.000Z');
    assert.strictEqual(match.harvest_batch_id, 'b_certified');

    // Failing / missing audit history returns null cleanly (never misinterprets as succeeded)
    const brokenStore = { listRuns: async () => { throw new Error('Audit DB unreachable'); } };
    assert.strictEqual(
      await findAlreadyCertifiedRun(brokenStore, '2026-11-10', '2026-11-10T01:30:00.000Z'),
      null
    );
  });

  // 11. Final Advisory Lock Release Hardening & Bigint Overload Tests
  await runAsyncTest('11. Advisory lock enforces bigint cast SQL, pool discard on unlock failure, caller-owned retention, and unresolved lock block', async () => {
    // 11a. Correct bigint-cast SQL + successful unlock state cleanup
    const executedSql = [];
    const poolSuccess = {
      async connect() {
        return {
          query: async (sql, params) => {
            executedSql.push({ sql, params });
            if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
            return { rows: [{ unlocked: true }] };
          },
          release: (errArg) => executedSql.push({ releasedWithErr: Boolean(errArg) })
        };
      }
    };
    const lockOk = new PostgresAdvisoryLockProvider(poolSuccess);
    assert.strictEqual(await lockOk.tryAcquire(84729103), true);
    assert.strictEqual(lockOk.isAcquired, true);
    assert.strictEqual(lockOk.acquiredKey, 84729103);
    assert.ok(lockOk.heldClient);

    assert.strictEqual(await lockOk.release(84729103), true);
    assert.strictEqual(lockOk.heldClient, null, 'heldClient cleared after confirmed unlock');
    assert.strictEqual(lockOk.isAcquired, false);
    assert.strictEqual(lockOk.acquiredKey, null);
    assert.strictEqual(lockOk.unresolvedLock, false);
    assert.strictEqual(executedSql[0].sql, 'SELECT pg_try_advisory_lock($1::bigint) AS acquired;');
    assert.strictEqual(executedSql[1].sql, 'SELECT pg_advisory_unlock($1::bigint) AS unlocked;');
    assert.strictEqual(executedSql[2].releasedWithErr, false);

    // 11b. Pool-owned client unlock failure -> discards broken connection & blocks second acquisition
    let poolConnectCalls = 0;
    let discardedErr = null;
    const poolFailUnlock = {
      async connect() {
        poolConnectCalls++;
        return {
          query: async (sql) => {
            if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
            throw new Error('Unlock connection reset');
          },
          release: (errArg) => { discardedErr = errArg; }
        };
      }
    };
    const lockPoolFail = new PostgresAdvisoryLockProvider(poolFailUnlock);
    assert.strictEqual(await lockPoolFail.tryAcquire(84729103), true);

    await assert.rejects(
      async () => lockPoolFail.release(),
      (err) => err.message.includes('Unlock connection reset') && err.ownership === 'POOL_OWNED' && err.connectionDiscarded === true
    );
    assert.ok(discardedErr instanceof Error, 'Pool-owned broken client MUST be discarded via client.release(err)');
    assert.strictEqual(lockPoolFail.isAcquired, true, 'State preserved indicating lock may be unresolved');
    assert.strictEqual(lockPoolFail.acquiredKey, 84729103);
    assert.strictEqual(lockPoolFail.unresolvedLock, true);

    // Second acquisition on compromised provider must be blocked without opening new connection
    const secondTryPool = await lockPoolFail.tryAcquire(84729103);
    assert.strictEqual(secondTryPool, false, 'Must refuse second acquisition while lock unresolved');
    assert.strictEqual(poolConnectCalls, 1, 'No second connect call attempted while unresolved');

    // 11c. Caller-owned client unlock failure -> retains heldClient & surfaces session discard requirement
    let callerQueryCount = 0;
    const callerClient = {
      query: async (sql) => {
        callerQueryCount++;
        if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
        return { rows: [{ unlocked: false }] }; // PostgreSQL returns false / fails to confirm unlock
      }
    };
    const lockCallerFail = new PostgresAdvisoryLockProvider(callerClient);
    assert.strictEqual(await lockCallerFail.tryAcquire(84729103), true);

    await assert.rejects(
      async () => lockCallerFail.release(),
      (err) => (
        err.ownership === 'CALLER_OWNED' &&
        err.requiresSessionDiscard === true &&
        err.message.includes('caller must discard or close this broken PostgreSQL session')
      )
    );
    assert.strictEqual(lockCallerFail.heldClient, callerClient, 'Caller client reference MUST be retained');
    assert.strictEqual(lockCallerFail.isAcquired, true);
    assert.strictEqual(lockCallerFail.acquiredKey, 84729103);
    assert.strictEqual(lockCallerFail.unresolvedLock, true);

    // Prevent second acquisition while caller session lock remains unresolved
    const queriesBeforeSecond = callerQueryCount;
    assert.strictEqual(await lockCallerFail.tryAcquire(84729103), false);
    assert.strictEqual(callerQueryCount, queriesBeforeSecond, 'No lock query executed while unresolved');
  });

  // 12. Strict PG Unlock Confirmation across ALL 5 failure modes
  await runAsyncTest('12. Strict unlock rejects null/empty result, missing rows, missing unlocked key, unlocked=false, and exception', async () => {
    const failurePayloads = [
      { label: 'null result', response: null },
      { label: 'empty rows array', response: { rows: [] } },
      { label: 'missing unlocked property', response: { rows: [{ pg_advisory_unlock: true }] } },
      { label: 'unlocked non-boolean truthy', response: { rows: [{ unlocked: 'true' }] } },
      { label: 'unlocked === false', response: { rows: [{ unlocked: false }] } }
    ];

    for (const tc of failurePayloads) {
      let discarded = false;
      const poolMock = {
        async connect() {
          return {
            query: async (sql) => {
              if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
              return tc.response;
            },
            release: (errArg) => { if (errArg) discarded = true; }
          };
        }
      };

      const provider = new PostgresAdvisoryLockProvider(poolMock);
      assert.strictEqual(await provider.tryAcquire(84729103), true);
      await assert.rejects(
        async () => provider.release(),
        /did not confirm advisory unlock/,
        `Case "${tc.label}" must reject strict unlock check`
      );
      assert.strictEqual(discarded, true, `Pool connection discarded cleanly on "${tc.label}"`);
      assert.strictEqual(provider.isAcquired, true, `isAcquired preserved on "${tc.label}"`);
      assert.strictEqual(provider.unresolvedLock, true, `unresolvedLock set on "${tc.label}"`);
      assert.strictEqual(await provider.tryAcquire(84729103), false, `Re-acquisition blocked on "${tc.label}"`);
    }

    // Query exception mode on caller-owned client
    const excClient = {
      query: async (sql) => {
        if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
        throw new Error('ECONNRESET during unlock');
      }
    };
    const excProvider = new PostgresAdvisoryLockProvider(excClient);
    assert.strictEqual(await excProvider.tryAcquire(84729103), true);
    await assert.rejects(async () => excProvider.release(), /caller must discard or close/);
    assert.strictEqual(excProvider.heldClient, excClient);
    assert.strictEqual(excProvider.unresolvedLock, true);
  });

  // 13. Client-release failure AFTER confirmed PG unlock must NOT mark lock as still held
  await runAsyncTest('13. Client release error after confirmed unlocked===true leaves lock cleared and allows re-acquisition', async () => {
    let releaseCallCount = 0;
    const poolReleaseErr = {
      async connect() {
        return {
          query: async (sql) => {
            if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
            return { rows: [{ unlocked: true }] }; // PG explicitly confirmed unlock!
          },
          release: () => {
            releaseCallCount++;
            if (releaseCallCount === 1) {
              throw new Error('Pool socket cleanup failed post-unlock');
            }
          }
        };
      }
    };

    const provider = new PostgresAdvisoryLockProvider(poolReleaseErr);
    assert.strictEqual(await provider.tryAcquire(84729103), true);

    await assert.rejects(
      async () => provider.release(),
      (err) => err.message.includes('Pool socket cleanup failed') && err.unlockConfirmed === true
    );

    // Crucial assertions: release() error occurred AFTER unlock, so lock state MUST be cleanly cleared!
    assert.strictEqual(releaseCallCount, 1, 'release() must NOT be called twice');
    assert.strictEqual(provider.heldClient, null, 'heldClient MUST be cleared');
    assert.strictEqual(provider.isAcquired, false, 'isAcquired MUST be false');
    assert.strictEqual(provider.acquiredKey, null, 'acquiredKey MUST be null');
    assert.strictEqual(provider.unresolvedLock, false, 'unresolvedLock MUST remain false');

    // Subsequent acquisition on this provider must succeed cleanly!
    assert.strictEqual(await provider.tryAcquire(84729103), true, 'New tryAcquire allowed because PG lock was confirmed unlocked');
    assert.strictEqual(await provider.release(), true);
  });

  console.log('\n================================================================');
  console.log(`Milestone F.1.3 Scoreboard: ${passedTests}/${totalTests} tests passed.`);
  console.log('================================================================');
  assert.strictEqual(passedTests, totalTests);
}

runSchedulerTests().catch((err) => {
  console.error('F.1.3 test suite failed:', err);
  process.exit(1);
});

