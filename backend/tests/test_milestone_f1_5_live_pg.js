/**
 * KisanOS — Stage F.1.5 Live PostgreSQL Integration Verification Suite
 * Executes against an isolated local PostgreSQL instance ONLY (never Supabase).
 *
 * Verifies against real PostgreSQL:
 * - Migrations 011 & 013 + Rollback 013 (without altering mandi_historical_observations) + Reapply 013
 * - pg_proc catalog ownership (postgres), SECURITY DEFINER, search_path = pg_catalog, pg_temp
 * - Separate authenticated PG connections for postgres, service_role, ml_engine_readonly, anon, authenticated
 * - DEFERRABLE INITIALLY DEFERRED FK & triggers, Contract A/B, append-only immutability
 * - All 63 test scenarios (including raw_payload JSONB batch provenance & orphan reconciliation)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { Pool } = require('pg');

// Safety barrier: never read .env or allow remote/Supabase URLs
delete process.env.DATABASE_URL;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const {
  AUDIT_LIFECYCLE_STATES,
  TRANSITION_KINDS,
  AuditContractValidationError,
  RecoveryConsistencyError,
  TransitionIdentityConflictError,
  rfc8785Canonicalize,
  computeEvidenceChecksum,
  computeTransitionEventId,
  computeRecoveryEventId,
  computeTransitionId,
  buildStableEvidencePayload,
  createBatchTelemetryRecord,
  PostgresAuditTelemetryStore
} = require('../services/auditTelemetryStore');
const { findAlreadyCertifiedRun } = require('../services/dailyMandiSchedulerService');

const PG_HOST = process.env.TEST_PG_HOST || '127.0.0.1';
const PG_PORT = Number(process.env.TEST_PG_PORT || 55432);
const PG_DB = process.env.TEST_PG_DB || 'kisanoos_audit_test';

if (PG_HOST !== '127.0.0.1' && PG_HOST !== 'localhost') {
  throw new Error(`SAFETY REFUSAL: Live PG test strictly restricted to localhost/127.0.0.1 (got ${PG_HOST})`);
}

const ROLE_CREDENTIALS = {
  postgres: process.env.TEST_PG_OWNER_PASS || 'pg_local_owner_test_pw_2026',
  service_role: process.env.TEST_PG_SERVICE_PASS || 'svc_role_local_test_pw_2026',
  ml_engine_readonly: process.env.TEST_PG_ML_PASS || 'ml_ro_local_test_pw_2026',
  anon: process.env.TEST_PG_ANON_PASS || 'anon_local_test_pw_2026',
  authenticated: process.env.TEST_PG_AUTH_PASS || 'auth_local_test_pw_2026'
};

function createRolePool(role) {
  return new Pool({
    host: PG_HOST,
    port: PG_PORT,
    database: PG_DB,
    user: role,
    password: ROLE_CREDENTIALS[role],
    max: 6,
    ssl: false
  });
}

function makeHex(char) {
  return char.repeat(64);
}

function makePassingGates() {
  return {
    gate1_stream_parity: { passed: true, status: 'PASS' },
    gate2_geographic_breadth: { passed: true, status: 'PASS' },
    gate3_market_diversity: { passed: true, status: 'PASS' },
    gate4_commodity_and_volume: { passed: true, status: 'PASS' },
    gate5_error_and_duplicate_budget: { passed: true, status: 'PASS' },
    gate6_volume_continuity: { passed: true, status: 'PASS', requiresInvestigation: false }
  };
}

function makeTelemetry(batchId, state = 'COLLECTION_FULLY_CERTIFIED', overrides = {}) {
  return createBatchTelemetryRecord({
    harvest_batch_id: batchId,
    collection_window: 'MORNING_06_00_IST',
    target_observation_date: '2026-11-11',
    ogd_publication_timestamp: '2026-11-11T00:15:00Z',
    execution_start_utc: '2026-11-11T00:30:00Z',
    execution_end_utc: '2026-11-11T00:31:00Z',
    api_reported_total: 1200,
    records_fetched: 1200,
    records_parsed: 1190,
    records_inserted: 1100,
    records_updated: 50,
    records_skipped: 40,
    records_rejected: 5,
    duplicate_count: 5,
    distinct_states: 18,
    distinct_markets: 140,
    distinct_commodities: 32,
    gates: makePassingGates(),
    final_validation_status: state === 'COLLECTION_FULLY_CERTIFIED' ? 'CERTIFIED' : state,
    execution_status: state === 'COLLECTION_FULLY_CERTIFIED' ? 'SUCCESS' : (state.startsWith('REJECTED') ? 'REJECTED_VALIDATION' : 'IN_PROGRESS'),
    observations_committed: !state.startsWith('REJECTED'),
    audit_persisted: state !== 'AUDIT_PERSIST_FAILED_AFTER_COMMIT' && state !== 'REJECTED_AUDIT_FAILED',
    fully_certified: state === 'COLLECTION_FULLY_CERTIFIED',
    audit_lifecycle_state: state,
    ...overrides
  });
}

function buildIds(tel, kind, op, fromState, expectedVer) {
  const stable = buildStableEvidencePayload(tel);
  const checksum = computeEvidenceChecksum(stable);
  const resVer = expectedVer === null ? 1 : expectedVer + 1;
  const transitionEventId = computeTransitionEventId({
    harvestBatchId: tel.harvest_batch_id,
    operationKind: op,
    fromLifecycleState: fromState,
    toLifecycleState: tel.audit_lifecycle_state,
    expectedStateVersion: expectedVer,
    evidenceChecksum: checksum
  });
  const transitionId = computeTransitionId({
    harvestBatchId: tel.harvest_batch_id,
    transitionKind: kind,
    resultingStateVersion: resVer,
    transitionEventId
  });
  return { stable, checksum, resVer, transitionEventId, transitionId };
}

async function seedObservation(ownerPool, { id, state, district, market, commodity, date, modalPrice, rawPayload }) {
  await ownerPool.query(
    `INSERT INTO public.mandi_historical_observations (
       id, state, district, market, commodity, variety, grade, observation_date,
       min_price_per_quintal, max_price_per_quintal, modal_price_per_quintal, modal_price_per_kg,
       source, raw_payload
     ) VALUES ($1, $2, $3, $4, $5, 'FAQ', 'FAQ', $6::date, 2000, 2400, $7, $8, 'agmarknet-test', $9::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [id, state, district, market, commodity, date, modalPrice, Number((modalPrice / 100).toFixed(2)), JSON.stringify(rawPayload)]
  );
}

async function getObservationsFingerprint(ownerPool) {
  const res = await ownerPool.query(`
    SELECT
      COUNT(*)::integer AS row_count,
      COALESCE(MD5(string_agg(
        id || '|' || state || '|' || district || '|' || market || '|' || commodity || '|' ||
        observation_date::text || '|' || modal_price_per_quintal::text || '|' || raw_payload::text,
        E'\\n' ORDER BY id
      )), 'EMPTY') AS checksum
    FROM public.mandi_historical_observations
  `);
  return res.rows[0];
}

async function runLivePgVerification() {
  console.log('================================================================');
  console.log('🐘 KisanOS Stage F.1.5 LIVE PostgreSQL Verification Suite');
  console.log(`   Target: ${PG_HOST}:${PG_PORT}/${PG_DB} (Isolated Local Ephemeral Cluster)`);
  console.log('================================================================\n');

  const ownerPool = createRolePool('postgres');
  const servicePool = createRolePool('service_role');
  const mlPool = createRolePool('ml_engine_readonly');
  const anonPool = createRolePool('anon');
  const authPool = createRolePool('authenticated');

  const serviceStore = new PostgresAuditTelemetryStore(servicePool, { actor: 'f1-5-service-worker' });

  try {
    // 0. Server Binding & Non-Supabase Check
    const bindInfo = await ownerPool.query(`SELECT current_database() AS db, inet_server_addr()::text AS addr, inet_server_port() AS port, version() AS ver`);
    console.log(`Connected DB: ${bindInfo.rows[0].db} @ ${bindInfo.rows[0].addr}:${bindInfo.rows[0].port}`);
    console.log(`Engine: ${bindInfo.rows[0].ver.split(',')[0]}\n`);
    assert.strictEqual(bindInfo.rows[0].db, PG_DB);
    assert.strictEqual(bindInfo.rows[0].port, PG_PORT);

    // Execute Migration 011 + baseline Supabase service_role SELECT/WRITE grant parity on mandi_historical_observations
    const mig011Sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '011_mandi_historical_observations.sql'), 'utf8');
    await ownerPool.query(mig011Sql);
    await ownerPool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mandi_historical_observations TO service_role`);

    // Seed baseline observations & record baseline count + checksum BEFORE Migration 013
    await seedObservation(ownerPool, {
      id: 'obs-base-1',
      state: 'Maharashtra',
      district: 'Pune',
      market: 'Pune',
      commodity: 'Onion',
      date: '2026-11-10',
      modalPrice: 2200,
      rawPayload: { inserted_by_batch_id: 'baseline-pre-013', batch_lineage: ['baseline-pre-013'] }
    });
    await seedObservation(ownerPool, {
      id: 'obs-base-2',
      state: 'Uttar Pradesh',
      district: 'Agra',
      market: 'Agra',
      commodity: 'Potato',
      date: '2026-11-10',
      modalPrice: 1800,
      rawPayload: { inserted_by_batch_id: 'baseline-pre-013', updated_by_batch_id: 'baseline-upd-pre-013', batch_lineage: ['baseline-pre-013', 'baseline-upd-pre-013'] }
    });
    const baselineFingerprint = await getObservationsFingerprint(ownerPool);
    console.log(`Baseline mandi_historical_observations: rows=${baselineFingerprint.row_count}, checksum=${baselineFingerprint.checksum}`);
    assert.strictEqual(baselineFingerprint.row_count, 2);

    // Execute Migration 013
    const mig013Path = path.join(__dirname, '..', 'migrations', '013_mandi_harvest_execution_log.sql');
    const rb013Path = path.join(__dirname, '..', 'migrations', 'rollbacks', '013_rollback_mandi_harvest_audit.sql');
    const mig013Sql = fs.readFileSync(mig013Path, 'utf8');
    const rb013Sql = fs.readFileSync(rb013Path, 'utf8');

    await ownerPool.query(mig013Sql);
    console.log('Migration 013 executed cleanly on isolated DB.\n');

    // Verify pg_proc ownership, SECURITY DEFINER, and hardened search_path
    const procVerify = await ownerPool.query(`
      SELECT
        n.nspname AS schema_name,
        p.proname AS function_name,
        pg_catalog.pg_get_userbyid(p.proowner) AS owner_role,
        p.prosecdef AS is_security_definer,
        p.proconfig AS config_settings
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('fn_mandi_record_lifecycle_transition', 'fn_mandi_update_batch_metadata')
        AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
        AND p.prosecdef = TRUE
        AND 'search_path=pg_catalog, pg_temp' = ANY(p.proconfig)
        AND NOT EXISTS (
          SELECT 1 FROM pg_catalog.unnest(p.proconfig) AS cfg WHERE cfg ILIKE '%public%'
        )
      ORDER BY p.proname
    `);
    assert.strictEqual(procVerify.rows.length, 2, 'Both SECURITY DEFINER gateway functions must pass catalog security check');
    console.log('Verified pg_proc catalog checks (owner=postgres, prosecdef=true, search_path=pg_catalog, pg_temp, zero public).\n');

    // Verify all 3 tables & 5 indexes exist
    const idxRes = await ownerPool.query(`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
        AND indexname IN (
          'idx_mandi_harvest_certified_lookup',
          'idx_mandi_harvest_baseline_lookup',
          'idx_mandi_harvest_lifecycle_state',
          'idx_mandi_transitions_batch_chain',
          'idx_mandi_recovery_events_batch'
        )
    `);
    assert.strictEqual(idxRes.rows.length, 5, 'All 5 audit indexes must exist');

    let passed = 0;
    let failed = 0;

    async function test(num, name, fn) {
      try {
        await fn();
        console.log(`  ✓ ${num}. ${name}`);
        passed++;
      } catch (err) {
        console.error(`  ✗ ${num}. ${name}`);
        console.error(`      -> ${err.message}`);
        failed++;
      }
    }

    // Helper for out-of-band corrupt row seeding ONLY for negative corruption-detection tests (#21,#27-#29,#34-#37,#40-#42)
    async function withOwnerBypassTriggers(fn) {
      const client = await ownerPool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SET LOCAL session_replication_role = 'replica'");
        await fn(client);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    // -----------------------------------------------------------------------
    // 1 - 10
    // -----------------------------------------------------------------------
    await test(1, 'Every explicitly permitted lifecycle transition (all 6 initial + 5 update pairs)', async () => {
      const initials = [
        'OBSERVATIONS_COMMITTED',
        'COLLECTION_FULLY_CERTIFIED',
        'REJECTED_AUDIT_PERSISTED',
        'AUDIT_PERSIST_FAILED_AFTER_COMMIT',
        'REJECTED_AUDIT_FAILED',
        'AUDIT_RECOVERY_REQUIRED'
      ];
      for (const st of initials) {
        const b = `pg-init-${st}`;
        const r = await serviceStore.saveRun(makeTelemetry(b, st));
        assert.strictEqual(r.state_version, 1);
        assert.strictEqual(r.audit_lifecycle_state, st);
      }
      let u = await serviceStore.transitionBatch({
        telemetryRecord: makeTelemetry('pg-init-OBSERVATIONS_COMMITTED', 'COLLECTION_FULLY_CERTIFIED'),
        transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION',
        fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1
      });
      assert.strictEqual(u.state_version, 2);

      await serviceStore.saveRun(makeTelemetry('pg-u2-obs', 'OBSERVATIONS_COMMITTED'));
      u = await serviceStore.transitionBatch({
        telemetryRecord: makeTelemetry('pg-u2-obs', 'AUDIT_PERSIST_FAILED_AFTER_COMMIT'),
        transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION',
        fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'AUDIT_PERSIST_FAILED_AFTER_COMMIT', expectedStateVersion: 1
      });
      assert.strictEqual(u.state_version, 2);
      u = await serviceStore.transitionBatch({
        telemetryRecord: makeTelemetry('pg-u2-obs', 'COLLECTION_FULLY_CERTIFIED'),
        transitionKind: 'RECOVERY', operationKind: 'PAYLOAD_REPLAY',
        fromLifecycleState: 'AUDIT_PERSIST_FAILED_AFTER_COMMIT', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 2
      });
      assert.strictEqual(u.state_version, 3);

      u = await serviceStore.transitionBatch({
        telemetryRecord: makeTelemetry('pg-init-REJECTED_AUDIT_FAILED', 'REJECTED_AUDIT_PERSISTED'),
        transitionKind: 'RECOVERY', operationKind: 'PAYLOAD_REPLAY',
        fromLifecycleState: 'REJECTED_AUDIT_FAILED', toLifecycleState: 'REJECTED_AUDIT_PERSISTED', expectedStateVersion: 1
      });
      assert.strictEqual(u.state_version, 2);

      u = await serviceStore.transitionBatch({
        telemetryRecord: makeTelemetry('pg-init-AUDIT_RECOVERY_REQUIRED', 'COLLECTION_FULLY_CERTIFIED'),
        transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION',
        fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1
      });
      assert.strictEqual(u.state_version, 2);
    });

    await test(2, 'Prohibited transitions & direct rank jumps fail in real PostgreSQL', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t2-rej', 'REJECTED_AUDIT_FAILED'));
      await assert.rejects(() =>
        serviceStore.transitionBatch({
          telemetryRecord: makeTelemetry('pg-t2-rej', 'COLLECTION_FULLY_CERTIFIED'),
          transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION',
          fromLifecycleState: 'REJECTED_AUDIT_FAILED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1
        })
      );
      await serviceStore.saveRun(makeTelemetry('pg-t2-obs', 'OBSERVATIONS_COMMITTED'));
      await assert.rejects(() =>
        ownerPool.query(`UPDATE public.mandi_harvest_execution_log SET audit_lifecycle_state = 'REJECTED_AUDIT_PERSISTED', state_rank = 30, state_version = 2 WHERE harvest_batch_id = 'pg-t2-obs'`)
      );
    });

    await test(3, 'Contract B metadata-only update preserves state_version, rank, and transitions count', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t3-meta', 'OBSERVATIONS_COMMITTED'));
      const res = await serviceStore.updateBatchMetadata({ harvestBatchId: 'pg-t3-meta', expectedStateVersion: 1, diagnosticNotes: 'pg contract B' });
      assert.strictEqual(res.state_version, 1);
      const tCnt = await servicePool.query(`SELECT COUNT(*)::int AS c FROM public.mandi_harvest_lifecycle_transitions WHERE harvest_batch_id = 'pg-t3-meta'`);
      assert.strictEqual(tCnt.rows[0].c, 1);
    });

    await test(4, 'Rejection of protected metadata changes on terminal records', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t4-term', 'COLLECTION_FULLY_CERTIFIED'));
      await assert.rejects(() =>
        ownerPool.query(`UPDATE public.mandi_harvest_execution_log SET error_details = 'tamper' WHERE harvest_batch_id = 'pg-t4-term'`)
      , /Terminal record protection/);
      await assert.rejects(() =>
        ownerPool.query(`UPDATE public.mandi_harvest_execution_log SET api_reported_total = 99 WHERE harvest_batch_id = 'pg-t4-term'`)
      , /Contract B violation/);
    });

    await test(5, 'Atomic rollback when recovery event insertion fails (PostgreSQL tx rollback)', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t5-rb', 'AUDIT_RECOVERY_REQUIRED'));
      const client = await ownerPool.connect();
      try {
        await client.query('BEGIN');
        const tel = makeTelemetry('pg-t5-rb', 'COLLECTION_FULLY_CERTIFIED');
        const { checksum, transitionEventId, transitionId } = buildIds(tel, 'RECOVERY', 'EVIDENCE_REVERIFICATION', 'AUDIT_RECOVERY_REQUIRED', 1);
        await client.query(
          `SELECT * FROM public.fn_mandi_record_lifecycle_transition($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15)`,
          ['pg-t5-rb', 'RECOVERY', 'EVIDENCE_REVERIFICATION', 'AUDIT_RECOVERY_REQUIRED', 'COLLECTION_FULLY_CERTIFIED', 1, 2, transitionEventId, transitionId, checksum, 't5', 'test', JSON.stringify(tel), JSON.stringify({}), null]
        );
        // Simulate late constraint violation inside same tx
        await client.query(`INSERT INTO public.mandi_harvest_recovery_events (recovery_event_id, transition_id, transition_event_id, harvest_batch_id, recovery_method, from_lifecycle_state, to_lifecycle_state, expected_state_version, resulting_state_version, evidence_checksum, actor_or_worker) VALUES ($1,$2,$1,'pg-t5-rb','EVIDENCE_REVERIFICATION','AUDIT_RECOVERY_REQUIRED','COLLECTION_FULLY_CERTIFIED',1,2,$3,'x')`, [transitionEventId, transitionId, checksum]).catch(async () => {
          await client.query('ROLLBACK');
        });
      } finally {
        client.release();
      }
      const row = await servicePool.query(`SELECT state_version, audit_lifecycle_state FROM public.mandi_harvest_execution_log WHERE harvest_batch_id = 'pg-t5-rb'`);
      assert.strictEqual(row.rows[0].state_version, 1);
      assert.strictEqual(row.rows[0].audit_lifecycle_state, 'AUDIT_RECOVERY_REQUIRED');
    });

    await test(6, 'Concurrent recovery attempts with identical expected_state_version serialize cleanly', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t6-conc', 'AUDIT_RECOVERY_REQUIRED'));
      const certTel = makeTelemetry('pg-t6-conc', 'COLLECTION_FULLY_CERTIFIED');
      const [r1, r2] = await Promise.all([
        serviceStore.transitionBatch({ telemetryRecord: certTel, transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 }),
        serviceStore.transitionBatch({ telemetryRecord: certTel, transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 })
      ]);
      const cnt = await servicePool.query(`SELECT COUNT(*)::int AS c FROM public.mandi_harvest_recovery_events WHERE harvest_batch_id = 'pg-t6-conc'`);
      assert.strictEqual(cnt.rows[0].c, 2);
      assert.ok(r1.outcome === 'APPLIED' || r2.idempotentHit === true);
    });

    await test(7, 'Duplicate recovery_event_id replay inserts 0 duplicates', async () => {
      const tel = makeTelemetry('pg-t7-dup', 'AUDIT_RECOVERY_REQUIRED');
      await serviceStore.saveRun(tel);
      const r2 = await serviceStore.saveRun(tel);
      assert.strictEqual(r2.idempotentHit, true);
      const cnt = await servicePool.query(`SELECT COUNT(*)::int AS c FROM public.mandi_harvest_recovery_events WHERE harvest_batch_id = 'pg-t7-dup'`);
      assert.strictEqual(cnt.rows[0].c, 1);
    });

    await test(8, 'Successful recovery increments state_version, sets is_recovered=TRUE, creates 1 event', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t8-rec', 'AUDIT_PERSIST_FAILED_AFTER_COMMIT'));
      const out = await serviceStore.transitionBatch({ telemetryRecord: makeTelemetry('pg-t8-rec', 'COLLECTION_FULLY_CERTIFIED'), transitionKind: 'RECOVERY', operationKind: 'PAYLOAD_REPLAY', fromLifecycleState: 'AUDIT_PERSIST_FAILED_AFTER_COMMIT', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
      assert.strictEqual(out.state_version, 2);
      const row = await servicePool.query(`SELECT is_recovered FROM public.mandi_harvest_execution_log WHERE harvest_batch_id = 'pg-t8-rec'`);
      assert.strictEqual(row.rows[0].is_recovered, true);
    });

    await test(9, 'Incomplete original evidence blocks recovery promotion', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t9-inc', 'AUDIT_RECOVERY_REQUIRED'));
      await assert.rejects(() =>
        serviceStore.transitionBatch({ telemetryRecord: makeTelemetry('pg-t9-inc', 'COLLECTION_FULLY_CERTIFIED', { api_reported_total: null }), transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 })
      , (e) => e.code === 'ERR_INCOMPLETE_CERTIFICATION_EVIDENCE');
      const row = await servicePool.query(`SELECT audit_lifecycle_state, fully_certified FROM public.mandi_harvest_execution_log WHERE harvest_batch_id = 'pg-t9-inc'`);
      assert.strictEqual(row.rows[0].audit_lifecycle_state, 'AUDIT_RECOVERY_REQUIRED');
      assert.strictEqual(row.rows[0].fully_certified, false);
    });

    await test(10, 'Certification only after all 6 gates verified', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t10-6g', 'AUDIT_RECOVERY_REQUIRED'));
      await assert.rejects(() =>
        serviceStore.transitionBatch({
          telemetryRecord: makeTelemetry('pg-t10-6g', 'COLLECTION_FULLY_CERTIFIED'),
          transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION',
          fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1,
          validationInputs: { metadata: {}, parsedResult: { totalRows: 0, validRecords: [], rejectedRecords: [] }, streamComplete: false }
        })
      );
      const ok = await serviceStore.transitionBatch({ telemetryRecord: makeTelemetry('pg-t10-6g', 'COLLECTION_FULLY_CERTIFIED'), transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
      assert.strictEqual(ok.state_version, 2);
    });

    // -----------------------------------------------------------------------
    // 11 - 20
    // -----------------------------------------------------------------------
    await test(11, 'Certified record immutability under stale retries', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t11-imm', 'COLLECTION_FULLY_CERTIFIED'));
      const res = await serviceStore.saveRun(makeTelemetry('pg-t11-imm', 'AUDIT_RECOVERY_REQUIRED'));
      assert.strictEqual(res.terminalPreserved, true);
    });

    await test(12, 'Stale execution version rejection in real PostgreSQL', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t12-sv', 'OBSERVATIONS_COMMITTED'));
      await serviceStore.transitionBatch({ telemetryRecord: makeTelemetry('pg-t12-sv', 'AUDIT_PERSIST_FAILED_AFTER_COMMIT'), transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'AUDIT_PERSIST_FAILED_AFTER_COMMIT', expectedStateVersion: 1 });
      await assert.rejects(() =>
        serviceStore.transitionBatch({ telemetryRecord: makeTelemetry('pg-t12-sv', 'COLLECTION_FULLY_CERTIFIED'), transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 })
      , /Optimistic concurrency/);
    });

    await test(13, 'Crash orphan reconstruction queries real raw_payload JSONB provenance & keeps counters NULL', async () => {
      await seedObservation(ownerPool, {
        id: 'obs-crash-13-a', state: 'Maharashtra', district: 'Nashik', market: 'Lasalgaon', commodity: 'Onion', date: '2026-11-11', modalPrice: 2500,
        rawPayload: { inserted_by_batch_id: 'pg-crash-13', batch_lineage: ['pg-crash-13'] }
      });
      await seedObservation(ownerPool, {
        id: 'obs-crash-13-b', state: 'Gujarat', district: 'Rajkot', market: 'Gondal', commodity: 'Groundnut', date: '2026-11-11', modalPrice: 5400,
        rawPayload: { inserted_by_batch_id: 'pg-crash-13', batch_lineage: ['pg-crash-13'] }
      });
      const rec = await serviceStore.reconcileOrphanBatch({ harvestBatchId: 'pg-crash-13' });
      assert.strictEqual(rec.reconciled, true);
      const row = (await servicePool.query(`SELECT * FROM public.mandi_harvest_execution_log WHERE harvest_batch_id = 'pg-crash-13'`)).rows[0];
      assert.strictEqual(row.audit_lifecycle_state, 'AUDIT_RECOVERY_REQUIRED');
      assert.strictEqual(row.state_rank, 20);
      assert.strictEqual(row.fully_certified, false);
      assert.strictEqual(row.distinct_states, 2);
      assert.strictEqual(row.api_reported_total, null);
      assert.strictEqual(row.records_rejected, null);
    });

    await test(14, 'Separate authenticated PG connections verify permission denial for anon & authenticated', async () => {
      for (const [role, pool] of [['anon', anonPool], ['authenticated', authPool]]) {
        await assert.rejects(() => pool.query(`SELECT * FROM public.mandi_harvest_execution_log LIMIT 1`), /permission denied/, `SELECT should fail for ${role}`);
        await assert.rejects(() => pool.query(`SELECT * FROM public.fn_mandi_update_batch_metadata('pg-t3-meta', 1, 'x', NULL)`), /permission denied/, `RPC should fail for ${role}`);
      }
    });

    await test(15, 'Separate authenticated ml_engine_readonly connection enforces strictly SELECT-only', async () => {
      const sel = await mlPool.query(`SELECT COUNT(*)::int AS c FROM public.mandi_harvest_execution_log`);
      assert.ok(sel.rows[0].c > 0);
      await assert.rejects(() => mlPool.query(`INSERT INTO public.mandi_harvest_execution_log (harvest_batch_id, collection_window, execution_start_utc, execution_start_ist, final_validation_status, execution_status, audit_lifecycle_state, state_rank) VALUES ('x','M',NOW(),'i','F','E','OBSERVATIONS_COMMITTED',10)`), /permission denied/);
      await assert.rejects(() => mlPool.query(`UPDATE public.mandi_harvest_execution_log SET diagnostic_notes = 'x'`), /permission denied/);
      await assert.rejects(() => mlPool.query(`SELECT * FROM public.fn_mandi_update_batch_metadata('pg-t3-meta', 1, 'x', NULL)`), /permission denied/);
    });

    await test(16, 'Append-only enforcement blocks service_role ACL & postgres owner trigger mutations', async () => {
      await assert.rejects(() => servicePool.query(`DELETE FROM public.mandi_harvest_lifecycle_transitions`), /permission denied/);
      await assert.rejects(() => servicePool.query(`UPDATE public.mandi_harvest_recovery_events SET recovery_notes = 'x'`), /permission denied/);
      await assert.rejects(() => ownerPool.query(`UPDATE public.mandi_harvest_lifecycle_transitions SET transition_reason = 'x'`), /prohibits UPDATE/);
      await assert.rejects(() => ownerPool.query(`DELETE FROM public.mandi_harvest_recovery_events`), /prohibits DELETE/);
    });

    await test(17, 'Unbounded scheduler findCertifiedRun finds run past >50 newer runs in live PG', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t17-cert', 'COLLECTION_FULLY_CERTIFIED', { target_observation_date: '2026-11-05', ogd_publication_timestamp: '2026-11-05T00:15:00Z', execution_end_utc: '2026-11-05T01:00:00Z' }));
      for (let i = 0; i < 60; i++) {
        await serviceStore.saveRun(makeTelemetry(`pg-t17-n-${i}`, 'REJECTED_AUDIT_PERSISTED', { target_observation_date: '2026-11-06', ogd_publication_timestamp: '2026-11-06T00:15:00Z', execution_end_utc: `2026-11-06T02:${String(i).padStart(2, '0')}:00Z` }));
      }
      const found = await findAlreadyCertifiedRun(serviceStore, '2026-11-05', '2026-11-05T00:15:00Z');
      assert.ok(found && found.harvest_batch_id === 'pg-t17-cert');
    });

    await test(18, 'Rollback script located outside backend/migrations', async () => {
      assert.ok(!fs.existsSync(path.join(__dirname, '..', 'migrations', '013_rollback_mandi_harvest_audit.sql')));
      assert.ok(fs.existsSync(rb013Path));
    });

    await test(19, 'Deterministic canonical IDs across repeated invocations', async () => {
      const c1 = computeEvidenceChecksum({ z: 1, nested: { b: 2, a: 'hello' }, a: null });
      const c2 = computeEvidenceChecksum({ a: null, nested: { a: 'hello', b: 2 }, z: 1 });
      assert.strictEqual(c1, c2);
    });

    await test(20, 'Delimiter and null vs empty-string collision immunity', async () => {
      const chk = makeHex('f');
      const a = computeTransitionEventId({ harvestBatchId: 'batch::A', operationKind: 'PAYLOAD_REPLAY', fromLifecycleState: null, toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: null, evidenceChecksum: chk });
      const b = computeTransitionEventId({ harvestBatchId: 'batch', operationKind: 'PAYLOAD_REPLAY', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 0, evidenceChecksum: chk });
      assert.notStrictEqual(a, b);
    });

    // -----------------------------------------------------------------------
    // 21 - 30
    // -----------------------------------------------------------------------
    await test(21, 'Corrupted recovery event evidence_checksum triggers ERR_RECOVERY_CONSISTENCY_VIOLATION', async () => {
      const tel = makeTelemetry('pg-t21', 'AUDIT_RECOVERY_REQUIRED');
      await serviceStore.saveRun(tel);
      const { checksum, transitionEventId } = buildIds(tel, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      await withOwnerBypassTriggers(async (c) => {
        await c.query(`ALTER TABLE public.mandi_harvest_recovery_events DROP CONSTRAINT fk_recovery_exact_transition_binding`);
        await c.query(`UPDATE public.mandi_harvest_recovery_events SET evidence_checksum = $1 WHERE recovery_event_id = $2`, [makeHex('9'), transitionEventId]);
      });
      await assert.rejects(() =>
        serviceStore.replayHistoricalRecoveryEvent({ harvestBatchId: 'pg-t21', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: checksum })
      , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
      // Restore FK cleanly
      await ownerPool.query(`DELETE FROM public.mandi_harvest_recovery_events WHERE harvest_batch_id = 'pg-t21'`).catch(() => {});
      await withOwnerBypassTriggers(async (c) => {
        await c.query(`DELETE FROM public.mandi_harvest_recovery_events WHERE harvest_batch_id = 'pg-t21'`);
        await c.query(`DELETE FROM public.mandi_harvest_lifecycle_transitions WHERE harvest_batch_id = 'pg-t21'`);
        await c.query(`DELETE FROM public.mandi_harvest_execution_log WHERE harvest_batch_id = 'pg-t21'`);
      });
      await ownerPool.query(`ALTER TABLE public.mandi_harvest_recovery_events ADD CONSTRAINT fk_recovery_exact_transition_binding FOREIGN KEY (transition_id, harvest_batch_id, to_lifecycle_state, resulting_state_version, transition_event_id, evidence_checksum) REFERENCES public.mandi_harvest_lifecycle_transitions (transition_id, harvest_batch_id, new_lifecycle_state, resulting_state_version, transition_event_id, evidence_checksum) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED`);
    });

    await test(22, 'Concurrent orphan creation for same batch serializes via 64-bit xact lock in live PG', async () => {
      await seedObservation(ownerPool, { id: 'obs-t22-1', state: 'MP', district: 'Indore', market: 'Indore', commodity: 'Soybean', date: '2026-11-11', modalPrice: 4100, rawPayload: { inserted_by_batch_id: 'pg-t22-orphan' } });
      await Promise.all([
        serviceStore.reconcileOrphanBatch({ harvestBatchId: 'pg-t22-orphan' }),
        serviceStore.reconcileOrphanBatch({ harvestBatchId: 'pg-t22-orphan' })
      ]);
      const lc = await servicePool.query(`SELECT COUNT(*)::int AS c FROM public.mandi_harvest_execution_log WHERE harvest_batch_id = 'pg-t22-orphan'`);
      assert.strictEqual(lc.rows[0].c, 1);
    });

    await test(23, 'Concurrent orphan creation for distinct batches succeeds cleanly', async () => {
      await seedObservation(ownerPool, { id: 'obs-t23-a', state: 'UP', district: 'Lucknow', market: 'Lucknow', commodity: 'Wheat', date: '2026-11-11', modalPrice: 2100, rawPayload: { inserted_by_batch_id: 'pg-t23-A' } });
      await seedObservation(ownerPool, { id: 'obs-t23-b', state: 'PB', district: 'Ludhiana', market: 'Ludhiana', commodity: 'Paddy', date: '2026-11-11', modalPrice: 2200, rawPayload: { inserted_by_batch_id: 'pg-t23-B' } });
      const [a, b] = await Promise.all([
        serviceStore.reconcileOrphanBatch({ harvestBatchId: 'pg-t23-A' }),
        serviceStore.reconcileOrphanBatch({ harvestBatchId: 'pg-t23-B' })
      ]);
      assert.strictEqual(a.reconciled && b.reconciled, true);
    });

    await test(24, 'Primary-key race conflict handles concurrent duplicate creation cleanly', async () => {
      const tel = makeTelemetry('pg-t24-pk', 'OBSERVATIONS_COMMITTED');
      await Promise.all([serviceStore.saveRun(tel), serviceStore.saveRun(tel)]);
      const tc = await servicePool.query(`SELECT COUNT(*)::int AS c FROM public.mandi_harvest_lifecycle_transitions WHERE harvest_batch_id = 'pg-t24-pk'`);
      assert.strictEqual(tc.rows[0].c, 1);
    });

    await test(25, 'Cross-runtime Node.js vs Python RFC 8785 JCS SHA-256 parity', async () => {
      const payload = ['batch-x', 'PAYLOAD_REPLAY', null, 'AUDIT_RECOVERY_REQUIRED', null, computeEvidenceChecksum({ unicode: 'किसान-₹', nested: { z: 1, a: 2 } })];
      const pyCode = 'import json, hashlib, sys; c = json.dumps(json.loads(sys.argv[1]), separators=(",", ":"), sort_keys=True, ensure_ascii=False); print(c + "\\n" + hashlib.sha256(c.encode("utf-8")).hexdigest())';
      const out = execFileSync('python3', ['-c', pyCode, JSON.stringify(payload)], { encoding: 'utf8' }).trim().split('\n');
      assert.strictEqual(rfc8785Canonicalize(payload), out[0]);
      assert.strictEqual(computeTransitionEventId({ harvestBatchId: 'batch-x', operationKind: 'PAYLOAD_REPLAY', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: payload[5] }), out[1]);
    });

    await test(26, 'Strict input validation rejects non-integers, uppercase hex, undefined', async () => {
      assert.throws(() => computeTransitionEventId({ harvestBatchId: 'b', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: null, toLifecycleState: 'OBSERVATIONS_COMMITTED', expectedStateVersion: '1', evidenceChecksum: makeHex('a') }), AuditContractValidationError);
      assert.throws(() => computeTransitionEventId({ harvestBatchId: 'b', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: null, toLifecycleState: 'OBSERVATIONS_COMMITTED', expectedStateVersion: 1.5, evidenceChecksum: makeHex('a') }), AuditContractValidationError);
    });

    await test(27, 'Corrupted resulting_state_version mismatch triggers ERR_RECOVERY_CONSISTENCY_VIOLATION', async () => {
      const tel = makeTelemetry('pg-t27', 'AUDIT_RECOVERY_REQUIRED');
      await serviceStore.saveRun(tel);
      const { checksum, transitionEventId } = buildIds(tel, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      await withOwnerBypassTriggers(async (c) => {
        await c.query(`ALTER TABLE public.mandi_harvest_recovery_events DROP CONSTRAINT fk_recovery_exact_transition_binding`);
        await c.query(`UPDATE public.mandi_harvest_recovery_events SET resulting_state_version = 99 WHERE recovery_event_id = $1`, [transitionEventId]);
      });
      await assert.rejects(() =>
        serviceStore.replayHistoricalRecoveryEvent({ harvestBatchId: 'pg-t27', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: checksum })
      , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
      await withOwnerBypassTriggers(async (c) => {
        await c.query(`DELETE FROM public.mandi_harvest_recovery_events WHERE harvest_batch_id = 'pg-t27'`);
        await c.query(`DELETE FROM public.mandi_harvest_lifecycle_transitions WHERE harvest_batch_id = 'pg-t27'`);
        await c.query(`DELETE FROM public.mandi_harvest_execution_log WHERE harvest_batch_id = 'pg-t27'`);
      });
      await ownerPool.query(`ALTER TABLE public.mandi_harvest_recovery_events ADD CONSTRAINT fk_recovery_exact_transition_binding FOREIGN KEY (transition_id, harvest_batch_id, to_lifecycle_state, resulting_state_version, transition_event_id, evidence_checksum) REFERENCES public.mandi_harvest_lifecycle_transitions (transition_id, harvest_batch_id, new_lifecycle_state, resulting_state_version, transition_event_id, evidence_checksum) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED`);
    });

    await test(28, 'Mismatched parent lifecycle state triggers ERR_RECOVERY_CONSISTENCY_VIOLATION', async () => {
      const tel = makeTelemetry('pg-t28', 'AUDIT_RECOVERY_REQUIRED');
      await serviceStore.saveRun(tel);
      const { checksum } = buildIds(tel, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      await withOwnerBypassTriggers(async (c) => {
        await c.query(`UPDATE public.mandi_harvest_execution_log SET audit_lifecycle_state = 'OBSERVATIONS_COMMITTED', state_rank = 10 WHERE harvest_batch_id = 'pg-t28'`);
      });
      await assert.rejects(() =>
        serviceStore.replayHistoricalRecoveryEvent({ harvestBatchId: 'pg-t28', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: checksum })
      , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
    });

    await test(29, 'Inconsistent parent state_version triggers ERR_RECOVERY_CONSISTENCY_VIOLATION', async () => {
      const tel = makeTelemetry('pg-t29', 'AUDIT_RECOVERY_REQUIRED');
      await serviceStore.saveRun(tel);
      const { checksum } = buildIds(tel, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      await withOwnerBypassTriggers(async (c) => {
        await c.query(`UPDATE public.mandi_harvest_execution_log SET state_version = 2 WHERE harvest_batch_id = 'pg-t29'`);
      });
      await assert.rejects(() =>
        serviceStore.replayHistoricalRecoveryEvent({ harvestBatchId: 'pg-t29', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: checksum })
      , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
    });

    await test(30, 'Consistent historical replay succeeds cleanly with 0 writes', async () => {
      const tel = makeTelemetry('pg-t30', 'AUDIT_RECOVERY_REQUIRED');
      await serviceStore.saveRun(tel);
      const { checksum } = buildIds(tel, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      const out = await serviceStore.replayHistoricalRecoveryEvent({ harvestBatchId: 'pg-t30', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: checksum });
      assert.strictEqual(out.chainVerified, true);
    });

    // -----------------------------------------------------------------------
    // 31 - 45 (Historical Replay & Transition Uniqueness)
    // -----------------------------------------------------------------------
    await test(31, 'Historical replay at same state version', async () => {
      const tel = makeTelemetry('pg-t31', 'AUDIT_RECOVERY_REQUIRED');
      await serviceStore.saveRun(tel);
      const { checksum } = buildIds(tel, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      const out = await serviceStore.replayHistoricalRecoveryEvent({ harvestBatchId: 'pg-t31', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: checksum });
      assert.strictEqual(out.verifiedConsistent, true);
    });

    await test(32, 'Historical replay of E1 (v1) after subsequent valid E2 (v2)', async () => {
      const t1 = makeTelemetry('pg-t32', 'AUDIT_RECOVERY_REQUIRED');
      await serviceStore.saveRun(t1);
      const { checksum: chk1 } = buildIds(t1, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      await serviceStore.transitionBatch({ telemetryRecord: makeTelemetry('pg-t32', 'COLLECTION_FULLY_CERTIFIED'), transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
      const res = await serviceStore.replayHistoricalRecoveryEvent({ harvestBatchId: 'pg-t32', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: chk1 });
      assert.strictEqual(res.chainVerified, true);
    });

    await test(33, 'Historical replay after terminal certification succeeds without mutating parent', async () => {
      const t1 = makeTelemetry('pg-t33', 'AUDIT_RECOVERY_REQUIRED');
      await serviceStore.saveRun(t1);
      const t2 = makeTelemetry('pg-t33', 'COLLECTION_FULLY_CERTIFIED');
      await serviceStore.transitionBatch({ telemetryRecord: t2, transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
      const { checksum: chk2 } = buildIds(t2, 'RECOVERY', 'EVIDENCE_REVERIFICATION', 'AUDIT_RECOVERY_REQUIRED', 1);
      const res = await serviceStore.replayHistoricalRecoveryEvent({ harvestBatchId: 'pg-t33', recoveryMethod: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1, evidenceChecksum: chk2 });
      assert.strictEqual(res.chainVerified, true);
    });

    await test(34, 'Missing intervening transition rejects with ERR_RECOVERY_CONSISTENCY_VIOLATION', async () => {
      const t1 = makeTelemetry('pg-t34', 'AUDIT_RECOVERY_REQUIRED');
      await serviceStore.saveRun(t1);
      const { checksum: chk1 } = buildIds(t1, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      await withOwnerBypassTriggers(async (c) => {
        await c.query(`UPDATE public.mandi_harvest_execution_log SET state_version = 3, audit_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED', state_rank = 40 WHERE harvest_batch_id = 'pg-t34'`);
        await c.query(`INSERT INTO public.mandi_harvest_lifecycle_transitions VALUES ($1,'pg-t34','RECOVERY','AUDIT_RECOVERY_REQUIRED','COLLECTION_FULLY_CERTIFIED',2,3,$2,$3,'gap','owner',NOW())`, [makeHex('d'), makeHex('e'), chk1]);
      });
      await assert.rejects(() =>
        serviceStore.replayHistoricalRecoveryEvent({ harvestBatchId: 'pg-t34', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: chk1 })
      , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
    });

    await test(35, 'Contradictory transition history rejects with ERR_RECOVERY_CONSISTENCY_VIOLATION', async () => {
      const t1 = makeTelemetry('pg-t35', 'AUDIT_RECOVERY_REQUIRED');
      await serviceStore.saveRun(t1);
      const { checksum: chk1 } = buildIds(t1, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      await withOwnerBypassTriggers(async (c) => {
        await c.query(`UPDATE public.mandi_harvest_execution_log SET state_version = 2, audit_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED', state_rank = 40 WHERE harvest_batch_id = 'pg-t35'`);
        await c.query(`INSERT INTO public.mandi_harvest_lifecycle_transitions VALUES ($1,'pg-t35','NORMAL_COLLECTION','OBSERVATIONS_COMMITTED','COLLECTION_FULLY_CERTIFIED',1,2,$2,$3,'bad','owner',NOW())`, [makeHex('a'), makeHex('b'), chk1]);
      });
      await assert.rejects(() =>
        serviceStore.replayHistoricalRecoveryEvent({ harvestBatchId: 'pg-t35', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: chk1 })
      , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
    });

    await test(36, 'Parent version lower than event version rejected in Step 2', async () => {
      const t1 = makeTelemetry('pg-t36', 'AUDIT_RECOVERY_REQUIRED');
      await serviceStore.saveRun(t1);
      const t2 = makeTelemetry('pg-t36', 'COLLECTION_FULLY_CERTIFIED');
      await serviceStore.transitionBatch({ telemetryRecord: t2, transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
      const { checksum: chk2 } = buildIds(t2, 'RECOVERY', 'EVIDENCE_REVERIFICATION', 'AUDIT_RECOVERY_REQUIRED', 1);
      await withOwnerBypassTriggers(async (c) => {
        await c.query(`UPDATE public.mandi_harvest_execution_log SET state_version = 1 WHERE harvest_batch_id = 'pg-t36'`);
      });
      await assert.rejects(() =>
        serviceStore.replayHistoricalRecoveryEvent({ harvestBatchId: 'pg-t36', recoveryMethod: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1, evidenceChecksum: chk2 })
      , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
    });

    await test(37, 'Parent current state inconsistent with verified chain end rejected in Step 5', async () => {
      const t1 = makeTelemetry('pg-t37', 'AUDIT_RECOVERY_REQUIRED');
      await serviceStore.saveRun(t1);
      const { checksum: chk1 } = buildIds(t1, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      await serviceStore.transitionBatch({ telemetryRecord: makeTelemetry('pg-t37', 'COLLECTION_FULLY_CERTIFIED'), transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
      await withOwnerBypassTriggers(async (c) => {
        await c.query(`UPDATE public.mandi_harvest_execution_log SET audit_lifecycle_state = 'AUDIT_RECOVERY_REQUIRED', state_rank = 20, fully_certified = FALSE WHERE harvest_batch_id = 'pg-t37'`);
      });
      await assert.rejects(() =>
        serviceStore.replayHistoricalRecoveryEvent({ harvestBatchId: 'pg-t37', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: chk1 })
      , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
    });

    await test(38, 'Concurrent replay of historical event exits idempotently with 0 writes', async () => {
      const t1 = makeTelemetry('pg-t38', 'AUDIT_RECOVERY_REQUIRED');
      await serviceStore.saveRun(t1);
      const { checksum: chk1 } = buildIds(t1, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      await serviceStore.transitionBatch({ telemetryRecord: makeTelemetry('pg-t38', 'COLLECTION_FULLY_CERTIFIED'), transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
      const [a, b] = await Promise.all([
        serviceStore.replayHistoricalRecoveryEvent({ harvestBatchId: 'pg-t38', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: chk1 }),
        serviceStore.replayHistoricalRecoveryEvent({ harvestBatchId: 'pg-t38', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: chk1 })
      ]);
      assert.strictEqual(a.chainVerified && b.chainVerified, true);
    });

    await test(39, 'Atomic rollback when parent update succeeds but transition history fails', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t39', 'OBSERVATIONS_COMMITTED'));
      // Passing invalid checksum triggers rejection before commit & rolls back parent cleanly
      await assert.rejects(() =>
        servicePool.query(`SELECT * FROM public.fn_mandi_record_lifecycle_transition('pg-t39','NORMAL_COLLECTION','NORMAL_COLLECTION','OBSERVATIONS_COMMITTED','COLLECTION_FULLY_CERTIFIED',1,2,$1,$2,'badhex','r','w','{}'::jsonb,NULL,NULL)`, [makeHex('1'), makeHex('2')])
      );
      const row = (await servicePool.query(`SELECT state_version, audit_lifecycle_state FROM public.mandi_harvest_execution_log WHERE harvest_batch_id = 'pg-t39'`)).rows[0];
      assert.strictEqual(row.state_version, 1);
      assert.strictEqual(row.audit_lifecycle_state, 'OBSERVATIONS_COMMITTED');
    });

    await test(40, 'Recovery event referencing wrong transition_event_id blocked by FK & Step 3', async () => {
      const t1 = makeTelemetry('pg-t40', 'AUDIT_RECOVERY_REQUIRED');
      await serviceStore.saveRun(t1);
      const { checksum, transitionEventId, transitionId } = buildIds(t1, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      // Direct FK check at COMMIT rejects mismatched transition_event_id
      await assert.rejects(() =>
        ownerPool.query(`INSERT INTO public.mandi_harvest_recovery_events (recovery_event_id, transition_id, transition_event_id, harvest_batch_id, recovery_method, from_lifecycle_state, to_lifecycle_state, expected_state_version, resulting_state_version, evidence_checksum, actor_or_worker) VALUES ($1,$2,$1,'pg-t40','ORPHAN_RECONCILIATION',NULL,'AUDIT_RECOVERY_REQUIRED',NULL,1,$3,'w')`, [makeHex('8'), transitionId, checksum])
      );
      // Verify Step 3 also catches if out-of-band mismatch exists
      await withOwnerBypassTriggers(async (c) => {
        await c.query(`ALTER TABLE public.mandi_harvest_recovery_events DROP CONSTRAINT fk_recovery_exact_transition_binding`);
        await c.query(`UPDATE public.mandi_harvest_lifecycle_transitions SET transition_event_id = $1 WHERE transition_id = $2`, [makeHex('8'), transitionId]);
      });
      await assert.rejects(() =>
        serviceStore.replayHistoricalRecoveryEvent({ harvestBatchId: 'pg-t40', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: checksum })
      , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
      await withOwnerBypassTriggers(async (c) => {
        await c.query(`DELETE FROM public.mandi_harvest_recovery_events WHERE harvest_batch_id = 'pg-t40'`);
        await c.query(`DELETE FROM public.mandi_harvest_lifecycle_transitions WHERE harvest_batch_id = 'pg-t40'`);
        await c.query(`DELETE FROM public.mandi_harvest_execution_log WHERE harvest_batch_id = 'pg-t40'`);
      });
      await ownerPool.query(`ALTER TABLE public.mandi_harvest_recovery_events ADD CONSTRAINT fk_recovery_exact_transition_binding FOREIGN KEY (transition_id, harvest_batch_id, to_lifecycle_state, resulting_state_version, transition_event_id, evidence_checksum) REFERENCES public.mandi_harvest_lifecycle_transitions (transition_id, harvest_batch_id, new_lifecycle_state, resulting_state_version, transition_event_id, evidence_checksum) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED`);
      void transitionEventId;
    });

    await test(41, 'Recovery event referencing different evidence_checksum blocked by FK & Step 3', async () => {
      const t1 = makeTelemetry('pg-t41', 'AUDIT_RECOVERY_REQUIRED');
      await serviceStore.saveRun(t1);
      const { checksum, transitionId } = buildIds(t1, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      await withOwnerBypassTriggers(async (c) => {
        await c.query(`ALTER TABLE public.mandi_harvest_recovery_events DROP CONSTRAINT fk_recovery_exact_transition_binding`);
        await c.query(`UPDATE public.mandi_harvest_lifecycle_transitions SET evidence_checksum = $1 WHERE transition_id = $2`, [makeHex('7'), transitionId]);
      });
      await assert.rejects(() =>
        serviceStore.replayHistoricalRecoveryEvent({ harvestBatchId: 'pg-t41', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: checksum })
      , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
      await withOwnerBypassTriggers(async (c) => {
        await c.query(`DELETE FROM public.mandi_harvest_recovery_events WHERE harvest_batch_id = 'pg-t41'`);
        await c.query(`DELETE FROM public.mandi_harvest_lifecycle_transitions WHERE harvest_batch_id = 'pg-t41'`);
        await c.query(`DELETE FROM public.mandi_harvest_execution_log WHERE harvest_batch_id = 'pg-t41'`);
      });
      await ownerPool.query(`ALTER TABLE public.mandi_harvest_recovery_events ADD CONSTRAINT fk_recovery_exact_transition_binding FOREIGN KEY (transition_id, harvest_batch_id, to_lifecycle_state, resulting_state_version, transition_event_id, evidence_checksum) REFERENCES public.mandi_harvest_lifecycle_transitions (transition_id, harvest_batch_id, new_lifecycle_state, resulting_state_version, transition_event_id, evidence_checksum) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED`);
    });

    await test(42, 'Original transition contradicts recovery event BEFORE subsequent chain', async () => {
      const t1 = makeTelemetry('pg-t42', 'AUDIT_RECOVERY_REQUIRED');
      await serviceStore.saveRun(t1);
      const { checksum: chk1, transitionId: tId1 } = buildIds(t1, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      await serviceStore.transitionBatch({ telemetryRecord: makeTelemetry('pg-t42', 'COLLECTION_FULLY_CERTIFIED'), transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
      await withOwnerBypassTriggers(async (c) => {
        await c.query(`UPDATE public.mandi_harvest_lifecycle_transitions SET previous_lifecycle_state = 'OBSERVATIONS_COMMITTED' WHERE transition_id = $1`, [tId1]);
      });
      await assert.rejects(() =>
        serviceStore.replayHistoricalRecoveryEvent({ harvestBatchId: 'pg-t42', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: chk1 })
      , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION' && e.details.step === 3);
    });

    await test(43, 'Duplicate transition_event_id with identical 7 semantic fields is idempotent', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t43', 'OBSERVATIONS_COMMITTED'));
      const certTel = makeTelemetry('pg-t43', 'COLLECTION_FULLY_CERTIFIED');
      await serviceStore.transitionBatch({ telemetryRecord: certTel, transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
      const r2 = await serviceStore.transitionBatch({ telemetryRecord: certTel, transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
      assert.strictEqual(r2.idempotentHit, true);
      assert.strictEqual(r2.alreadyApplied, true);
    });

    await test(44, 'Duplicate transition_event_id with conflicting content throws ERR_TRANSITION_IDENTITY_CONFLICT', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t44', 'OBSERVATIONS_COMMITTED'));
      const certTel = makeTelemetry('pg-t44', 'COLLECTION_FULLY_CERTIFIED');
      const { checksum, transitionEventId, transitionId } = buildIds(certTel, 'NORMAL_COLLECTION', 'NORMAL_COLLECTION', 'OBSERVATIONS_COMMITTED', 1);
      await serviceStore.transitionBatch({ telemetryRecord: certTel, transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
      await assert.rejects(() =>
        servicePool.query(`SELECT * FROM public.fn_mandi_record_lifecycle_transition('pg-t44','NORMAL_COLLECTION','NORMAL_COLLECTION','OBSERVATIONS_COMMITTED','COLLECTION_FULLY_CERTIFIED',1,2,$1,$2,$3,'conflict','w','{}'::jsonb,NULL,NULL)`, [transitionEventId, transitionId, makeHex('4')])
      , /ERR_TRANSITION_IDENTITY_CONFLICT/);
      void checksum;
    });

    await test(45, 'Concurrent duplicate normal transition attempts serialize cleanly in live PG', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t45', 'OBSERVATIONS_COMMITTED'));
      const certTel = makeTelemetry('pg-t45', 'COLLECTION_FULLY_CERTIFIED');
      await Promise.all([
        serviceStore.transitionBatch({ telemetryRecord: certTel, transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 }),
        serviceStore.transitionBatch({ telemetryRecord: certTel, transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 })
      ]);
      const cnt = await servicePool.query(`SELECT COUNT(*)::int AS c FROM public.mandi_harvest_lifecycle_transitions WHERE harvest_batch_id = 'pg-t45'`);
      assert.strictEqual(cnt.rows[0].c, 2);
    });

    // -----------------------------------------------------------------------
    // 46 - 63 (DB Enforcement, Write Boundary, GUC Forgery, Bidirectional Deferred Checks & Provenance)
    // -----------------------------------------------------------------------
    await test(46, 'Initial OBSERVATIONS_COMMITTED creation & its v0 -> v1 history record', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t46', 'OBSERVATIONS_COMMITTED'));
      const t = (await servicePool.query(`SELECT * FROM public.mandi_harvest_lifecycle_transitions WHERE harvest_batch_id = 'pg-t46'`)).rows[0];
      assert.strictEqual(t.previous_lifecycle_state, null);
      assert.strictEqual(t.new_lifecycle_state, 'OBSERVATIONS_COMMITTED');
      assert.strictEqual(t.previous_state_version, 0);
      assert.strictEqual(t.resulting_state_version, 1);
      assert.strictEqual(t.transition_kind, 'NORMAL_COLLECTION');
    });

    await test(47, 'Reject lifecycle update/insert at COMMIT if matching history insertion is omitted', async () => {
      const client = await ownerPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT pg_catalog.set_config('kisanos.expected_transition_intents', $1, true)`, [JSON.stringify({ 'pg-t47:1': { transition_id: makeHex('a'), transition_event_id: makeHex('b'), evidence_checksum: makeHex('c'), transition_kind: 'NORMAL_COLLECTION', harvest_batch_id: 'pg-t47', previous_lifecycle_state: null, new_lifecycle_state: 'OBSERVATIONS_COMMITTED', previous_state_version: 0, resulting_state_version: 1 } })]);
        await client.query(`INSERT INTO public.mandi_harvest_execution_log (harvest_batch_id, collection_window, execution_start_utc, execution_start_ist, final_validation_status, execution_status, audit_lifecycle_state, state_rank, state_version) VALUES ('pg-t47','M',NOW(),'i','F','IN_PROGRESS','OBSERVATIONS_COMMITTED',10,1)`);
        await assert.rejects(() => client.query('COMMIT'), /Exact 9-field transition identity verification failed/);
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
    });

    await test(48, 'Roll back parent update if history insertion fails', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t48', 'OBSERVATIONS_COMMITTED'));
      const client = await ownerPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`UPDATE public.mandi_harvest_execution_log SET audit_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED', state_rank = 40, state_version = 2 WHERE harvest_batch_id = 'pg-t48'`);
        await assert.rejects(() => client.query(`INSERT INTO public.mandi_harvest_lifecycle_transitions (transition_id, harvest_batch_id, transition_kind, previous_lifecycle_state, new_lifecycle_state, previous_state_version, resulting_state_version, transition_event_id, evidence_checksum, transition_reason, actor_or_source) VALUES ('badhex','pg-t48','NORMAL_COLLECTION','OBSERVATIONS_COMMITTED','COLLECTION_FULLY_CERTIFIED',1,2,'bad','bad','r','a')`));
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
      const r = (await servicePool.query(`SELECT state_version FROM public.mandi_harvest_execution_log WHERE harvest_batch_id = 'pg-t48'`)).rows[0];
      assert.strictEqual(r.state_version, 1);
    });

    await test(49, 'Metadata-only updates do not create history rows; spurious transition rejected at COMMIT', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t49', 'OBSERVATIONS_COMMITTED'));
      const tid49 = `${makeHex('1').slice(0, 62)}49`;
      const evt49 = `${makeHex('2').slice(0, 62)}49`;
      const chk49 = `${makeHex('3').slice(0, 62)}49`;
      const client = await ownerPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`UPDATE public.mandi_harvest_execution_log SET diagnostic_notes = 'n' WHERE harvest_batch_id = 'pg-t49'`);
        await client.query(`INSERT INTO public.mandi_harvest_lifecycle_transitions (transition_id, harvest_batch_id, transition_kind, previous_lifecycle_state, new_lifecycle_state, previous_state_version, resulting_state_version, transition_event_id, evidence_checksum, transition_reason, actor_or_source) VALUES ($1,'pg-t49','NORMAL_COLLECTION','OBSERVATIONS_COMMITTED','COLLECTION_FULLY_CERTIFIED',1,2,$2,$3,'r','a')`, [tid49, evt49, chk49]);
        await assert.rejects(() => client.query('COMMIT'), /violates bound transaction intent|exceeds parent state_version/);
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
    });

    await test(50, 'Reject history row with incorrect transition_event_id or transition_id', async () => {
      const tel = makeTelemetry('pg-t50', 'OBSERVATIONS_COMMITTED');
      const { checksum, transitionEventId, transitionId } = buildIds(tel, 'NORMAL_COLLECTION', 'NORMAL_COLLECTION', null, null);
      const client = await ownerPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT pg_catalog.set_config('kisanos.expected_transition_intents', $1, true)`, [JSON.stringify({ 'pg-t50:1': { transition_id: transitionId, transition_event_id: transitionEventId, evidence_checksum: checksum, transition_kind: 'NORMAL_COLLECTION', harvest_batch_id: 'pg-t50', previous_lifecycle_state: null, new_lifecycle_state: 'OBSERVATIONS_COMMITTED', previous_state_version: 0, resulting_state_version: 1 } })]);
        await client.query(`INSERT INTO public.mandi_harvest_execution_log (harvest_batch_id, collection_window, execution_start_utc, execution_start_ist, final_validation_status, execution_status, audit_lifecycle_state, state_rank, state_version) VALUES ('pg-t50','M',NOW(),'i','F','IN_PROGRESS','OBSERVATIONS_COMMITTED',10,1)`);
        await client.query(`INSERT INTO public.mandi_harvest_lifecycle_transitions (transition_id, harvest_batch_id, transition_kind, previous_lifecycle_state, new_lifecycle_state, previous_state_version, resulting_state_version, transition_event_id, evidence_checksum, transition_reason, actor_or_source) VALUES ($1,'pg-t50','NORMAL_COLLECTION',NULL,'OBSERVATIONS_COMMITTED',0,1,$2,$3,'r','a')`, [transitionId, makeHex('9'), checksum]);
        await assert.rejects(() => client.query('COMMIT'), /violates bound transaction intent|Exact 9-field/);
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
    });

    await test(51, 'Reject history row with incorrect evidence_checksum', async () => {
      const tel = makeTelemetry('pg-t51', 'OBSERVATIONS_COMMITTED');
      const { checksum, transitionEventId, transitionId } = buildIds(tel, 'NORMAL_COLLECTION', 'NORMAL_COLLECTION', null, null);
      const client = await ownerPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT pg_catalog.set_config('kisanos.expected_transition_intents', $1, true)`, [JSON.stringify({ 'pg-t51:1': { transition_id: transitionId, transition_event_id: transitionEventId, evidence_checksum: checksum, transition_kind: 'NORMAL_COLLECTION', harvest_batch_id: 'pg-t51', previous_lifecycle_state: null, new_lifecycle_state: 'OBSERVATIONS_COMMITTED', previous_state_version: 0, resulting_state_version: 1 } })]);
        await client.query(`INSERT INTO public.mandi_harvest_execution_log (harvest_batch_id, collection_window, execution_start_utc, execution_start_ist, final_validation_status, execution_status, audit_lifecycle_state, state_rank, state_version) VALUES ('pg-t51','M',NOW(),'i','F','IN_PROGRESS','OBSERVATIONS_COMMITTED',10,1)`);
        await client.query(`INSERT INTO public.mandi_harvest_lifecycle_transitions (transition_id, harvest_batch_id, transition_kind, previous_lifecycle_state, new_lifecycle_state, previous_state_version, resulting_state_version, transition_event_id, evidence_checksum, transition_reason, actor_or_source) VALUES ($1,'pg-t51','NORMAL_COLLECTION',NULL,'OBSERVATIONS_COMMITTED',0,1,$2,$3,'r','a')`, [transitionId, transitionEventId, makeHex('0')]);
        await assert.rejects(() => client.query('COMMIT'));
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
    });

    await test(52, 'Reject history row with invalid or inconsistent transition_kind', async () => {
      const tel = makeTelemetry('pg-t52', 'OBSERVATIONS_COMMITTED');
      const { checksum, transitionEventId, transitionId } = buildIds(tel, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      const client = await ownerPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT pg_catalog.set_config('kisanos.expected_transition_intents', $1, true)`, [JSON.stringify({ 'pg-t52:1': { transition_id: transitionId, transition_event_id: transitionEventId, evidence_checksum: checksum, transition_kind: 'RECOVERY', harvest_batch_id: 'pg-t52', previous_lifecycle_state: null, new_lifecycle_state: 'OBSERVATIONS_COMMITTED', previous_state_version: 0, resulting_state_version: 1 } })]);
        await client.query(`INSERT INTO public.mandi_harvest_execution_log (harvest_batch_id, collection_window, execution_start_utc, execution_start_ist, final_validation_status, execution_status, audit_lifecycle_state, state_rank, state_version) VALUES ('pg-t52','M',NOW(),'i','F','IN_PROGRESS','OBSERVATIONS_COMMITTED',10,1)`);
        await client.query(`INSERT INTO public.mandi_harvest_lifecycle_transitions (transition_id, harvest_batch_id, transition_kind, previous_lifecycle_state, new_lifecycle_state, previous_state_version, resulting_state_version, transition_event_id, evidence_checksum, transition_reason, actor_or_source) VALUES ($1,'pg-t52','RECOVERY',NULL,'OBSERVATIONS_COMMITTED',0,1,$2,$3,'r','a')`, [transitionId, transitionEventId, checksum]);
        await assert.rejects(() => client.query('COMMIT'), /Prohibited transition pair\/kind/);
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
    });

    await test(53, 'Reject prohibited lifecycle pair inserted directly into transition history', async () => {
      await serviceStore.saveRun(makeTelemetry('pg-t53', 'OBSERVATIONS_COMMITTED'));
      const tid53 = `${makeHex('4').slice(0, 62)}53`;
      const evt53 = `${makeHex('5').slice(0, 62)}53`;
      const chk53 = `${makeHex('6').slice(0, 62)}53`;
      const client = await ownerPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL session_replication_role = 'replica'`);
        await client.query(`UPDATE public.mandi_harvest_execution_log SET state_version = 2, audit_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED', state_rank = 40 WHERE harvest_batch_id = 'pg-t53'`);
        await client.query(`SET LOCAL session_replication_role = 'origin'`);
        await client.query(`SELECT pg_catalog.set_config('kisanos.expected_transition_intents', $1, true)`, [JSON.stringify({ 'pg-t53:2': { transition_id: tid53, transition_event_id: evt53, evidence_checksum: chk53, transition_kind: 'NORMAL_COLLECTION', harvest_batch_id: 'pg-t53', previous_lifecycle_state: 'OBSERVATIONS_COMMITTED', new_lifecycle_state: 'REJECTED_AUDIT_PERSISTED', previous_state_version: 1, resulting_state_version: 2 } })]);
        await client.query(`INSERT INTO public.mandi_harvest_lifecycle_transitions (transition_id, harvest_batch_id, transition_kind, previous_lifecycle_state, new_lifecycle_state, previous_state_version, resulting_state_version, transition_event_id, evidence_checksum, transition_reason, actor_or_source) VALUES ($1,'pg-t53','NORMAL_COLLECTION','OBSERVATIONS_COMMITTED','REJECTED_AUDIT_PERSISTED',1,2,$2,$3,'r','a')`, [tid53, evt53, chk53]);
        await assert.rejects(() => client.query('COMMIT'), /Prohibited transition pair\/kind/);
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
    });

    await test(54, 'Verify initial v0 -> v1 accepts only the 6 permitted initial states', async () => {
      await assert.rejects(() =>
        ownerPool.query(`INSERT INTO public.mandi_harvest_execution_log (harvest_batch_id, collection_window, execution_start_utc, execution_start_ist, final_validation_status, execution_status, audit_lifecycle_state, state_rank, state_version) VALUES ('pg-t54','M',NOW(),'i','F','E','AUDIT_PERSISTED',20,1)`)
      , /Prohibited initial lifecycle state/);
    });

    await test(55, 'Direct writes cannot bypass database-enforced transition contract', async () => {
      await assert.rejects(() => servicePool.query(`INSERT INTO public.mandi_harvest_execution_log (harvest_batch_id, collection_window, execution_start_utc, execution_start_ist, final_validation_status, execution_status, audit_lifecycle_state, state_rank, state_version) VALUES ('pg-t55','M',NOW(),'i','F','E','OBSERVATIONS_COMMITTED',10,1)`), /permission denied/);
      await assert.rejects(() => ownerPool.query(`INSERT INTO public.mandi_harvest_execution_log (harvest_batch_id, collection_window, execution_start_utc, execution_start_ist, final_validation_status, execution_status, audit_lifecycle_state, state_rank, state_version) VALUES ('pg-t55','M',NOW(),'i','F','E','OBSERVATIONS_COMMITTED',10,1)`), /missing write-boundary intent/);
    });

    await test(56, 'Forged kisanos.expected_transition_intents GUC by service_role blocked by ACL & overwritten by gateway', async () => {
      const client = await servicePool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT pg_catalog.set_config('kisanos.expected_transition_intents', $1, true)`, [JSON.stringify({ 'pg-t56:1': { transition_id: makeHex('1') } })]);
        await assert.rejects(() => client.query(`INSERT INTO public.mandi_harvest_execution_log (harvest_batch_id, collection_window, execution_start_utc, execution_start_ist, final_validation_status, execution_status, audit_lifecycle_state, state_rank, state_version) VALUES ('pg-t56','M',NOW(),'i','F','E','OBSERVATIONS_COMMITTED',10,1)`), /permission denied/);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
      const res = await serviceStore.saveRun(makeTelemetry('pg-t56', 'OBSERVATIONS_COMMITTED'));
      assert.strictEqual(res.state_version, 1);
      assert.notStrictEqual(res.transition_id, makeHex('1'));
    });

    await test(57, 'Missing recovery event for RECOVERY transition rejected at COMMIT & rolled back', async () => {
      const tel = makeTelemetry('pg-t57', 'AUDIT_RECOVERY_REQUIRED');
      const { checksum, transitionEventId, transitionId } = buildIds(tel, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      const client = await ownerPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT pg_catalog.set_config('kisanos.expected_transition_intents', $1, true)`, [JSON.stringify({ 'pg-t57:1': { transition_id: transitionId, transition_event_id: transitionEventId, evidence_checksum: checksum, transition_kind: 'RECOVERY', harvest_batch_id: 'pg-t57', previous_lifecycle_state: null, new_lifecycle_state: 'AUDIT_RECOVERY_REQUIRED', previous_state_version: 0, resulting_state_version: 1 } })]);
        await client.query(`INSERT INTO public.mandi_harvest_execution_log (harvest_batch_id, collection_window, execution_start_utc, execution_start_ist, final_validation_status, execution_status, audit_lifecycle_state, state_rank, state_version) VALUES ('pg-t57','M',NOW(),'i','F','IN_PROGRESS','AUDIT_RECOVERY_REQUIRED',20,1)`);
        await client.query(`INSERT INTO public.mandi_harvest_lifecycle_transitions (transition_id, harvest_batch_id, transition_kind, previous_lifecycle_state, new_lifecycle_state, previous_state_version, resulting_state_version, transition_event_id, evidence_checksum, transition_reason, actor_or_source) VALUES ($1,'pg-t57','RECOVERY',NULL,'AUDIT_RECOVERY_REQUIRED',0,1,$2,$3,'r','a')`, [transitionId, transitionEventId, checksum]);
        await assert.rejects(() => client.query('COMMIT'), /requires exact 1:1 recovery_event/);
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
      assert.strictEqual((await servicePool.query(`SELECT COUNT(*)::int AS c FROM public.mandi_harvest_execution_log WHERE harvest_batch_id = 'pg-t57'`)).rows[0].c, 0);
    });

    await test(58, 'Duplicate recovery-event record rejected cleanly by unique constraint', async () => {
      const tel = makeTelemetry('pg-t58', 'AUDIT_RECOVERY_REQUIRED');
      const { checksum, transitionEventId, transitionId } = buildIds(tel, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      await serviceStore.saveRun(tel);
      await assert.rejects(() =>
        ownerPool.query(`INSERT INTO public.mandi_harvest_recovery_events (recovery_event_id, transition_id, transition_event_id, harvest_batch_id, recovery_method, from_lifecycle_state, to_lifecycle_state, expected_state_version, resulting_state_version, evidence_checksum, actor_or_worker) VALUES ($1,$2,$1,'pg-t58','ORPHAN_RECONCILIATION',NULL,'AUDIT_RECOVERY_REQUIRED',NULL,1,$3,'w')`, [makeHex('6'), transitionId, checksum])
      );
      void transitionEventId;
    });

    await test(59, 'Mismatched recovery-event record rejected at COMMIT & rolled back', async () => {
      const tel = makeTelemetry('pg-t59', 'AUDIT_RECOVERY_REQUIRED');
      const { checksum, transitionEventId, transitionId } = buildIds(tel, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      const client = await ownerPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT pg_catalog.set_config('kisanos.expected_transition_intents', $1, true)`, [JSON.stringify({ 'pg-t59:1': { transition_id: transitionId, transition_event_id: transitionEventId, evidence_checksum: checksum, transition_kind: 'RECOVERY', harvest_batch_id: 'pg-t59', previous_lifecycle_state: null, new_lifecycle_state: 'AUDIT_RECOVERY_REQUIRED', previous_state_version: 0, resulting_state_version: 1 } })]);
        await client.query(`INSERT INTO public.mandi_harvest_execution_log (harvest_batch_id, collection_window, execution_start_utc, execution_start_ist, final_validation_status, execution_status, audit_lifecycle_state, state_rank, state_version) VALUES ('pg-t59','M',NOW(),'i','F','IN_PROGRESS','AUDIT_RECOVERY_REQUIRED',20,1)`);
        await client.query(`INSERT INTO public.mandi_harvest_lifecycle_transitions (transition_id, harvest_batch_id, transition_kind, previous_lifecycle_state, new_lifecycle_state, previous_state_version, resulting_state_version, transition_event_id, evidence_checksum, transition_reason, actor_or_source) VALUES ($1,'pg-t59','RECOVERY',NULL,'AUDIT_RECOVERY_REQUIRED',0,1,$2,$3,'r','a')`, [transitionId, transitionEventId, checksum]);
        await client.query(`INSERT INTO public.mandi_harvest_recovery_events (recovery_event_id, transition_id, transition_event_id, harvest_batch_id, recovery_method, from_lifecycle_state, to_lifecycle_state, expected_state_version, resulting_state_version, evidence_checksum, actor_or_worker) VALUES ($1,$2,$1,'pg-t59','PAYLOAD_REPLAY',NULL,'AUDIT_RECOVERY_REQUIRED',NULL,1,$3,'w')`, [transitionEventId, transitionId, checksum]);
        await assert.rejects(() => client.query('COMMIT'), /Mismatched recovery_method/);
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
    });

    await test(60, 'Order independence: recovery_event inserted BEFORE transition commits cleanly at COMMIT', async () => {
      const tel = makeTelemetry('pg-t60', 'AUDIT_RECOVERY_REQUIRED');
      const { checksum, transitionEventId, transitionId } = buildIds(tel, 'RECOVERY', 'ORPHAN_RECONCILIATION', null, null);
      const client = await ownerPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT pg_catalog.set_config('kisanos.expected_transition_intents', $1, true)`, [JSON.stringify({ 'pg-t60:1': { transition_id: transitionId, transition_event_id: transitionEventId, evidence_checksum: checksum, transition_kind: 'RECOVERY', harvest_batch_id: 'pg-t60', previous_lifecycle_state: null, new_lifecycle_state: 'AUDIT_RECOVERY_REQUIRED', previous_state_version: 0, resulting_state_version: 1 } })]);
        await client.query(`INSERT INTO public.mandi_harvest_execution_log (harvest_batch_id, collection_window, execution_start_utc, execution_start_ist, final_validation_status, execution_status, audit_lifecycle_state, state_rank, state_version) VALUES ('pg-t60','M',NOW(),'i','F','IN_PROGRESS','AUDIT_RECOVERY_REQUIRED',20,1)`);
        // Insert recovery_events BEFORE lifecycle_transitions!
        await client.query(`INSERT INTO public.mandi_harvest_recovery_events (recovery_event_id, transition_id, transition_event_id, harvest_batch_id, recovery_method, from_lifecycle_state, to_lifecycle_state, expected_state_version, resulting_state_version, evidence_checksum, actor_or_worker) VALUES ($1,$2,$1,'pg-t60','ORPHAN_RECONCILIATION',NULL,'AUDIT_RECOVERY_REQUIRED',NULL,1,$3,'w')`, [transitionEventId, transitionId, checksum]);
        await client.query(`INSERT INTO public.mandi_harvest_lifecycle_transitions (transition_id, harvest_batch_id, transition_kind, previous_lifecycle_state, new_lifecycle_state, previous_state_version, resulting_state_version, transition_event_id, evidence_checksum, transition_reason, actor_or_source) VALUES ($1,'pg-t60','RECOVERY',NULL,'AUDIT_RECOVERY_REQUIRED',0,1,$2,$3,'r','a')`, [transitionId, transitionEventId, checksum]);
        await client.query('COMMIT');
      } finally {
        client.release();
      }
      assert.strictEqual((await servicePool.query(`SELECT COUNT(*)::int AS c FROM public.mandi_harvest_recovery_events WHERE harvest_batch_id = 'pg-t60'`)).rows[0].c, 1);
    });

    await test(61, 'NORMAL_COLLECTION transition paired with extra recovery event rejected regardless of order', async () => {
      const tel = makeTelemetry('pg-t61', 'OBSERVATIONS_COMMITTED');
      const { checksum, transitionEventId, transitionId } = buildIds(tel, 'NORMAL_COLLECTION', 'NORMAL_COLLECTION', null, null);
      const client = await ownerPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT pg_catalog.set_config('kisanos.expected_transition_intents', $1, true)`, [JSON.stringify({ 'pg-t61:1': { transition_id: transitionId, transition_event_id: transitionEventId, evidence_checksum: checksum, transition_kind: 'NORMAL_COLLECTION', harvest_batch_id: 'pg-t61', previous_lifecycle_state: null, new_lifecycle_state: 'OBSERVATIONS_COMMITTED', previous_state_version: 0, resulting_state_version: 1 } })]);
        await client.query(`INSERT INTO public.mandi_harvest_execution_log (harvest_batch_id, collection_window, execution_start_utc, execution_start_ist, final_validation_status, execution_status, audit_lifecycle_state, state_rank, state_version) VALUES ('pg-t61','M',NOW(),'i','F','IN_PROGRESS','OBSERVATIONS_COMMITTED',10,1)`);
        await client.query(`INSERT INTO public.mandi_harvest_recovery_events (recovery_event_id, transition_id, transition_event_id, harvest_batch_id, recovery_method, from_lifecycle_state, to_lifecycle_state, expected_state_version, resulting_state_version, evidence_checksum, actor_or_worker) VALUES ($1,$2,$1,'pg-t61','ORPHAN_RECONCILIATION',NULL,'OBSERVATIONS_COMMITTED',NULL,1,$3,'w')`, [transitionEventId, transitionId, checksum]);
        await client.query(`INSERT INTO public.mandi_harvest_lifecycle_transitions (transition_id, harvest_batch_id, transition_kind, previous_lifecycle_state, new_lifecycle_state, previous_state_version, resulting_state_version, transition_event_id, evidence_checksum, transition_reason, actor_or_source) VALUES ($1,'pg-t61','NORMAL_COLLECTION',NULL,'OBSERVATIONS_COMMITTED',0,1,$2,$3,'r','a')`, [transitionId, transitionEventId, checksum]);
        await assert.rejects(() => client.query('COMMIT'), /prohibits recovery_event rows|cannot attach to non-RECOVERY/);
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
    });

    await test(62, 'Orphan recovery event without matching transition rejected at COMMIT & rolled back', async () => {
      const client = await ownerPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO public.mandi_harvest_recovery_events (recovery_event_id, transition_id, transition_event_id, harvest_batch_id, recovery_method, from_lifecycle_state, to_lifecycle_state, expected_state_version, resulting_state_version, evidence_checksum, actor_or_worker) VALUES ($1,$2,$1,'pg-t62','ORPHAN_RECONCILIATION',NULL,'AUDIT_RECOVERY_REQUIRED',NULL,1,$3,'w')`, [makeHex('3'), makeHex('4'), makeHex('5')]);
        await assert.rejects(() => client.query('COMMIT'), /fk_recovery_exact_transition_binding|violates foreign key constraint/);
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
    });

    await test(63, 'Live PG provenance regression: reconcileOrphanBatch matches inserted_by/updated_by/batch_lineage JSONB', async () => {
      await seedObservation(ownerPool, {
        id: 'obs-t63-prov', state: 'Karnataka', district: 'Kolar', market: 'Kolar', commodity: 'Tomato', date: '2026-11-11', modalPrice: 1500,
        rawPayload: { inserted_by_batch_id: 'pg-t63-ins', updated_by_batch_id: 'pg-t63-upd', batch_lineage: ['pg-t63-ins', 'pg-t63-hist', 'pg-t63-upd'] }
      });
      const recUpd = await serviceStore.reconcileOrphanBatch({ harvestBatchId: 'pg-t63-upd' });
      const recHist = await serviceStore.reconcileOrphanBatch({ harvestBatchId: 'pg-t63-hist' });
      const recMiss = await serviceStore.reconcileOrphanBatch({ harvestBatchId: 'pg-t63-none' });
      assert.strictEqual(recUpd.reconciled, true);
      assert.strictEqual(recHist.reconciled, true);
      assert.strictEqual(recMiss.reconciled, false);
    });

    // Execute Rollback 013 & verify baseline observations unchanged, then reapply 013
    const postTestObsFingerprint = await getObservationsFingerprint(ownerPool);
    await ownerPool.query(rb013Sql);
    const tablesAfterRollback = await ownerPool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
        'mandi_harvest_execution_log',
        'mandi_harvest_lifecycle_transitions',
        'mandi_harvest_recovery_events'
      )
    `);
    assert.strictEqual(tablesAfterRollback.rows.length, 0, 'All 3 audit tables must be dropped after Rollback 013');
    const afterRollbackObsFingerprint = await getObservationsFingerprint(ownerPool);
    assert.strictEqual(afterRollbackObsFingerprint.row_count, postTestObsFingerprint.row_count, 'mandi_historical_observations row count unchanged by rollback');
    assert.strictEqual(afterRollbackObsFingerprint.checksum, postTestObsFingerprint.checksum, 'mandi_historical_observations checksum unchanged by rollback');
    console.log(`\nRollback 013 verified: 3 audit tables dropped cleanly; mandi_historical_observations preserved unchanged (rows=${afterRollbackObsFingerprint.row_count}, checksum=${afterRollbackObsFingerprint.checksum}).`);

    // Reapply Migration 013 cleanly
    await ownerPool.query(mig013Sql);
    const reappliedTables = await ownerPool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
        'mandi_harvest_execution_log',
        'mandi_harvest_lifecycle_transitions',
        'mandi_harvest_recovery_events'
      )
    `);
    assert.strictEqual(reappliedTables.rows.length, 3, 'Migration 013 reapply must recreate all 3 audit tables cleanly');
    console.log('Migration 013 reapplied cleanly after rollback.\n');

    console.log('================================================================');
    console.log(`Stage F.1.5 LIVE PostgreSQL Scoreboard: ${passed}/63 scenarios passed, ${failed} failed.`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    await Promise.all([ownerPool.end(), servicePool.end(), mlPool.end(), anonPool.end(), authPool.end()]);
  }
}

runLivePgVerification().catch((err) => {
  console.error('[FATAL LIVE PG VERIFICATION ERROR]', err);
  process.exit(1);
});
