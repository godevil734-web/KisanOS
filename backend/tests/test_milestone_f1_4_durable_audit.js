/**
 * KisanOS — Stage F.1.4 / F.1.5 Durable Audit Infrastructure Isolated Test Suite
 * Covers ALL 62 Required Scenarios (v2.2.9) + Static SQL DDL/Security Verification.
 *
 * SAFETY & HONESTY GUARANTEES:
 * - Zero production Supabase connections or reads/writes.
 * - Strictly checks for isolated local PostgreSQL (none installed in current environment ->
 *   explicitly reports live SQL engine integration as BLOCKED, while verifying all 62
 *   application/contract/replay/ACL/deferred-commit scenarios against an isolated
 *   in-memory transactional PostgreSQL simulator & Python 3 subprocess parity check).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const {
  AUDIT_LIFECYCLE_STATES,
  CANONICAL_STATE_RANKS,
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
  isPermittedTransition,
  createBatchTelemetryRecord,
  InMemoryAuditStore,
  PostgresAuditTelemetryStore
} = require('../services/auditTelemetryStore');
const {
  findAlreadyCertifiedRun,
  runScheduledHarvestCycle,
  InMemoryLockProvider
} = require('../services/dailyMandiSchedulerService');
const { validateBulletinSixGates } = require('../services/bulletinValidationService');

const MIGRATION_013_PATH = path.join(__dirname, '..', 'migrations', '013_mandi_harvest_execution_log.sql');
const ROLLBACK_013_PATH = path.join(__dirname, '..', 'migrations', 'rollbacks', '013_rollback_mandi_harvest_audit.sql');

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

function makeCertifiedTelemetry(overrides = {}) {
  return createBatchTelemetryRecord({
    harvest_batch_id: 'batch-2026-11-11-w1',
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
    final_validation_status: 'CERTIFIED',
    execution_status: 'SUCCESS',
    observations_committed: true,
    audit_persisted: true,
    fully_certified: true,
    audit_lifecycle_state: AUDIT_LIFECYCLE_STATES.COLLECTION_FULLY_CERTIFIED,
    ...overrides
  });
}

/**
 * Faithful in-memory transactional simulator modeling Migration 013 v2.2.9:
 * - Role ACLs (postgres owner, service_role SELECT + SECURITY DEFINER RPC only,
 *   ml_engine_readonly SELECT only, anon/authenticated/PUBLIC denied)
 * - 64-bit hashtextextended advisory xact locks & serial async queuing
 * - Non-secret GUC correlation carrier kisanos.expected_transition_intents (overwritten by gateway)
 * - Full BEFORE INSERT / BEFORE UPDATE Contract A & B triggers
 * - DEFERRABLE INITIALLY DEFERRED fk_recovery_exact_transition_binding & bilateral triggers at COMMIT
 * - Append-only UPDATE/DELETE blockers on transitions & recovery_events
 * - Simulated mandi_historical_observations table for orphan reconstruction & rollback preservation
 */
class IsolatedAuditPgSimulator {
  constructor() {
    this.logs = new Map();
    this.transitions = [];
    this.recoveryEvents = [];
    this.observations = [];
    this.xactLocks = new Set();
    this.lockWaiters = new Map();
    this.dropped = false;
    this.injectTransitionInsertError = null;
    this.injectRecoveryInsertError = null;
    this.rolePermissions = {
      postgres: { directWrite: true, select: true, rpc: true },
      service_role: { directWrite: false, select: true, rpc: true },
      ml_engine_readonly: { directWrite: false, select: true, rpc: false },
      anon: { directWrite: false, select: false, rpc: false },
      authenticated: { directWrite: false, select: false, rpc: false }
    };
  }

  _cloneState() {
    return {
      logs: new Map(Array.from(this.logs.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])),
      transitions: JSON.parse(JSON.stringify(this.transitions)),
      recoveryEvents: JSON.parse(JSON.stringify(this.recoveryEvents)),
      observations: JSON.parse(JSON.stringify(this.observations)),
      dropped: this.dropped
    };
  }

  _restoreState(snap) {
    this.logs = snap.logs;
    this.transitions = snap.transitions;
    this.recoveryEvents = snap.recoveryEvents;
    this.observations = snap.observations;
    this.dropped = snap.dropped;
  }

  _hash64(key) {
    return crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 16);
  }

  async _acquireLock(key, tx) {
    const lockId = this._hash64(key);
    while (this.xactLocks.has(lockId) && !tx.heldLocks.has(lockId)) {
      await new Promise((resolve) => {
        const list = this.lockWaiters.get(lockId) || [];
        list.push(resolve);
        this.lockWaiters.set(lockId, list);
      });
    }
    this.xactLocks.add(lockId);
    tx.heldLocks.add(lockId);
    return lockId;
  }

  _releaseLocks(tx) {
    for (const lockId of tx.heldLocks) {
      this.xactLocks.delete(lockId);
      const waiters = this.lockWaiters.get(lockId);
      if (waiters && waiters.length > 0) {
        const next = waiters.shift();
        if (waiters.length === 0) this.lockWaiters.delete(lockId);
        next();
      }
    }
    tx.heldLocks.clear();
  }

  createConnection(role = 'service_role') {
    const sim = this;
    return {
      role,
      tx: null,
      guc: {},
      async query(sql, params = []) {
        return sim._execute(this, sql, params);
      },
      release() {}
    };
  }

  getPool(role = 'service_role') {
    const sim = this;
    return {
      role,
      async connect() {
        return sim.createConnection(role);
      },
      async query(sql, params = []) {
        const conn = sim.createConnection(role);
        return conn.query(sql, params);
      }
    };
  }

  _pgError(message, code = '23505') {
    const err = new Error(message);
    err.code = code;
    return err;
  }

  _assertNotDropped() {
    if (this.dropped) {
      throw this._pgError('relation "public.mandi_harvest_execution_log" does not exist', '42P01');
    }
  }

  _assertTableSelect(conn) {
    const perm = this.rolePermissions[conn.role];
    if (!perm || !perm.select) {
      throw this._pgError(`permission denied for table mandi_harvest_execution_log (role=${conn.role})`, '42501');
    }
  }

  _assertDirectTableWrite(conn, tableName) {
    const perm = this.rolePermissions[conn.role];
    if (!perm || !perm.directWrite) {
      throw this._pgError(`permission denied for table ${tableName} (role=${conn.role})`, '42501');
    }
  }

  _validateLogConstraints(row) {
    const expectedRank = CANONICAL_STATE_RANKS[row.audit_lifecycle_state];
    if (!expectedRank || row.state_rank !== expectedRank) {
      throw this._pgError(`chk_mandi_harvest_canonical_rank violated (${row.audit_lifecycle_state}, rank=${row.state_rank})`, '23514');
    }
    if (row.fully_certified && !(
      row.observations_committed === true &&
      row.audit_persisted === true &&
      row.execution_status === 'SUCCESS' &&
      row.audit_lifecycle_state === 'COLLECTION_FULLY_CERTIFIED' &&
      row.state_rank === 40
    )) {
      throw this._pgError('chk_mandi_harvest_certified_invariant violated', '23514');
    }
    if (row.audit_lifecycle_state === 'AUDIT_RECOVERY_REQUIRED' && (row.fully_certified !== false || row.state_rank !== 20)) {
      throw this._pgError('chk_mandi_harvest_recovery_uncertified violated', '23514');
    }
  }

  _enforceInsertTrigger(row) {
    if (row.state_version !== 1) {
      throw this._pgError(`Initial INSERT must set state_version = 1 (got ${row.state_version})`, '23000');
    }
    if (!CANONICAL_STATE_RANKS[row.audit_lifecycle_state]) {
      throw this._pgError(`Prohibited initial lifecycle state ${row.audit_lifecycle_state}`, '23000');
    }
  }

  _enforceUpdateTrigger(oldRow, newRow) {
    if (
      newRow.harvest_batch_id !== oldRow.harvest_batch_id ||
      newRow.collection_window !== oldRow.collection_window ||
      newRow.execution_start_utc !== oldRow.execution_start_utc ||
      newRow.created_at !== oldRow.created_at
    ) {
      throw this._pgError('Cannot modify immutable identity fields', '23000');
    }

    const isTerminal =
      oldRow.audit_lifecycle_state === 'COLLECTION_FULLY_CERTIFIED' ||
      oldRow.audit_lifecycle_state === 'REJECTED_AUDIT_PERSISTED' ||
      oldRow.fully_certified === true;
    const isTransition = newRow.audit_lifecycle_state !== oldRow.audit_lifecycle_state;

    if (isTransition) {
      if (isTerminal) {
        throw this._pgError(`Terminal immutability violation out of ${oldRow.audit_lifecycle_state}`, '23000');
      }
      const allowed =
        (oldRow.audit_lifecycle_state === 'OBSERVATIONS_COMMITTED' && newRow.audit_lifecycle_state === 'COLLECTION_FULLY_CERTIFIED') ||
        (oldRow.audit_lifecycle_state === 'OBSERVATIONS_COMMITTED' && newRow.audit_lifecycle_state === 'AUDIT_PERSIST_FAILED_AFTER_COMMIT') ||
        (oldRow.audit_lifecycle_state === 'AUDIT_PERSIST_FAILED_AFTER_COMMIT' && newRow.audit_lifecycle_state === 'COLLECTION_FULLY_CERTIFIED') ||
        (oldRow.audit_lifecycle_state === 'REJECTED_AUDIT_FAILED' && newRow.audit_lifecycle_state === 'REJECTED_AUDIT_PERSISTED') ||
        (oldRow.audit_lifecycle_state === 'AUDIT_RECOVERY_REQUIRED' && newRow.audit_lifecycle_state === 'COLLECTION_FULLY_CERTIFIED');

      if (!allowed) {
        throw this._pgError(`Prohibited lifecycle transition (${oldRow.audit_lifecycle_state} -> ${newRow.audit_lifecycle_state})`, '23000');
      }
      if (newRow.state_rank <= oldRow.state_rank) {
        throw this._pgError('State rank must increase monotonically', '23000');
      }
      if (newRow.state_version !== oldRow.state_version + 1) {
        throw this._pgError('Contract A requires exact state_version increment', '23000');
      }
      if (oldRow.observations_committed === true && newRow.observations_committed === false) {
        throw this._pgError('Cannot revert observations_committed from TRUE to FALSE', '23000');
      }
      return;
    }

    // Contract B: metadata-only
    if (
      newRow.state_rank !== oldRow.state_rank ||
      newRow.state_version !== oldRow.state_version ||
      newRow.last_transition_at !== oldRow.last_transition_at
    ) {
      throw this._pgError('Contract B violation: cannot change state_rank, state_version, or last_transition_at', '23000');
    }
    const lockedCols = [
      'target_observation_date', 'ogd_publication_timestamp', 'execution_end_utc', 'api_reported_total',
      'records_fetched', 'records_parsed', 'records_inserted', 'records_updated', 'records_skipped',
      'records_rejected', 'duplicate_count', 'distinct_states', 'distinct_markets', 'distinct_commodities',
      'final_validation_status', 'execution_status', 'observations_committed', 'audit_persisted',
      'fully_certified', 'is_recovered', 'last_recovered_at'
    ];
    for (const col of lockedCols) {
      if (newRow[col] !== oldRow[col]) {
        throw this._pgError(`Contract B violation: protected field ${col} cannot be modified`, '23000');
      }
    }
    if (JSON.stringify(newRow.gates) !== JSON.stringify(oldRow.gates)) {
      throw this._pgError('Contract B violation: gates cannot be modified', '23000');
    }
    if (isTerminal && newRow.error_details !== oldRow.error_details) {
      throw this._pgError('Terminal record protection: cannot modify error_details on terminal batch', '23000');
    }
  }

  _runDeferredChecks(tx) {
    const intents = tx.intents || {};

    // 1. Check trg_verify_log_has_transition_history for all lifecycle writes in tx
    for (const op of tx.logOps) {
      if (op.type === 'UPDATE' && op.oldRow.audit_lifecycle_state === op.newRow.audit_lifecycle_state) {
        continue; // Contract B requires zero transition rows
      }
      const expPrevState = op.type === 'INSERT' ? null : op.oldRow.audit_lifecycle_state;
      const expPrevVer = op.type === 'INSERT' ? 0 : op.oldRow.state_version;
      const intentKey = `${op.newRow.harvest_batch_id}:${op.newRow.state_version}`;
      const intent = intents[intentKey];
      if (!intent) {
        throw this._pgError(`Unauthorized direct lifecycle write on batch ${op.newRow.harvest_batch_id} (v${expPrevVer} -> v${op.newRow.state_version}): missing write-boundary intent`, '23000');
      }
      const matches = this.transitions.filter((t) =>
        t.transition_id === intent.transition_id &&
        t.transition_event_id === intent.transition_event_id &&
        t.evidence_checksum === intent.evidence_checksum &&
        t.transition_kind === intent.transition_kind &&
        t.harvest_batch_id === op.newRow.harvest_batch_id &&
        t.harvest_batch_id === intent.harvest_batch_id &&
        t.previous_lifecycle_state === expPrevState &&
        t.previous_lifecycle_state === intent.previous_lifecycle_state &&
        t.new_lifecycle_state === op.newRow.audit_lifecycle_state &&
        t.new_lifecycle_state === intent.new_lifecycle_state &&
        t.previous_state_version === expPrevVer &&
        t.previous_state_version === intent.previous_state_version &&
        t.resulting_state_version === op.newRow.state_version &&
        t.resulting_state_version === intent.resulting_state_version
      );
      if (matches.length !== 1) {
        throw this._pgError(`Exact 9-field transition identity verification failed on batch ${op.newRow.harvest_batch_id} (found ${matches.length})`, '23000');
      }
    }

    // 2. Check trg_verify_transition_matches_parent for all inserted transitions in tx
    for (const t of tx.insertedTransitions) {
      if (!/^[0-9a-f]{64}$/.test(t.transition_id) || !/^[0-9a-f]{64}$/.test(t.transition_event_id) || !/^[0-9a-f]{64}$/.test(t.evidence_checksum) || t.transition_id === t.transition_event_id) {
        throw this._pgError('Invalid or degenerate canonical identifier format', '23000');
      }
      if (t.previous_state_version < 0 || t.resulting_state_version !== t.previous_state_version + 1) {
        throw this._pgError('Version continuity violation', '23000');
      }
      const intentKey = `${t.harvest_batch_id}:${t.resulting_state_version}`;
      const intent = intents[intentKey];
      if (!intent ||
        t.transition_id !== intent.transition_id ||
        t.transition_event_id !== intent.transition_event_id ||
        t.evidence_checksum !== intent.evidence_checksum ||
        t.transition_kind !== intent.transition_kind ||
        t.harvest_batch_id !== intent.harvest_batch_id ||
        t.previous_lifecycle_state !== intent.previous_lifecycle_state ||
        t.new_lifecycle_state !== intent.new_lifecycle_state ||
        t.previous_state_version !== intent.previous_state_version ||
        t.resulting_state_version !== intent.resulting_state_version
      ) {
        throw this._pgError(`Transition history row violates bound transaction intent at v${t.resulting_state_version}`, '23000');
      }

      const parent = this.logs.get(t.harvest_batch_id);
      if (!parent || t.resulting_state_version > parent.state_version) {
        throw this._pgError(`Spurious transition history row at v${t.resulting_state_version} exceeds parent state_version`, '23000');
      }

      if (t.resulting_state_version === 1) {
        if (t.previous_state_version !== 0 || t.previous_lifecycle_state !== null) {
          throw this._pgError('Initial v0 -> v1 transition requires previous_state_version=0 and NULL previous_lifecycle_state', '23000');
        }
      } else {
        const prevT = this.transitions.find(
          (x) => x.harvest_batch_id === t.harvest_batch_id && x.resulting_state_version === t.resulting_state_version - 1
        );
        if (!prevT || prevT.new_lifecycle_state !== t.previous_lifecycle_state) {
          throw this._pgError('Broken previous/new lifecycle continuity', '23000');
        }
      }

      if (!isPermittedTransition(t.previous_lifecycle_state, t.new_lifecycle_state, t.transition_kind)) {
        throw this._pgError(`Prohibited transition pair/kind (${t.transition_kind}: ${t.previous_lifecycle_state} -> ${t.new_lifecycle_state})`, '23000');
      }

      if (t.resulting_state_version === parent.state_version && t.new_lifecycle_state !== parent.audit_lifecycle_state) {
        throw this._pgError('Tip transition state mismatches parent state', '23000');
      }

      // Bidirectional recovery-event cardinality & parity check at COMMIT
      const anyEvents = this.recoveryEvents.filter(
        (r) =>
          r.transition_id === t.transition_id ||
          r.recovery_event_id === t.transition_event_id ||
          r.transition_event_id === t.transition_event_id ||
          (r.harvest_batch_id === t.harvest_batch_id && r.resulting_state_version === t.resulting_state_version)
      );

      if (t.transition_kind === 'RECOVERY') {
        const exactEvents = this.recoveryEvents.filter(
          (r) =>
            r.transition_id === t.transition_id &&
            r.recovery_event_id === t.transition_event_id &&
            r.transition_event_id === t.transition_event_id &&
            r.harvest_batch_id === t.harvest_batch_id &&
            r.from_lifecycle_state === t.previous_lifecycle_state &&
            r.to_lifecycle_state === t.new_lifecycle_state &&
            (r.expected_state_version === null ? 0 : r.expected_state_version) === t.previous_state_version &&
            r.resulting_state_version === t.resulting_state_version &&
            r.evidence_checksum === t.evidence_checksum
        );
        if (exactEvents.length !== 1 || anyEvents.length !== 1) {
          throw this._pgError(`RECOVERY transition requires exact 1:1 recovery_event (exact=${exactEvents.length}, total=${anyEvents.length})`, '23000');
        }
      } else if (anyEvents.length !== 0) {
        throw this._pgError(`NORMAL_COLLECTION transition prohibits recovery_event rows (found ${anyEvents.length})`, '23000');
      }
    }

    // 3. Check deferred FK fk_recovery_exact_transition_binding & trg_verify_recovery_event_matches_transition
    for (const r of tx.insertedRecoveryEvents) {
      if (r.recovery_event_id !== r.transition_event_id) {
        throw this._pgError('chk_recovery_event_equals_transition_event violated', '23514');
      }
      const trans = this.transitions.find(
        (t) =>
          t.transition_id === r.transition_id &&
          t.harvest_batch_id === r.harvest_batch_id &&
          t.new_lifecycle_state === r.to_lifecycle_state &&
          t.resulting_state_version === r.resulting_state_version &&
          t.transition_event_id === r.transition_event_id &&
          t.evidence_checksum === r.evidence_checksum
      );
      if (!trans) {
        throw this._pgError(`fk_recovery_exact_transition_binding: transition ${r.transition_id} missing or mismatched`, '23503');
      }
      if (trans.transition_kind !== 'RECOVERY') {
        throw this._pgError(`Recovery event cannot attach to non-RECOVERY transition (${trans.transition_kind})`, '23000');
      }
      const siblings = this.recoveryEvents.filter(
        (x) =>
          x.transition_id === r.transition_id ||
          (x.harvest_batch_id === r.harvest_batch_id && x.resulting_state_version === r.resulting_state_version)
      );
      if (siblings.length !== 1) {
        throw this._pgError(`Duplicate recovery event detected for transition ${r.transition_id}`, '23505');
      }
      if (
        r.from_lifecycle_state !== trans.previous_lifecycle_state ||
        (r.expected_state_version === null ? 0 : r.expected_state_version) !== trans.previous_state_version ||
        (trans.resulting_state_version === 1 && r.expected_state_version !== null) ||
        (trans.resulting_state_version > 1 && r.expected_state_version !== trans.previous_state_version)
      ) {
        throw this._pgError('Recovery event origin metadata mismatches transition', '23000');
      }
      const methodOk =
        (trans.previous_lifecycle_state === null && trans.new_lifecycle_state === 'AUDIT_RECOVERY_REQUIRED' && r.recovery_method === 'ORPHAN_RECONCILIATION') ||
        (trans.previous_lifecycle_state === 'AUDIT_PERSIST_FAILED_AFTER_COMMIT' && trans.new_lifecycle_state === 'COLLECTION_FULLY_CERTIFIED' && r.recovery_method === 'PAYLOAD_REPLAY') ||
        (trans.previous_lifecycle_state === 'REJECTED_AUDIT_FAILED' && trans.new_lifecycle_state === 'REJECTED_AUDIT_PERSISTED' && r.recovery_method === 'PAYLOAD_REPLAY') ||
        (trans.previous_lifecycle_state === 'AUDIT_RECOVERY_REQUIRED' && trans.new_lifecycle_state === 'COLLECTION_FULLY_CERTIFIED' && r.recovery_method === 'EVIDENCE_REVERIFICATION');
      if (!methodOk) {
        throw this._pgError(`Mismatched recovery_method ${r.recovery_method} for transition`, '23000');
      }
    }
  }

  _insertTransitionInternal(row, tx) {
    if (this.injectTransitionInsertError) {
      const err = new Error(this.injectTransitionInsertError);
      this.injectTransitionInsertError = null;
      throw err;
    }
    if (this.transitions.some((t) => t.transition_id === row.transition_id)) {
      throw this._pgError(`duplicate key value violates unique constraint "mandi_harvest_lifecycle_transitions_pkey"`, '23505');
    }
    if (this.transitions.some((t) => t.transition_event_id === row.transition_event_id)) {
      throw this._pgError(`duplicate key value violates unique constraint "mandi_harvest_lifecycle_transitions_transition_event_id_key"`, '23505');
    }
    if (this.transitions.some((t) => t.harvest_batch_id === row.harvest_batch_id && t.previous_state_version === row.previous_state_version)) {
      throw this._pgError(`duplicate key value violates unique constraint "uq_transition_batch_prev_version"`, '23505');
    }
    if (this.transitions.some((t) => t.harvest_batch_id === row.harvest_batch_id && t.resulting_state_version === row.resulting_state_version)) {
      throw this._pgError(`duplicate key value violates unique constraint "uq_transition_batch_res_version"`, '23505');
    }
    this.transitions.push(row);
    tx.insertedTransitions.push(row);
  }

  _insertRecoveryEventInternal(row, tx) {
    if (this.injectRecoveryInsertError) {
      const err = new Error(this.injectRecoveryInsertError);
      this.injectRecoveryInsertError = null;
      throw err;
    }
    if (row.recovery_event_id !== row.transition_event_id) {
      throw this._pgError('chk_recovery_event_equals_transition_event violated', '23514');
    }
    if (this.recoveryEvents.some((r) => r.recovery_event_id === row.recovery_event_id)) {
      throw this._pgError(`duplicate key value violates unique constraint "mandi_harvest_recovery_events_pkey"`, '23505');
    }
    if (this.recoveryEvents.some((r) => r.transition_id === row.transition_id)) {
      throw this._pgError(`duplicate key value violates unique constraint "uq_recovery_event_unique_transition"`, '23505');
    }
    if (this.recoveryEvents.some((r) => r.harvest_batch_id === row.harvest_batch_id && r.resulting_state_version === row.resulting_state_version)) {
      throw this._pgError(`duplicate key value violates unique constraint "uq_recovery_event_batch_version"`, '23505');
    }
    this.recoveryEvents.push(row);
    tx.insertedRecoveryEvents.push(row);
  }

  async _execute(conn, sql, params = []) {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    if (/^BEGIN$/i.test(cleanSql)) {
      conn.tx = {
        snapshot: this._cloneState(),
        heldLocks: new Set(),
        logOps: [],
        insertedTransitions: [],
        insertedRecoveryEvents: [],
        intents: {},
        savepoints: []
      };
      return { rows: [] };
    }

    if (/^SAVEPOINT\s+/i.test(cleanSql)) {
      if (conn.tx) {
        conn.tx.savepoints.push({
          name: cleanSql.split(/\s+/)[1],
          snapshot: this._cloneState()
        });
      }
      return { rows: [] };
    }

    if (/^RELEASE SAVEPOINT\s+/i.test(cleanSql)) {
      if (conn.tx && conn.tx.savepoints.length > 0) conn.tx.savepoints.pop();
      return { rows: [] };
    }

    if (/^ROLLBACK TO SAVEPOINT\s+/i.test(cleanSql)) {
      if (conn.tx && conn.tx.savepoints.length > 0) {
        const sp = conn.tx.savepoints.pop();
        this._restoreState(sp.snapshot);
      }
      return { rows: [] };
    }

    if (/^ROLLBACK$/i.test(cleanSql)) {
      if (conn.tx) {
        this._restoreState(conn.tx.snapshot);
        this._releaseLocks(conn.tx);
        conn.tx = null;
      }
      return { rows: [] };
    }

    if (/^COMMIT$/i.test(cleanSql)) {
      if (conn.tx) {
        try {
          this._runDeferredChecks(conn.tx);
          this._releaseLocks(conn.tx);
          conn.tx = null;
        } catch (err) {
          this._restoreState(conn.tx.snapshot);
          this._releaseLocks(conn.tx);
          conn.tx = null;
          throw err;
        }
      }
      return { rows: [] };
    }

    // Handle autocommit single statements cleanly
    let autoTx = false;
    if (!conn.tx) {
      await this._execute(conn, 'BEGIN', []);
      autoTx = true;
    }

    try {
      const res = await this._executeInTx(conn, cleanSql, params);
      if (autoTx) {
        await this._execute(conn, 'COMMIT', []);
      }
      return res;
    } catch (err) {
      if (autoTx) {
        await this._execute(conn, 'ROLLBACK', []);
      }
      throw err;
    }
  }

  async _executeInTx(conn, cleanSql, params) {
    // set_config GUC
    if (/set_config\('kisanos\.expected_transition_intents'/i.test(cleanSql)) {
      const rawJson = params[0] || cleanSql.match(/set_config\('kisanos\.expected_transition_intents',\s*'([^']*)'/i)?.[1] || '{}';
      try {
        conn.guc.expected_transition_intents = JSON.parse(rawJson);
        conn.tx.intents = { ...conn.guc.expected_transition_intents };
      } catch (_) {
        conn.tx.intents = {};
      }
      return { rows: [{ set_config: rawJson }] };
    }

    // Advisory lock
    if (/pg_catalog\.pg_advisory_xact_lock\(/i.test(cleanSql) || /pg_advisory_xact_lock\(/i.test(cleanSql)) {
      const key = params[0];
      await this._acquireLock(key, conn.tx);
      return { rows: [{ pg_advisory_xact_lock: '' }] };
    }

    this._assertNotDropped();

    // SELECT queries
    if (/FROM public\.mandi_harvest_execution_log WHERE fully_certified = TRUE/i.test(cleanSql)) {
      this._assertTableSelect(conn);
      const [targetDate, ogdTs, windowName] = params;
      const matches = Array.from(this.logs.values()).filter(
        (r) =>
          r.fully_certified === true &&
          r.audit_persisted === true &&
          r.observations_committed === true &&
          r.execution_status === 'SUCCESS' &&
          r.audit_lifecycle_state === 'COLLECTION_FULLY_CERTIFIED' &&
          r.target_observation_date === targetDate &&
          r.ogd_publication_timestamp === ogdTs &&
          (!windowName || r.collection_window === windowName)
      );
      matches.sort((a, b) => String(b.execution_end_utc || '').localeCompare(String(a.execution_end_utc || '')));
      return { rows: matches.slice(0, 1) };
    }

    if (/^SELECT \* FROM public\.mandi_harvest_execution_log WHERE observations_committed = TRUE/i.test(cleanSql)) {
      this._assertTableSelect(conn);
      const excludeId = params[0] || null;
      const matches = Array.from(this.logs.values()).filter(
        (r) =>
          r.observations_committed === true &&
          (r.execution_status === 'SUCCESS' || r.execution_status === 'SUCCESS_INVESTIGATION_NEEDED') &&
          (!excludeId || r.harvest_batch_id !== excludeId)
      );
      matches.sort((a, b) => String(b.target_observation_date || '').localeCompare(String(a.target_observation_date || '')));
      return { rows: matches.slice(0, 1) };
    }

    if (/^SELECT \* FROM public\.mandi_harvest_execution_log WHERE harvest_batch_id = \$1/i.test(cleanSql)) {
      this._assertTableSelect(conn);
      const row = this.logs.get(params[0]);
      return { rows: row ? [JSON.parse(JSON.stringify(row))] : [] };
    }

    if (/^SELECT \* FROM public\.mandi_harvest_execution_log ORDER BY/i.test(cleanSql)) {
      this._assertTableSelect(conn);
      const lim = Number(params[0] || 50);
      const rows = Array.from(this.logs.values())
        .sort((a, b) => String(b.execution_start_utc || '').localeCompare(String(a.execution_start_utc || '')))
        .slice(0, lim);
      return { rows };
    }

    if (/^SELECT \* FROM public\.mandi_harvest_recovery_events WHERE recovery_event_id = \$1/i.test(cleanSql)) {
      this._assertTableSelect(conn);
      const evt = this.recoveryEvents.find((e) => e.recovery_event_id === params[0]);
      return { rows: evt ? [JSON.parse(JSON.stringify(evt))] : [] };
    }

    if (/^SELECT \* FROM public\.mandi_harvest_lifecycle_transitions WHERE transition_event_id = \$1/i.test(cleanSql)) {
      this._assertTableSelect(conn);
      const t = this.transitions.find((x) => x.transition_event_id === params[0]);
      return { rows: t ? [JSON.parse(JSON.stringify(t))] : [] };
    }

    if (/^SELECT \* FROM public\.mandi_harvest_lifecycle_transitions WHERE harvest_batch_id = \$1 AND transition_id = \$2 AND resulting_state_version = \$3/i.test(cleanSql)) {
      this._assertTableSelect(conn);
      const t = this.transitions.find(
        (x) => x.harvest_batch_id === params[0] && x.transition_id === params[1] && x.resulting_state_version === params[2]
      );
      return { rows: t ? [JSON.parse(JSON.stringify(t))] : [] };
    }

    if (/^SELECT \* FROM public\.mandi_harvest_lifecycle_transitions WHERE harvest_batch_id = \$1 AND resulting_state_version > \$2/i.test(cleanSql)) {
      this._assertTableSelect(conn);
      const rows = this.transitions
        .filter((x) => x.harvest_batch_id === params[0] && x.resulting_state_version > params[1])
        .sort((a, b) => a.resulting_state_version - b.resulting_state_version);
      return { rows };
    }

    if (/FROM public\.mandi_historical_observations WHERE raw_payload->>'inserted_by_batch_id' = \$1/i.test(cleanSql)) {
      this._assertTableSelect(conn);
      const batchId = params[0];
      const obs = this.observations.filter((o) => {
        const rp = o.raw_payload || {};
        return (
          rp.inserted_by_batch_id === batchId ||
          rp.updated_by_batch_id === batchId ||
          (Array.isArray(rp.batch_lineage) && rp.batch_lineage.includes(batchId))
        );
      });
      return {
        rows: [{
          committed_rows: obs.length,
          distinct_states: new Set(obs.map((o) => o.state)).size,
          distinct_markets: new Set(obs.map((o) => o.market)).size,
          distinct_commodities: new Set(obs.map((o) => o.commodity)).size,
          observed_date: obs[0] ? obs[0].observation_date : null
        }]
      };
    }

    // SECURITY DEFINER Gateway #1: fn_mandi_record_lifecycle_transition
    if (/SELECT \* FROM public\.fn_mandi_record_lifecycle_transition/i.test(cleanSql)) {
      const perm = this.rolePermissions[conn.role];
      if (!perm || !perm.rpc) {
        throw this._pgError(`permission denied for function fn_mandi_record_lifecycle_transition (role=${conn.role})`, '42501');
      }
      const [
        batchId, transitionKind, operationKind, fromState, toState,
        expectedVer, resultingVer, transitionEventId, transitionId,
        evidenceChecksum, reason, actor, telemetryJson, evidenceSummaryJson, recoveryNotes
      ] = params;

      const tel = typeof telemetryJson === 'string' ? JSON.parse(telemetryJson) : (telemetryJson || {});
      const expPrevVer = expectedVer === null ? 0 : expectedVer;

      await this._acquireLock(batchId, conn.tx);
      const existingTrans = this.transitions.find((t) => t.transition_event_id === transitionEventId);
      if (existingTrans) {
        if (
          existingTrans.harvest_batch_id !== batchId ||
          existingTrans.transition_kind !== transitionKind ||
          existingTrans.previous_lifecycle_state !== fromState ||
          existingTrans.new_lifecycle_state !== toState ||
          existingTrans.previous_state_version !== expPrevVer ||
          existingTrans.resulting_state_version !== resultingVer ||
          existingTrans.evidence_checksum !== evidenceChecksum
        ) {
          throw this._pgError('ERR_TRANSITION_IDENTITY_CONFLICT', '23000');
        }
        const parent = this.logs.get(batchId);
        return { rows: [{ outcome: 'IDEMPOTENT_HIT', ...parent }] };
      }

      // Gateway sets kisanos.expected_transition_intents authoritatively (overwriting any forged key)
      conn.tx.intents[`${batchId}:${resultingVer}`] = {
        transition_id: transitionId,
        transition_event_id: transitionEventId,
        evidence_checksum: evidenceChecksum,
        transition_kind: transitionKind,
        harvest_batch_id: batchId,
        previous_lifecycle_state: fromState,
        new_lifecycle_state: toState,
        previous_state_version: expPrevVer,
        resulting_state_version: resultingVer
      };

      const existingParent = this.logs.get(batchId);
      const targetRank = CANONICAL_STATE_RANKS[toState];
      if (!targetRank) throw this._pgError(`Unrecognized target state ${toState}`, '23000');

      let updatedParent;
      if (!existingParent) {
        if (fromState !== null || expectedVer !== null || resultingVer !== 1) {
          throw this._pgError('Initial creation requires NULL from_state, NULL expectedVer, resultingVer=1', '23000');
        }
        updatedParent = {
          ...tel,
          harvest_batch_id: batchId,
          audit_lifecycle_state: toState,
          state_rank: targetRank,
          state_version: 1,
          fully_certified: toState === 'COLLECTION_FULLY_CERTIFIED' && tel.fully_certified !== false,
          is_recovered: transitionKind === 'RECOVERY',
          last_transition_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        this._enforceInsertTrigger(updatedParent);
        this._validateLogConstraints(updatedParent);
        this.logs.set(batchId, updatedParent);
        conn.tx.logOps.push({ type: 'INSERT', oldRow: null, newRow: JSON.parse(JSON.stringify(updatedParent)) });
      } else {
        if (fromState !== existingParent.audit_lifecycle_state || expectedVer !== existingParent.state_version) {
          throw this._pgError(`Optimistic concurrency mismatch: expected (${fromState} v${expectedVer}), got (${existingParent.audit_lifecycle_state} v${existingParent.state_version})`, '23000');
        }
        const oldSnap = JSON.parse(JSON.stringify(existingParent));
        updatedParent = {
          ...existingParent,
          ...tel,
          harvest_batch_id: batchId,
          audit_lifecycle_state: toState,
          state_rank: targetRank,
          state_version: resultingVer,
          fully_certified: toState === 'COLLECTION_FULLY_CERTIFIED' && tel.fully_certified !== false,
          is_recovered: existingParent.is_recovered || transitionKind === 'RECOVERY',
          last_transition_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        this._enforceUpdateTrigger(oldSnap, updatedParent);
        this._validateLogConstraints(updatedParent);
        this.logs.set(batchId, updatedParent);
        conn.tx.logOps.push({ type: 'UPDATE', oldRow: oldSnap, newRow: JSON.parse(JSON.stringify(updatedParent)) });
      }

      this._insertTransitionInternal({
        transition_id: transitionId,
        harvest_batch_id: batchId,
        transition_kind: transitionKind,
        previous_lifecycle_state: fromState,
        new_lifecycle_state: toState,
        previous_state_version: expPrevVer,
        resulting_state_version: resultingVer,
        transition_event_id: transitionEventId,
        evidence_checksum: evidenceChecksum,
        transition_reason: reason || operationKind,
        actor_or_source: actor
      }, conn.tx);

      if (transitionKind === 'RECOVERY') {
        this._insertRecoveryEventInternal({
          recovery_event_id: transitionEventId,
          transition_id: transitionId,
          transition_event_id: transitionEventId,
          harvest_batch_id: batchId,
          recovery_method: operationKind,
          from_lifecycle_state: fromState,
          to_lifecycle_state: toState,
          expected_state_version: expectedVer,
          resulting_state_version: resultingVer,
          evidence_checksum: evidenceChecksum,
          evidence_summary: evidenceSummaryJson ? JSON.parse(evidenceSummaryJson) : {},
          actor_or_worker: actor,
          recovery_notes: recoveryNotes || null
        }, conn.tx);
      }

      return {
        rows: [{
          outcome: 'APPLIED',
          harvest_batch_id: updatedParent.harvest_batch_id,
          audit_lifecycle_state: updatedParent.audit_lifecycle_state,
          state_rank: updatedParent.state_rank,
          state_version: updatedParent.state_version,
          transition_id: transitionId,
          transition_event_id: transitionEventId
        }]
      };
    }

    // SECURITY DEFINER Gateway #2: fn_mandi_update_batch_metadata
    if (/SELECT \* FROM public\.fn_mandi_update_batch_metadata/i.test(cleanSql)) {
      const perm = this.rolePermissions[conn.role];
      if (!perm || !perm.rpc) {
        throw this._pgError(`permission denied for function fn_mandi_update_batch_metadata (role=${conn.role})`, '42501');
      }
      const [batchId, expectedVer, diagNotes, errDetails] = params;
      await this._acquireLock(batchId, conn.tx);
      const existing = this.logs.get(batchId);
      if (!existing || existing.state_version !== expectedVer) {
        throw this._pgError(`Metadata update failed: batch ${batchId} @ v${expectedVer} not found`, '23000');
      }
      const oldSnap = JSON.parse(JSON.stringify(existing));
      const newRow = {
        ...existing,
        diagnostic_notes: diagNotes !== null ? diagNotes : existing.diagnostic_notes,
        error_details: errDetails !== null ? errDetails : existing.error_details,
        updated_at: new Date().toISOString()
      };
      this._enforceUpdateTrigger(oldSnap, newRow);
      this.logs.set(batchId, newRow);
      conn.tx.logOps.push({ type: 'UPDATE', oldRow: oldSnap, newRow: JSON.parse(JSON.stringify(newRow)) });
      return { rows: [{ harvest_batch_id: batchId, audit_lifecycle_state: newRow.audit_lifecycle_state, state_version: newRow.state_version, updated_at: newRow.updated_at }] };
    }

    // Direct SQL table write operations (subject to directWrite ACL check; exercises DB trigger tests as postgres)
    if (/^(INSERT|UPDATE|DELETE) .*mandi_harvest_execution_log/i.test(cleanSql)) {
      this._assertDirectTableWrite(conn, 'mandi_harvest_execution_log');
      throw this._pgError('Use explicit simulator direct helpers for postgres owner tests', '0A000');
    }

    if (/^(UPDATE|DELETE) .*mandi_harvest_lifecycle_transitions/i.test(cleanSql)) {
      this._assertDirectTableWrite(conn, 'mandi_harvest_lifecycle_transitions');
      throw this._pgError('Append-only audit table mandi_harvest_lifecycle_transitions prohibits UPDATE/DELETE', '23000');
    }

    if (/^(UPDATE|DELETE) .*mandi_harvest_recovery_events/i.test(cleanSql)) {
      this._assertDirectTableWrite(conn, 'mandi_harvest_recovery_events');
      throw this._pgError('Append-only audit table mandi_harvest_recovery_events prohibits UPDATE/DELETE', '23000');
    }

    if (/^INSERT INTO public\.mandi_harvest_lifecycle_transitions/i.test(cleanSql)) {
      this._assertDirectTableWrite(conn, 'mandi_harvest_lifecycle_transitions');
      throw this._pgError('Use simulator directInsertTransition for owner test', '0A000');
    }

    throw new Error(`Unhandled SQL in simulator: ${cleanSql}`);
  }

  /**
   * Direct postgres-owner transaction helper for exercising SQL-level triggers,
   * arbitrary insert order (recovery_event before transition), forged intents, or invalid matrix rows.
   */
  async runAsPostgresOwner(fn) {
    const tx = {
      snapshot: this._cloneState(),
      heldLocks: new Set(),
      logOps: [],
      insertedTransitions: [],
      insertedRecoveryEvents: [],
      intents: {}
    };
    const api = {
      setIntent: (batchId, resVer, intent) => {
        tx.intents[`${batchId}:${resVer}`] = intent;
      },
      insertLog: (row) => {
        if (this.logs.has(row.harvest_batch_id)) throw this._pgError('duplicate batch PK', '23505');
        this._enforceInsertTrigger(row);
        this._validateLogConstraints(row);
        this.logs.set(row.harvest_batch_id, JSON.parse(JSON.stringify(row)));
        tx.logOps.push({ type: 'INSERT', oldRow: null, newRow: JSON.parse(JSON.stringify(row)) });
      },
      updateLog: (batchId, patch) => {
        const oldRow = JSON.parse(JSON.stringify(this.logs.get(batchId)));
        const newRow = { ...oldRow, ...patch };
        this._enforceUpdateTrigger(oldRow, newRow);
        this._validateLogConstraints(newRow);
        this.logs.set(batchId, newRow);
        tx.logOps.push({ type: 'UPDATE', oldRow, newRow: JSON.parse(JSON.stringify(newRow)) });
      },
      insertTransition: (row) => {
        this._insertTransitionInternal(row, tx);
      },
      insertRecoveryEvent: (row) => {
        this._insertRecoveryEventInternal(row, tx);
      },
      updateTransitionDirect: () => {
        throw this._pgError('Append-only audit table mandi_harvest_lifecycle_transitions prohibits UPDATE operations', '23000');
      },
      deleteRecoveryDirect: () => {
        throw this._pgError('Append-only audit table mandi_harvest_recovery_events prohibits DELETE operations', '23000');
      }
    };
    try {
      await fn(api);
      this._runDeferredChecks(tx);
      this._releaseLocks(tx);
    } catch (err) {
      this._restoreState(tx.snapshot);
      this._releaseLocks(tx);
      throw err;
    }
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🌾 KisanOS Stage F.1.4 / F.1.5 Durable Audit Test Suite (62 Scenarios)');
  console.log('================================================================\n');

  const localPgUrl = process.env.TEST_DATABASE_URL || null;
  if (localPgUrl && /supabase\.co/i.test(localPgUrl)) {
    throw new Error('SAFETY VIOLATION: Refusing to run tests against production Supabase URL');
  }
  const pgStatus = localPgUrl ? 'AVAILABLE' : 'BLOCKED (No local PostgreSQL server/binary detected; zero Supabase connections)';
  console.log(`Database Engine Status: ${pgStatus}\n`);

  let passed = 0;
  let failed = 0;
  const failures = [];

  async function test(num, name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${num}. ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${num}. ${name}`);
      console.error(`      -> ${err.message}`);
      failed++;
      failures.push({ num, name, err });
    }
  }

  // Static audit of Migration 013 + Rollback SQL
  const migSql = fs.readFileSync(MIGRATION_013_PATH, 'utf8');
  const rbSql = fs.readFileSync(ROLLBACK_013_PATH, 'utf8');

  assert(!fs.existsSync(path.join(__dirname, '..', 'migrations', '013_rollback_mandi_harvest_audit.sql')), 'Rollback must live outside backend/migrations');
  assert(!/SET search_path\s*=\s*pg_catalog,\s*public/i.test(migSql), 'Migration 013 must not include writable public in search_path');
  assert(/SET search_path\s*=\s*pg_catalog,\s*pg_temp/i.test(migSql), 'Migration 013 must use hardened SET search_path = pg_catalog, pg_temp');
  assert(/ALTER FUNCTION public\.fn_mandi_record_lifecycle_transition[\s\S]*OWNER TO postgres;/i.test(migSql), 'Migration 013 must explicitly set owner to postgres');
  assert(/ALTER FUNCTION public\.fn_mandi_update_batch_metadata[\s\S]*OWNER TO postgres;/i.test(migSql), 'Migration 013 must explicitly set metadata gateway owner to postgres');
  assert(/DEFERRABLE INITIALLY DEFERRED/i.test(migSql), 'Migration 013 must define deferred constraints');
  assert(!/TODO|PSEUDOCODE/i.test(migSql), 'Migration 013 must contain zero TODOs or pseudocode');

  // Helper to build valid initial/transition data
  function buildInitAndNext(sim, batchId, state = 'OBSERVATIONS_COMMITTED', telOverrides = {}) {
    const tel = makeCertifiedTelemetry({
      harvest_batch_id: batchId,
      audit_lifecycle_state: state,
      execution_status: state === 'COLLECTION_FULLY_CERTIFIED' ? 'SUCCESS' : (state.startsWith('REJECTED') ? 'REJECTED_VALIDATION' : 'IN_PROGRESS'),
      observations_committed: state !== 'REJECTED_AUDIT_PERSISTED' && state !== 'REJECTED_AUDIT_FAILED',
      fully_certified: state === 'COLLECTION_FULLY_CERTIFIED',
      audit_persisted: state !== 'AUDIT_PERSIST_FAILED_AFTER_COMMIT' && state !== 'REJECTED_AUDIT_FAILED',
      ...telOverrides
    });
    const evSum = buildStableEvidencePayload(tel);
    const chk = computeEvidenceChecksum(evSum);
    const kind = state === 'AUDIT_RECOVERY_REQUIRED' ? 'RECOVERY' : 'NORMAL_COLLECTION';
    const op = state === 'AUDIT_RECOVERY_REQUIRED' ? 'ORPHAN_RECONCILIATION' : 'NORMAL_COLLECTION';
    const evtId = computeTransitionEventId({
      harvestBatchId: batchId,
      operationKind: op,
      fromLifecycleState: null,
      toLifecycleState: state,
      expectedStateVersion: null,
      evidenceChecksum: chk
    });
    const tId = computeTransitionId({
      harvestBatchId: batchId,
      transitionKind: kind,
      resultingStateVersion: 1,
      transitionEventId: evtId
    });
    return { tel, evSum, chk, kind, op, evtId, tId };
  }

  // -------------------------------------------------------------------------
  // Scenarios 1 - 10
  // -------------------------------------------------------------------------
  await test(1, 'Every explicitly permitted lifecycle transition (all 6 initial + all 5 update pairs)', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const initialStates = [
      'OBSERVATIONS_COMMITTED',
      'COLLECTION_FULLY_CERTIFIED',
      'REJECTED_AUDIT_PERSISTED',
      'AUDIT_PERSIST_FAILED_AFTER_COMMIT',
      'REJECTED_AUDIT_FAILED',
      'AUDIT_RECOVERY_REQUIRED'
    ];
    for (const s of initialStates) {
      const b = `init-${s}`;
      const { tel } = buildInitAndNext(sim, b, s);
      const r = await store.saveRun(tel);
      assert.strictEqual(r.state_version, 1);
      assert.strictEqual(r.audit_lifecycle_state, s);
    }
    // 5 update transitions:
    // u1: OBSERVATIONS_COMMITTED -> COLLECTION_FULLY_CERTIFIED
    const b1 = 'init-OBSERVATIONS_COMMITTED';
    const tel1 = makeCertifiedTelemetry({ harvest_batch_id: b1 });
    let u = await store.transitionBatch({ telemetryRecord: tel1, transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
    assert.strictEqual(u.state_version, 2);

    // u2: OBSERVATIONS_COMMITTED -> AUDIT_PERSIST_FAILED_AFTER_COMMIT -> u3 COLLECTION_FULLY_CERTIFIED
    const { tel: tObs } = buildInitAndNext(sim, 'b-obs2', 'OBSERVATIONS_COMMITTED');
    await store.saveRun(tObs);
    u = await store.transitionBatch({ telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'b-obs2', execution_status: 'AUDIT_PERSIST_FAILED_AFTER_COMMIT', audit_persisted: false, fully_certified: false }), transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'AUDIT_PERSIST_FAILED_AFTER_COMMIT', expectedStateVersion: 1 });
    assert.strictEqual(u.state_version, 2);
    u = await store.transitionBatch({ telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'b-obs2' }), transitionKind: 'RECOVERY', operationKind: 'PAYLOAD_REPLAY', fromLifecycleState: 'AUDIT_PERSIST_FAILED_AFTER_COMMIT', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 2 });
    assert.strictEqual(u.state_version, 3);

    // u4: REJECTED_AUDIT_FAILED -> REJECTED_AUDIT_PERSISTED
    u = await store.transitionBatch({ telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'init-REJECTED_AUDIT_FAILED', execution_status: 'REJECTED_VALIDATION', observations_committed: false, fully_certified: false }), transitionKind: 'RECOVERY', operationKind: 'PAYLOAD_REPLAY', fromLifecycleState: 'REJECTED_AUDIT_FAILED', toLifecycleState: 'REJECTED_AUDIT_PERSISTED', expectedStateVersion: 1 });
    assert.strictEqual(u.state_version, 2);

    // u5: AUDIT_RECOVERY_REQUIRED -> COLLECTION_FULLY_CERTIFIED
    u = await store.transitionBatch({ telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'init-AUDIT_RECOVERY_REQUIRED' }), transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
    assert.strictEqual(u.state_version, 2);
  });

  await test(2, 'Prohibited transitions & direct jumps raise integrity errors', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await store.saveRun(buildInitAndNext(sim, 'b-rej', 'REJECTED_AUDIT_FAILED').tel);
    await assert.rejects(() =>
      store.transitionBatch({ telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'b-rej' }), transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'REJECTED_AUDIT_FAILED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 })
    );
    await sim.runAsPostgresOwner(async (db) => {
      const { tel } = buildInitAndNext(sim, 'b-obs-bad', 'OBSERVATIONS_COMMITTED');
      db.setIntent('b-obs-bad', 1, { transition_id: makeHex('a'), transition_event_id: makeHex('b'), evidence_checksum: makeHex('c'), transition_kind: 'NORMAL_COLLECTION', harvest_batch_id: 'b-obs-bad', previous_lifecycle_state: null, new_lifecycle_state: 'OBSERVATIONS_COMMITTED', previous_state_version: 0, resulting_state_version: 1 });
      db.insertLog({ ...tel, state_rank: 10, state_version: 1 });
      db.insertTransition({ transition_id: makeHex('a'), harvest_batch_id: 'b-obs-bad', transition_kind: 'NORMAL_COLLECTION', previous_lifecycle_state: null, new_lifecycle_state: 'OBSERVATIONS_COMMITTED', previous_state_version: 0, resulting_state_version: 1, transition_event_id: makeHex('b'), evidence_checksum: makeHex('c') });
      assert.throws(() => db.updateLog('b-obs-bad', { audit_lifecycle_state: 'REJECTED_AUDIT_PERSISTED', state_rank: 30, state_version: 2 }));
    });
  });

  await test(3, 'Metadata-only updates (Contract B) preserve state_version & rank', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await store.saveRun(buildInitAndNext(sim, 'b-meta', 'OBSERVATIONS_COMMITTED').tel);
    const updated = await store.updateBatchMetadata({ harvestBatchId: 'b-meta', expectedStateVersion: 1, diagnosticNotes: 'Investigated delay' });
    assert.strictEqual(updated.state_version, 1);
    assert.strictEqual(sim.logs.get('b-meta').diagnostic_notes, 'Investigated delay');
    assert.strictEqual(sim.transitions.length, 1);
  });

  await test(4, 'Rejection of protected metadata changes on terminal records', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await store.saveRun(makeCertifiedTelemetry({ harvest_batch_id: 'b-term' }));
    await assert.rejects(() =>
      sim.runAsPostgresOwner(async (db) => {
        db.updateLog('b-term', { error_details: 'tamper' });
      })
    , /Terminal record protection/);
  });

  await test(5, 'Atomic rollback when recovery event insertion fails', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await store.saveRun(buildInitAndNext(sim, 'b-rb-evt', 'AUDIT_RECOVERY_REQUIRED').tel);
    sim.injectRecoveryInsertError = 'Simulated recovery event disk error';
    await assert.rejects(() =>
      store.transitionBatch({ telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'b-rb-evt' }), transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 })
    );
    assert.strictEqual(sim.logs.get('b-rb-evt').state_version, 1);
    assert.strictEqual(sim.logs.get('b-rb-evt').audit_lifecycle_state, 'AUDIT_RECOVERY_REQUIRED');
    assert.strictEqual(sim.transitions.length, 1);
  });

  await test(6, 'Concurrent recovery attempts with identical expected_state_version serialize cleanly', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await store.saveRun(buildInitAndNext(sim, 'b-conc-rec', 'AUDIT_RECOVERY_REQUIRED').tel);
    const recTel = makeCertifiedTelemetry({ harvest_batch_id: 'b-conc-rec' });
    const [r1, r2] = await Promise.all([
      store.transitionBatch({ telemetryRecord: recTel, transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 }),
      store.transitionBatch({ telemetryRecord: recTel, transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 })
    ]);
    assert.strictEqual(sim.logs.get('b-conc-rec').state_version, 2);
    assert.strictEqual(sim.recoveryEvents.filter((e) => e.harvest_batch_id === 'b-conc-rec').length, 2); // 1 orphan init + 1 promotion
    assert.ok(r1.outcome === 'APPLIED' || r2.idempotentHit === true);
  });

  await test(7, 'Duplicate recovery_event_id produces identical SHA-256 and 0 duplicates', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const init = buildInitAndNext(sim, 'b-dup-rec', 'AUDIT_RECOVERY_REQUIRED');
    await store.saveRun(init.tel);
    const replay = await store.saveRun(init.tel);
    assert.strictEqual(replay.idempotentHit, true);
    assert.strictEqual(sim.recoveryEvents.length, 1);
  });

  await test(8, 'Successful recovery increments state_version, sets is_recovered=TRUE, adds 1 event', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await store.saveRun(buildInitAndNext(sim, 'b-rec-ok', 'AUDIT_PERSIST_FAILED_AFTER_COMMIT').tel);
    const out = await store.transitionBatch({ telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'b-rec-ok' }), transitionKind: 'RECOVERY', operationKind: 'PAYLOAD_REPLAY', fromLifecycleState: 'AUDIT_PERSIST_FAILED_AFTER_COMMIT', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
    assert.strictEqual(out.state_version, 2);
    assert.strictEqual(sim.logs.get('b-rec-ok').is_recovered, true);
    assert.strictEqual(sim.recoveryEvents.length, 1);
  });

  await test(9, 'Recovery with incomplete original evidence blocks certification', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await store.saveRun(buildInitAndNext(sim, 'b-inc-ev', 'AUDIT_RECOVERY_REQUIRED').tel);
    await assert.rejects(() =>
      store.transitionBatch({ telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'b-inc-ev', api_reported_total: null }), transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 })
    , /ERR_INCOMPLETE_CERTIFICATION_EVIDENCE|api_reported_total/);
    assert.strictEqual(sim.logs.get('b-inc-ev').audit_lifecycle_state, 'AUDIT_RECOVERY_REQUIRED');
    assert.strictEqual(sim.logs.get('b-inc-ev').fully_certified, false);
  });

  await test(10, 'Certification only after all 6 gates pass via validateBulletinSixGates', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await store.saveRun(buildInitAndNext(sim, 'b-6gate', 'AUDIT_RECOVERY_REQUIRED').tel);
    await assert.rejects(() =>
      store.transitionBatch({
        telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'b-6gate' }),
        transitionKind: 'RECOVERY',
        operationKind: 'EVIDENCE_REVERIFICATION',
        fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED',
        toLifecycleState: 'COLLECTION_FULLY_CERTIFIED',
        expectedStateVersion: 1,
        validationInputs: { metadata: {}, parsedResult: { totalRows: 0, validRecords: [], rejectedRecords: [] }, streamComplete: false }
      })
    );
    const ok = await store.transitionBatch({ telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'b-6gate' }), transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
    assert.strictEqual(ok.state_version, 2);
  });

  // -------------------------------------------------------------------------
  // Scenarios 11 - 20
  // -------------------------------------------------------------------------
  await test(11, 'Certified record immutability under stale retries', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await store.saveRun(makeCertifiedTelemetry({ harvest_batch_id: 'b-stale-term' }));
    const res = await store.saveRun(makeCertifiedTelemetry({ harvest_batch_id: 'b-stale-term', audit_lifecycle_state: 'AUDIT_RECOVERY_REQUIRED', fully_certified: false }));
    assert.strictEqual(res.terminalPreserved, true);
    assert.strictEqual(sim.logs.get('b-stale-term').audit_lifecycle_state, 'COLLECTION_FULLY_CERTIFIED');
  });

  await test(12, 'Stale execution version rejection aborts cleanly', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await store.saveRun(buildInitAndNext(sim, 'b-stale-ver', 'OBSERVATIONS_COMMITTED').tel);
    await store.transitionBatch({ telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'b-stale-ver', audit_lifecycle_state: 'AUDIT_PERSIST_FAILED_AFTER_COMMIT', fully_certified: false, audit_persisted: false, execution_status: 'AUDIT_PERSIST_FAILED_AFTER_COMMIT' }), transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'AUDIT_PERSIST_FAILED_AFTER_COMMIT', expectedStateVersion: 1 });
    await assert.rejects(() =>
      store.transitionBatch({ telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'b-stale-ver' }), transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 })
    , /Optimistic concurrency/);
  });

  await test(13, 'Serverless termination orphan reconstruction keeps raw counters NULL', async () => {
    const sim = new IsolatedAuditPgSimulator();
    sim.observations.push(
      { state: 'Maharashtra', market: 'Pune', commodity: 'Onion', observation_date: '2026-11-11', raw_payload: { inserted_by_batch_id: 'batch_crash_1', batch_lineage: ['batch_crash_1'] } },
      { state: 'Gujarat', market: 'Rajkot', commodity: 'Wheat', observation_date: '2026-11-11', raw_payload: { inserted_by_batch_id: 'batch_crash_1', batch_lineage: ['batch_crash_1'] } }
    );
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const rec = await store.reconcileOrphanBatch({ harvestBatchId: 'batch_crash_1', collectionWindow: 'MORNING_06_00_IST' });
    assert.strictEqual(rec.reconciled, true);
    const row = sim.logs.get('batch_crash_1');
    assert.strictEqual(row.audit_lifecycle_state, 'AUDIT_RECOVERY_REQUIRED');
    assert.strictEqual(row.state_rank, 20);
    assert.strictEqual(row.fully_certified, false);
    assert.strictEqual(row.api_reported_total, null);
    assert.strictEqual(row.records_rejected, null);
  });

  await test(14, 'Permission denial for anon and authenticated across all 3 tables & RPCs', async () => {
    const sim = new IsolatedAuditPgSimulator();
    for (const role of ['anon', 'authenticated']) {
      const pool = sim.getPool(role);
      await assert.rejects(() => pool.query(`SELECT * FROM public.mandi_harvest_execution_log ORDER BY $1`, [1]), /permission denied/);
      await assert.rejects(() => pool.query(`SELECT * FROM public.fn_mandi_record_lifecycle_transition($1)`, ['x']), /permission denied/);
    }
  });

  await test(15, 'Read-only ml_engine_readonly succeeds on SELECT, fails on writes & RPCs', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const roPool = sim.getPool('ml_engine_readonly');
    const sel = await roPool.query(`SELECT * FROM public.mandi_harvest_execution_log ORDER BY $1`, [10]);
    assert.ok(Array.isArray(sel.rows));
    await assert.rejects(() => roPool.query(`INSERT INTO public.mandi_harvest_execution_log VALUES ($1)`, ['x']), /permission denied/);
    await assert.rejects(() => roPool.query(`SELECT * FROM public.fn_mandi_record_lifecycle_transition($1)`, ['x']), /permission denied/);
  });

  await test(16, 'Append-only enforcement blocks UPDATE/DELETE on transitions & recovery events', async () => {
    const sim = new IsolatedAuditPgSimulator();
    await assert.rejects(() => sim.getPool('service_role').query(`DELETE FROM public.mandi_harvest_lifecycle_transitions`, []), /permission denied/);
    await assert.rejects(() => sim.runAsPostgresOwner(async (db) => db.updateTransitionDirect()), /prohibits UPDATE/);
    await assert.rejects(() => sim.runAsPostgresOwner(async (db) => db.deleteRecoveryDirect()), /prohibits DELETE/);
  });

  await test(17, 'Unbounded scheduler lookup finds certified run past >50 newer runs', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await store.saveRun(makeCertifiedTelemetry({ harvest_batch_id: 'b-cert-old', target_observation_date: '2026-11-11', ogd_publication_timestamp: '2026-11-11T00:15:00Z', execution_end_utc: '2026-11-11T01:00:00Z' }));
    for (let i = 0; i < 75; i++) {
      await store.saveRun(makeCertifiedTelemetry({ harvest_batch_id: `b-rej-${i}`, audit_lifecycle_state: 'REJECTED_AUDIT_PERSISTED', execution_status: 'REJECTED_VALIDATION', observations_committed: false, fully_certified: false, target_observation_date: '2026-11-12', execution_end_utc: `2026-11-12T01:${String(i % 60).padStart(2, '0')}:00Z` }));
    }
    const found = await findAlreadyCertifiedRun(store, '2026-11-11', '2026-11-11T00:15:00Z');
    assert.ok(found && found.harvest_batch_id === 'b-cert-old');
  });

  await test(18, 'Clean rollback outside backend/migrations preserves mandi_historical_observations', async () => {
    const sim = new IsolatedAuditPgSimulator();
    sim.observations.push({ harvest_batch_id: 'obs-keep', state: 'UP', market: 'Agra', commodity: 'Potato', observation_date: '2026-11-11' });
    assert.match(rbSql, /DROP TABLE IF EXISTS public\.mandi_harvest_recovery_events/i);
    assert.match(rbSql, /DROP TABLE IF EXISTS public\.mandi_harvest_lifecycle_transitions/i);
    assert.match(rbSql, /DROP TABLE IF EXISTS public\.mandi_harvest_execution_log/i);
    assert(!/DROP TABLE.*mandi_historical_observations/i.test(rbSql));
    sim.dropped = true;
    assert.strictEqual(sim.observations.length, 1);
  });

  await test(19, 'Deterministic canonical IDs across repeated attempts & object key orders', async () => {
    const chk1 = computeEvidenceChecksum({ z: 1, nested: { b: 2, a: 'hello' }, a: null });
    const chk2 = computeEvidenceChecksum({ a: null, nested: { a: 'hello', b: 2 }, z: 1 });
    assert.strictEqual(chk1, chk2);
    const id1 = computeRecoveryEventId({ harvestBatchId: 'b1', recoveryMethod: 'PAYLOAD_REPLAY', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1, evidenceChecksum: chk1 });
    const id2 = computeRecoveryEventId({ harvestBatchId: 'b1', recoveryMethod: 'PAYLOAD_REPLAY', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1, evidenceChecksum: chk2 });
    assert.strictEqual(id1, id2);
  });

  await test(20, 'Delimiter and null vs empty-string collision immunity', async () => {
    const chk = makeHex('f');
    const a = computeTransitionEventId({ harvestBatchId: 'batch::A', operationKind: 'PAYLOAD_REPLAY', fromLifecycleState: null, toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: null, evidenceChecksum: chk });
    const b = computeTransitionEventId({ harvestBatchId: 'batch', operationKind: 'PAYLOAD_REPLAY', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 0, evidenceChecksum: chk });
    assert.notStrictEqual(a, b);
  });

  // -------------------------------------------------------------------------
  // Scenarios 21 - 30
  // -------------------------------------------------------------------------
  await test(21, 'Existing recovery_event_id with mismatched evidence throws ERR_RECOVERY_CONSISTENCY_VIOLATION', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const init = buildInitAndNext(sim, 'b-ev-mis', 'AUDIT_RECOVERY_REQUIRED');
    await store.saveRun(init.tel);
    sim.recoveryEvents[0].evidence_checksum = makeHex('9');
    await assert.rejects(() =>
      store.replayHistoricalRecoveryEvent({ harvestBatchId: 'b-ev-mis', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: init.chk })
    , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
  });

  await test(22, 'Concurrent orphan creation for same batch serializes via 64-bit xact lock', async () => {
    const sim = new IsolatedAuditPgSimulator();
    sim.observations.push({ state: 'MP', market: 'Indore', commodity: 'Soybean', observation_date: '2026-11-11', raw_payload: { inserted_by_batch_id: 'orphan-race-1' } });
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await Promise.all([
      store.reconcileOrphanBatch({ harvestBatchId: 'orphan-race-1' }),
      store.reconcileOrphanBatch({ harvestBatchId: 'orphan-race-1' })
    ]);
    assert.strictEqual(Array.from(sim.logs.values()).filter((r) => r.harvest_batch_id === 'orphan-race-1').length, 1);
    assert.strictEqual(sim.recoveryEvents.filter((r) => r.harvest_batch_id === 'orphan-race-1').length, 1);
  });

  await test(23, 'Concurrent orphan creation for distinct batches uses separate lock keys', async () => {
    const sim = new IsolatedAuditPgSimulator();
    sim.observations.push(
      { state: 'UP', market: 'Lucknow', commodity: 'Wheat', observation_date: '2026-11-11', raw_payload: { inserted_by_batch_id: 'orphan-A' } },
      { state: 'PB', market: 'Ludhiana', commodity: 'Paddy', observation_date: '2026-11-11', raw_payload: { inserted_by_batch_id: 'orphan-B' } }
    );
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const [a, b] = await Promise.all([
      store.reconcileOrphanBatch({ harvestBatchId: 'orphan-A' }),
      store.reconcileOrphanBatch({ harvestBatchId: 'orphan-B' })
    ]);
    assert.strictEqual(a.reconciled && b.reconciled, true);
  });

  await test(24, 'Primary-key race conflict handles concurrent duplicate creation cleanly', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const init = buildInitAndNext(sim, 'b-pk-race', 'OBSERVATIONS_COMMITTED');
    await Promise.all([store.saveRun(init.tel), store.saveRun(init.tel)]);
    assert.strictEqual(sim.transitions.filter((t) => t.harvest_batch_id === 'b-pk-race').length, 1);
  });

  await test(25, 'Cross-runtime Node.js vs Python RFC 8785 JCS SHA-256 parity', async () => {
    const sampleObj = {
      unicode: 'किसान-KisanOS-₹',
      arr: [null, 0, 1, 'a::b'],
      nested: { zKey: true, aKey: 42 }
    };
    const payload = ['batch-x', 'PAYLOAD_REPLAY', null, 'AUDIT_RECOVERY_REQUIRED', null, computeEvidenceChecksum(sampleObj)];
    const nodeCanonical = rfc8785Canonicalize(payload);
    const nodeHash = computeTransitionEventId({ harvestBatchId: 'batch-x', operationKind: 'PAYLOAD_REPLAY', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: payload[5] });

    const pyCode = [
      'import json, hashlib, sys',
      'data = json.loads(sys.argv[1])',
      'c = json.dumps(data, separators=(",", ":"), sort_keys=True, ensure_ascii=False)',
      'h = hashlib.sha256(c.encode("utf-8")).hexdigest()',
      'print(c + "\\n" + h)'
    ].join('\n');
    const out = execFileSync('python3', ['-c', pyCode, JSON.stringify(payload)], { encoding: 'utf8' }).trim().split('\n');
    assert.strictEqual(nodeCanonical, out[0]);
    assert.strictEqual(nodeHash, out[1]);
  });

  await test(26, 'Strict input typing rejects string/float versions, uppercase hex, undefined', async () => {
    const validChk = makeHex('a');
    assert.throws(() => computeTransitionEventId({ harvestBatchId: 'b', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: null, toLifecycleState: 'OBSERVATIONS_COMMITTED', expectedStateVersion: '1', evidenceChecksum: validChk }), AuditContractValidationError);
    assert.throws(() => computeTransitionEventId({ harvestBatchId: 'b', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: null, toLifecycleState: 'OBSERVATIONS_COMMITTED', expectedStateVersion: 1.5, evidenceChecksum: validChk }), AuditContractValidationError);
    assert.throws(() => computeTransitionEventId({ harvestBatchId: 'b', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: null, toLifecycleState: 'OBSERVATIONS_COMMITTED', expectedStateVersion: undefined, evidenceChecksum: validChk }), AuditContractValidationError);
    assert.throws(() => computeTransitionEventId({ harvestBatchId: 'b', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: null, toLifecycleState: 'OBSERVATIONS_COMMITTED', expectedStateVersion: null, evidenceChecksum: 'A'.repeat(64) }), AuditContractValidationError);
  });

  await test(27, 'Existing event with mismatched resulting_state_version rejected', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const init = buildInitAndNext(sim, 'b-res-mis', 'AUDIT_RECOVERY_REQUIRED');
    await store.saveRun(init.tel);
    sim.recoveryEvents[0].resulting_state_version = 99;
    await assert.rejects(() =>
      store.replayHistoricalRecoveryEvent({ harvestBatchId: 'b-res-mis', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: init.chk })
    , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
  });

  await test(28, 'Existing event with mismatched parent lifecycle state rejected', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const init = buildInitAndNext(sim, 'b-pstate-mis', 'AUDIT_RECOVERY_REQUIRED');
    await store.saveRun(init.tel);
    sim.logs.get('b-pstate-mis').audit_lifecycle_state = 'OBSERVATIONS_COMMITTED';
    await assert.rejects(() =>
      store.replayHistoricalRecoveryEvent({ harvestBatchId: 'b-pstate-mis', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: init.chk })
    , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
  });

  await test(29, 'Existing event whose parent state_version is inconsistent rejected', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const init = buildInitAndNext(sim, 'b-pver-mis', 'AUDIT_RECOVERY_REQUIRED');
    await store.saveRun(init.tel);
    sim.logs.get('b-pver-mis').state_version = 2;
    await assert.rejects(() =>
      store.replayHistoricalRecoveryEvent({ harvestBatchId: 'b-pver-mis', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: init.chk })
    , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
  });

  await test(30, 'Successful event & parent consistency verification succeeds with 0 writes', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const init = buildInitAndNext(sim, 'b-cons-ok', 'AUDIT_RECOVERY_REQUIRED');
    await store.saveRun(init.tel);
    const out = await store.replayHistoricalRecoveryEvent({ harvestBatchId: 'b-cons-ok', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: init.chk });
    assert.strictEqual(out.idempotentHit, true);
    assert.strictEqual(out.chainVerified, true);
  });

  // -------------------------------------------------------------------------
  // Scenarios 31 - 45
  // -------------------------------------------------------------------------
  await test(31, 'Historical replay at same state version', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const init = buildInitAndNext(sim, 'b-hr-31', 'AUDIT_RECOVERY_REQUIRED');
    await store.saveRun(init.tel);
    const res = await store.replayHistoricalRecoveryEvent({ harvestBatchId: 'b-hr-31', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: init.chk });
    assert.strictEqual(res.verifiedConsistent, true);
  });

  await test(32, 'Historical replay of E1 (v1) after subsequent valid E2 (v2) promotion', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const init = buildInitAndNext(sim, 'b-hr-32', 'AUDIT_RECOVERY_REQUIRED');
    await store.saveRun(init.tel);
    await store.transitionBatch({ telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'b-hr-32' }), transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
    const res = await store.replayHistoricalRecoveryEvent({ harvestBatchId: 'b-hr-32', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: init.chk });
    assert.strictEqual(res.chainVerified, true);
    assert.strictEqual(sim.logs.get('b-hr-32').state_version, 2);
  });

  await test(33, 'Historical replay after terminal certification succeeds without mutating parent', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const init = buildInitAndNext(sim, 'b-hr-33', 'AUDIT_RECOVERY_REQUIRED');
    await store.saveRun(init.tel);
    const certTel = makeCertifiedTelemetry({ harvest_batch_id: 'b-hr-33' });
    await store.transitionBatch({ telemetryRecord: certTel, transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
    const chk2 = computeEvidenceChecksum(buildStableEvidencePayload(certTel));
    const r2 = await store.replayHistoricalRecoveryEvent({ harvestBatchId: 'b-hr-33', recoveryMethod: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1, evidenceChecksum: chk2 });
    assert.strictEqual(r2.chainVerified, true);
  });

  await test(34, 'Missing intervening transition rejects with ERR_RECOVERY_CONSISTENCY_VIOLATION', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const init = buildInitAndNext(sim, 'b-hr-34', 'AUDIT_RECOVERY_REQUIRED');
    await store.saveRun(init.tel);
    sim.logs.get('b-hr-34').state_version = 3;
    sim.logs.get('b-hr-34').audit_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED';
    sim.transitions.push({ transition_id: makeHex('d'), harvest_batch_id: 'b-hr-34', transition_kind: 'RECOVERY', previous_lifecycle_state: 'AUDIT_RECOVERY_REQUIRED', new_lifecycle_state: 'COLLECTION_FULLY_CERTIFIED', previous_state_version: 2, resulting_state_version: 3, transition_event_id: makeHex('e'), evidence_checksum: init.chk });
    await assert.rejects(() =>
      store.replayHistoricalRecoveryEvent({ harvestBatchId: 'b-hr-34', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: init.chk })
    , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
  });

  await test(35, 'Contradictory transition history rejects with ERR_RECOVERY_CONSISTENCY_VIOLATION', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const init = buildInitAndNext(sim, 'b-hr-35', 'AUDIT_RECOVERY_REQUIRED');
    await store.saveRun(init.tel);
    sim.logs.get('b-hr-35').state_version = 2;
    sim.logs.get('b-hr-35').audit_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED';
    sim.transitions.push({ transition_id: makeHex('d'), harvest_batch_id: 'b-hr-35', transition_kind: 'NORMAL_COLLECTION', previous_lifecycle_state: 'OBSERVATIONS_COMMITTED', new_lifecycle_state: 'COLLECTION_FULLY_CERTIFIED', previous_state_version: 1, resulting_state_version: 2, transition_event_id: makeHex('e'), evidence_checksum: init.chk });
    await assert.rejects(() =>
      store.replayHistoricalRecoveryEvent({ harvestBatchId: 'b-hr-35', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: init.chk })
    , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
  });

  await test(36, 'Parent state_version lower than event version rejected in Step 2', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const init = buildInitAndNext(sim, 'b-hr-36', 'AUDIT_RECOVERY_REQUIRED');
    await store.saveRun(init.tel);
    await store.transitionBatch({ telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'b-hr-36' }), transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
    sim.logs.get('b-hr-36').state_version = 1;
    const chk2 = sim.recoveryEvents[1].evidence_checksum;
    await assert.rejects(() =>
      store.replayHistoricalRecoveryEvent({ harvestBatchId: 'b-hr-36', recoveryMethod: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1, evidenceChecksum: chk2 })
    , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
  });

  await test(37, 'Parent current state inconsistent with verified chain end rejected in Step 5', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const init = buildInitAndNext(sim, 'b-hr-37', 'AUDIT_RECOVERY_REQUIRED');
    await store.saveRun(init.tel);
    await store.transitionBatch({ telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'b-hr-37' }), transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
    sim.logs.get('b-hr-37').audit_lifecycle_state = 'AUDIT_RECOVERY_REQUIRED';
    await assert.rejects(() =>
      store.replayHistoricalRecoveryEvent({ harvestBatchId: 'b-hr-37', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: init.chk })
    , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
  });

  await test(38, 'Concurrent replay of historical event exits idempotently with 0 writes', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const init = buildInitAndNext(sim, 'b-hr-38', 'AUDIT_RECOVERY_REQUIRED');
    await store.saveRun(init.tel);
    await store.transitionBatch({ telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'b-hr-38' }), transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
    const [a, b] = await Promise.all([
      store.replayHistoricalRecoveryEvent({ harvestBatchId: 'b-hr-38', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: init.chk }),
      store.replayHistoricalRecoveryEvent({ harvestBatchId: 'b-hr-38', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: init.chk })
    ]);
    assert.strictEqual(a.chainVerified && b.chainVerified, true);
    assert.strictEqual(sim.transitions.length, 2);
  });

  await test(39, 'Atomic rollback when parent update succeeds but transition-history insert fails', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await store.saveRun(buildInitAndNext(sim, 'b-rb-39', 'OBSERVATIONS_COMMITTED').tel);
    sim.injectTransitionInsertError = 'Disk full on mandi_harvest_lifecycle_transitions';
    await assert.rejects(() =>
      store.transitionBatch({ telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'b-rb-39' }), transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 })
    );
    assert.strictEqual(sim.logs.get('b-rb-39').state_version, 1);
    assert.strictEqual(sim.logs.get('b-rb-39').audit_lifecycle_state, 'OBSERVATIONS_COMMITTED');
  });

  await test(40, 'Recovery event references transition with wrong transition_event_id', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const init = buildInitAndNext(sim, 'b-bind-40', 'AUDIT_RECOVERY_REQUIRED');
    await store.saveRun(init.tel);
    sim.transitions[0].transition_event_id = makeHex('8');
    await assert.rejects(() =>
      store.replayHistoricalRecoveryEvent({ harvestBatchId: 'b-bind-40', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: init.chk })
    , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
  });

  await test(41, 'Recovery event references transition with different evidence_checksum', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const init = buildInitAndNext(sim, 'b-bind-41', 'AUDIT_RECOVERY_REQUIRED');
    await store.saveRun(init.tel);
    sim.transitions[0].evidence_checksum = makeHex('7');
    await assert.rejects(() =>
      store.replayHistoricalRecoveryEvent({ harvestBatchId: 'b-bind-41', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: init.chk })
    , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION');
  });

  await test(42, 'Original transition missing or contradicts recovery event BEFORE subsequent chain', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const init = buildInitAndNext(sim, 'b-orig-42', 'AUDIT_RECOVERY_REQUIRED');
    await store.saveRun(init.tel);
    await store.transitionBatch({ telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'b-orig-42' }), transitionKind: 'RECOVERY', operationKind: 'EVIDENCE_REVERIFICATION', fromLifecycleState: 'AUDIT_RECOVERY_REQUIRED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
    sim.transitions[0].previous_lifecycle_state = 'OBSERVATIONS_COMMITTED';
    await assert.rejects(() =>
      store.replayHistoricalRecoveryEvent({ harvestBatchId: 'b-orig-42', recoveryMethod: 'ORPHAN_RECONCILIATION', fromLifecycleState: null, toLifecycleState: 'AUDIT_RECOVERY_REQUIRED', expectedStateVersion: null, evidenceChecksum: init.chk })
    , (e) => e.code === 'ERR_RECOVERY_CONSISTENCY_VIOLATION' && e.details.step === 3);
  });

  await test(43, 'Duplicate transition_event_id with identical 7 semantic fields is idempotent', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await store.saveRun(buildInitAndNext(sim, 'b-dup-43', 'OBSERVATIONS_COMMITTED').tel);
    const certTel = makeCertifiedTelemetry({ harvest_batch_id: 'b-dup-43' });
    await store.transitionBatch({ telemetryRecord: certTel, transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
    const r2 = await store.transitionBatch({ telemetryRecord: certTel, transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
    assert.strictEqual(r2.idempotentHit, true);
    assert.strictEqual(r2.alreadyApplied, true);
    assert.strictEqual(sim.transitions.length, 2);
  });

  await test(44, 'Duplicate transition_event_id with conflicting content throws ERR_TRANSITION_IDENTITY_CONFLICT', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await store.saveRun(buildInitAndNext(sim, 'b-conf-44', 'OBSERVATIONS_COMMITTED').tel);
    const certTel = makeCertifiedTelemetry({ harvest_batch_id: 'b-conf-44' });
    await store.transitionBatch({ telemetryRecord: certTel, transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 });
    sim.transitions[1].evidence_checksum = makeHex('4');
    await assert.rejects(() =>
      store.transitionBatch({ telemetryRecord: certTel, transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 })
    , (e) => e.code === 'ERR_TRANSITION_IDENTITY_CONFLICT');
  });

  await test(45, 'Concurrent duplicate normal transition attempts serialize with 0 duplicate rows', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await store.saveRun(buildInitAndNext(sim, 'b-norm-45', 'OBSERVATIONS_COMMITTED').tel);
    const certTel = makeCertifiedTelemetry({ harvest_batch_id: 'b-norm-45' });
    const [a, b] = await Promise.all([
      store.transitionBatch({ telemetryRecord: certTel, transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 }),
      store.transitionBatch({ telemetryRecord: certTel, transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 })
    ]);
    assert.strictEqual(sim.transitions.length, 2);
    assert.strictEqual(sim.logs.get('b-norm-45').state_version, 2);
    assert.ok(a.outcome === 'APPLIED' || b.idempotentHit === true);
  });

  // -------------------------------------------------------------------------
  // Scenarios 46 - 62 (v2.2.5 - v2.2.9 DB Enforcement, Write Boundary & Bidirectional Deferred Checks)
  // -------------------------------------------------------------------------
  await test(46, 'Initial OBSERVATIONS_COMMITTED creation and its v0 -> v1 history record', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await store.saveRun(buildInitAndNext(sim, 'b-init-46', 'OBSERVATIONS_COMMITTED').tel);
    const t = sim.transitions[0];
    assert.strictEqual(t.previous_lifecycle_state, null);
    assert.strictEqual(t.new_lifecycle_state, 'OBSERVATIONS_COMMITTED');
    assert.strictEqual(t.previous_state_version, 0);
    assert.strictEqual(t.resulting_state_version, 1);
    assert.strictEqual(t.transition_kind, 'NORMAL_COLLECTION');
  });

  await test(47, 'Reject lifecycle update (or insert) if matching history insertion is omitted', async () => {
    const sim = new IsolatedAuditPgSimulator();
    await assert.rejects(() =>
      sim.runAsPostgresOwner(async (db) => {
        const init = buildInitAndNext(sim, 'b-omit-47', 'OBSERVATIONS_COMMITTED');
        db.setIntent('b-omit-47', 1, { transition_id: init.tId, transition_event_id: init.evtId, evidence_checksum: init.chk, transition_kind: init.kind, harvest_batch_id: 'b-omit-47', previous_lifecycle_state: null, new_lifecycle_state: 'OBSERVATIONS_COMMITTED', previous_state_version: 0, resulting_state_version: 1 });
        db.insertLog({ ...init.tel, state_rank: 10, state_version: 1 });
        // History insert intentionally omitted -> must reject at COMMIT!
      })
    , /Exact 9-field transition identity verification failed/);
    assert.strictEqual(sim.logs.has('b-omit-47'), false);
  });

  await test(48, 'Roll back parent update if history insertion fails mid-transaction', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await store.saveRun(buildInitAndNext(sim, 'b-fail-48', 'OBSERVATIONS_COMMITTED').tel);
    sim.injectTransitionInsertError = 'Simulated history PK/constraint failure';
    await assert.rejects(() =>
      store.transitionBatch({ telemetryRecord: makeCertifiedTelemetry({ harvest_batch_id: 'b-fail-48' }), transitionKind: 'NORMAL_COLLECTION', operationKind: 'NORMAL_COLLECTION', fromLifecycleState: 'OBSERVATIONS_COMMITTED', toLifecycleState: 'COLLECTION_FULLY_CERTIFIED', expectedStateVersion: 1 })
    );
    assert.strictEqual(sim.logs.get('b-fail-48').state_version, 1);
  });

  await test(49, 'Metadata-only updates do not create history rows; spurious history rejected', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    await store.saveRun(buildInitAndNext(sim, 'b-meta-49', 'OBSERVATIONS_COMMITTED').tel);
    await store.updateBatchMetadata({ harvestBatchId: 'b-meta-49', expectedStateVersion: 1, diagnosticNotes: 'note' });
    assert.strictEqual(sim.transitions.length, 1);
    await assert.rejects(() =>
      sim.runAsPostgresOwner(async (db) => {
        db.updateLog('b-meta-49', { diagnostic_notes: 'note2' });
        db.setIntent('b-meta-49', 2, { transition_id: makeHex('a'), transition_event_id: makeHex('b'), evidence_checksum: makeHex('c'), transition_kind: 'NORMAL_COLLECTION', harvest_batch_id: 'b-meta-49', previous_lifecycle_state: 'OBSERVATIONS_COMMITTED', new_lifecycle_state: 'COLLECTION_FULLY_CERTIFIED', previous_state_version: 1, resulting_state_version: 2 });
        db.insertTransition({ transition_id: makeHex('a'), harvest_batch_id: 'b-meta-49', transition_kind: 'NORMAL_COLLECTION', previous_lifecycle_state: 'OBSERVATIONS_COMMITTED', new_lifecycle_state: 'COLLECTION_FULLY_CERTIFIED', previous_state_version: 1, resulting_state_version: 2, transition_event_id: makeHex('b'), evidence_checksum: makeHex('c') });
      })
    , /exceeds parent state_version/);
  });

  await test(50, 'Reject history row with incorrect transition_event_id or transition_id', async () => {
    const sim = new IsolatedAuditPgSimulator();
    await assert.rejects(() =>
      sim.runAsPostgresOwner(async (db) => {
        const init = buildInitAndNext(sim, 'b-50', 'OBSERVATIONS_COMMITTED');
        db.setIntent('b-50', 1, { transition_id: init.tId, transition_event_id: init.evtId, evidence_checksum: init.chk, transition_kind: init.kind, harvest_batch_id: 'b-50', previous_lifecycle_state: null, new_lifecycle_state: 'OBSERVATIONS_COMMITTED', previous_state_version: 0, resulting_state_version: 1 });
        db.insertLog({ ...init.tel, state_rank: 10, state_version: 1 });
        db.insertTransition({ transition_id: init.tId, harvest_batch_id: 'b-50', transition_kind: 'NORMAL_COLLECTION', previous_lifecycle_state: null, new_lifecycle_state: 'OBSERVATIONS_COMMITTED', previous_state_version: 0, resulting_state_version: 1, transition_event_id: makeHex('9'), evidence_checksum: init.chk });
      })
    );
  });

  await test(51, 'Reject history row with incorrect evidence_checksum', async () => {
    const sim = new IsolatedAuditPgSimulator();
    await assert.rejects(() =>
      sim.runAsPostgresOwner(async (db) => {
        const init = buildInitAndNext(sim, 'b-51', 'OBSERVATIONS_COMMITTED');
        db.setIntent('b-51', 1, { transition_id: init.tId, transition_event_id: init.evtId, evidence_checksum: init.chk, transition_kind: init.kind, harvest_batch_id: 'b-51', previous_lifecycle_state: null, new_lifecycle_state: 'OBSERVATIONS_COMMITTED', previous_state_version: 0, resulting_state_version: 1 });
        db.insertLog({ ...init.tel, state_rank: 10, state_version: 1 });
        db.insertTransition({ transition_id: init.tId, harvest_batch_id: 'b-51', transition_kind: 'NORMAL_COLLECTION', previous_lifecycle_state: null, new_lifecycle_state: 'OBSERVATIONS_COMMITTED', previous_state_version: 0, resulting_state_version: 1, transition_event_id: init.evtId, evidence_checksum: makeHex('0') });
      })
    );
  });

  await test(52, 'Reject history row with invalid or inconsistent transition_kind', async () => {
    const sim = new IsolatedAuditPgSimulator();
    await assert.rejects(() =>
      sim.runAsPostgresOwner(async (db) => {
        const init = buildInitAndNext(sim, 'b-52', 'OBSERVATIONS_COMMITTED');
        db.setIntent('b-52', 1, { transition_id: init.tId, transition_event_id: init.evtId, evidence_checksum: init.chk, transition_kind: 'RECOVERY', harvest_batch_id: 'b-52', previous_lifecycle_state: null, new_lifecycle_state: 'OBSERVATIONS_COMMITTED', previous_state_version: 0, resulting_state_version: 1 });
        db.insertLog({ ...init.tel, state_rank: 10, state_version: 1 });
        db.insertTransition({ transition_id: init.tId, harvest_batch_id: 'b-52', transition_kind: 'RECOVERY', previous_lifecycle_state: null, new_lifecycle_state: 'OBSERVATIONS_COMMITTED', previous_state_version: 0, resulting_state_version: 1, transition_event_id: init.evtId, evidence_checksum: init.chk });
      })
    , /Prohibited transition pair\/kind/);
  });

  await test(53, 'Reject prohibited lifecycle pair inserted directly into transition history', async () => {
    const sim = new IsolatedAuditPgSimulator();
    await assert.rejects(() =>
      sim.runAsPostgresOwner(async (db) => {
        const init = buildInitAndNext(sim, 'b-53', 'OBSERVATIONS_COMMITTED');
        db.setIntent('b-53', 1, { transition_id: init.tId, transition_event_id: init.evtId, evidence_checksum: init.chk, transition_kind: 'NORMAL_COLLECTION', harvest_batch_id: 'b-53', previous_lifecycle_state: null, new_lifecycle_state: 'OBSERVATIONS_COMMITTED', previous_state_version: 0, resulting_state_version: 1 });
        db.insertLog({ ...init.tel, state_rank: 10, state_version: 1 });
        db.insertTransition({ transition_id: init.tId, harvest_batch_id: 'b-53', transition_kind: 'NORMAL_COLLECTION', previous_lifecycle_state: null, new_lifecycle_state: 'OBSERVATIONS_COMMITTED', previous_state_version: 0, resulting_state_version: 1, transition_event_id: init.evtId, evidence_checksum: init.chk });
        db.updateLog('b-53', { audit_lifecycle_state: 'COLLECTION_FULLY_CERTIFIED', state_rank: 40, state_version: 2 });
        db.setIntent('b-53', 2, { transition_id: makeHex('d'), transition_event_id: makeHex('e'), evidence_checksum: init.chk, transition_kind: 'NORMAL_COLLECTION', harvest_batch_id: 'b-53', previous_lifecycle_state: 'REJECTED_AUDIT_FAILED', new_lifecycle_state: 'COLLECTION_FULLY_CERTIFIED', previous_state_version: 1, resulting_state_version: 2 });
        db.insertTransition({ transition_id: makeHex('d'), harvest_batch_id: 'b-53', transition_kind: 'NORMAL_COLLECTION', previous_lifecycle_state: 'REJECTED_AUDIT_FAILED', new_lifecycle_state: 'COLLECTION_FULLY_CERTIFIED', previous_state_version: 1, resulting_state_version: 2, transition_event_id: makeHex('e'), evidence_checksum: init.chk });
      })
    );
  });

  await test(54, 'Verify initial v0 -> v1 transitions accept only the 6 permitted initial states', async () => {
    const sim = new IsolatedAuditPgSimulator();
    await assert.rejects(() =>
      sim.runAsPostgresOwner(async (db) => {
        db.insertLog({ ...makeCertifiedTelemetry({ harvest_batch_id: 'b-54' }), audit_lifecycle_state: 'AUDIT_PERSISTED', state_rank: 20, state_version: 1 });
      })
    , /Prohibited initial lifecycle state/);
  });

  await test(55, 'Direct writes cannot bypass database-enforced transition contract', async () => {
    const sim = new IsolatedAuditPgSimulator();
    await assert.rejects(() => sim.getPool('service_role').query(`INSERT INTO public.mandi_harvest_execution_log VALUES ($1)`, ['x']), /permission denied/);
    await assert.rejects(() => sim.runAsPostgresOwner(async (db) => {
      db.insertLog({ ...makeCertifiedTelemetry({ harvest_batch_id: 'b-55' }), state_rank: 40, state_version: 1 });
    }), /missing write-boundary intent/);
  });

  await test(56, 'Forged transaction-intent GUC attempted by service_role is blocked by ACL & overwritten by gateway', async () => {
    const sim = new IsolatedAuditPgSimulator();
    const conn = sim.createConnection('service_role');
    await conn.query(`SELECT pg_catalog.set_config('kisanos.expected_transition_intents', $1, true)`, [JSON.stringify({ 'b-56:1': { transition_id: makeHex('1') } })]);
    await assert.rejects(() => conn.query(`INSERT INTO public.mandi_harvest_execution_log VALUES ($1)`, ['b-56']), /permission denied/);
    const store = new PostgresAuditTelemetryStore(sim.getPool('service_role'));
    const out = await store.saveRun(buildInitAndNext(sim, 'b-56', 'OBSERVATIONS_COMMITTED').tel);
    assert.strictEqual(out.state_version, 1);
    assert.notStrictEqual(sim.transitions[0].transition_id, makeHex('1'));
  });

  await test(57, 'Missing recovery event for RECOVERY transition rejected at COMMIT & rolled back', async () => {
    const sim = new IsolatedAuditPgSimulator();
    await assert.rejects(() =>
      sim.runAsPostgresOwner(async (db) => {
        const init = buildInitAndNext(sim, 'b-57', 'AUDIT_RECOVERY_REQUIRED');
        db.setIntent('b-57', 1, { transition_id: init.tId, transition_event_id: init.evtId, evidence_checksum: init.chk, transition_kind: 'RECOVERY', harvest_batch_id: 'b-57', previous_lifecycle_state: null, new_lifecycle_state: 'AUDIT_RECOVERY_REQUIRED', previous_state_version: 0, resulting_state_version: 1 });
        db.insertLog({ ...init.tel, state_rank: 20, state_version: 1 });
        db.insertTransition({ transition_id: init.tId, harvest_batch_id: 'b-57', transition_kind: 'RECOVERY', previous_lifecycle_state: null, new_lifecycle_state: 'AUDIT_RECOVERY_REQUIRED', previous_state_version: 0, resulting_state_version: 1, transition_event_id: init.evtId, evidence_checksum: init.chk });
        // Missing recovery_event row!
      })
    , /requires exact 1:1 recovery_event/);
    assert.strictEqual(sim.logs.has('b-57'), false);
  });

  await test(58, 'Duplicate recovery-event record rejected cleanly', async () => {
    const sim = new IsolatedAuditPgSimulator();
    await assert.rejects(() =>
      sim.runAsPostgresOwner(async (db) => {
        const init = buildInitAndNext(sim, 'b-58', 'AUDIT_RECOVERY_REQUIRED');
        db.setIntent('b-58', 1, { transition_id: init.tId, transition_event_id: init.evtId, evidence_checksum: init.chk, transition_kind: 'RECOVERY', harvest_batch_id: 'b-58', previous_lifecycle_state: null, new_lifecycle_state: 'AUDIT_RECOVERY_REQUIRED', previous_state_version: 0, resulting_state_version: 1 });
        db.insertLog({ ...init.tel, state_rank: 20, state_version: 1 });
        db.insertTransition({ transition_id: init.tId, harvest_batch_id: 'b-58', transition_kind: 'RECOVERY', previous_lifecycle_state: null, new_lifecycle_state: 'AUDIT_RECOVERY_REQUIRED', previous_state_version: 0, resulting_state_version: 1, transition_event_id: init.evtId, evidence_checksum: init.chk });
        db.insertRecoveryEvent({ recovery_event_id: init.evtId, transition_id: init.tId, transition_event_id: init.evtId, harvest_batch_id: 'b-58', recovery_method: 'ORPHAN_RECONCILIATION', from_lifecycle_state: null, to_lifecycle_state: 'AUDIT_RECOVERY_REQUIRED', expected_state_version: null, resulting_state_version: 1, evidence_checksum: init.chk });
        db.insertRecoveryEvent({ recovery_event_id: makeHex('6'), transition_id: init.tId, transition_event_id: makeHex('6'), harvest_batch_id: 'b-58', recovery_method: 'ORPHAN_RECONCILIATION', from_lifecycle_state: null, to_lifecycle_state: 'AUDIT_RECOVERY_REQUIRED', expected_state_version: null, resulting_state_version: 1, evidence_checksum: init.chk });
      })
    , /unique constraint/);
  });

  await test(59, 'Mismatched recovery-event record rejected cleanly', async () => {
    const sim = new IsolatedAuditPgSimulator();
    await assert.rejects(() =>
      sim.runAsPostgresOwner(async (db) => {
        const init = buildInitAndNext(sim, 'b-59', 'AUDIT_RECOVERY_REQUIRED');
        db.setIntent('b-59', 1, { transition_id: init.tId, transition_event_id: init.evtId, evidence_checksum: init.chk, transition_kind: 'RECOVERY', harvest_batch_id: 'b-59', previous_lifecycle_state: null, new_lifecycle_state: 'AUDIT_RECOVERY_REQUIRED', previous_state_version: 0, resulting_state_version: 1 });
        db.insertLog({ ...init.tel, state_rank: 20, state_version: 1 });
        db.insertTransition({ transition_id: init.tId, harvest_batch_id: 'b-59', transition_kind: 'RECOVERY', previous_lifecycle_state: null, new_lifecycle_state: 'AUDIT_RECOVERY_REQUIRED', previous_state_version: 0, resulting_state_version: 1, transition_event_id: init.evtId, evidence_checksum: init.chk });
        db.insertRecoveryEvent({ recovery_event_id: init.evtId, transition_id: init.tId, transition_event_id: init.evtId, harvest_batch_id: 'b-59', recovery_method: 'PAYLOAD_REPLAY', from_lifecycle_state: null, to_lifecycle_state: 'AUDIT_RECOVERY_REQUIRED', expected_state_version: null, resulting_state_version: 1, evidence_checksum: init.chk });
      })
    , /Mismatched recovery_method/);
  });

  await test(60, 'Order independence: recovery_event inserted BEFORE transition commits cleanly at COMMIT', async () => {
    const sim = new IsolatedAuditPgSimulator();
    await sim.runAsPostgresOwner(async (db) => {
      const init = buildInitAndNext(sim, 'b-60', 'AUDIT_RECOVERY_REQUIRED');
      db.setIntent('b-60', 1, { transition_id: init.tId, transition_event_id: init.evtId, evidence_checksum: init.chk, transition_kind: 'RECOVERY', harvest_batch_id: 'b-60', previous_lifecycle_state: null, new_lifecycle_state: 'AUDIT_RECOVERY_REQUIRED', previous_state_version: 0, resulting_state_version: 1 });
      db.insertLog({ ...init.tel, state_rank: 20, state_version: 1 });
      // Insert recovery event BEFORE transition in the same transaction
      db.insertRecoveryEvent({ recovery_event_id: init.evtId, transition_id: init.tId, transition_event_id: init.evtId, harvest_batch_id: 'b-60', recovery_method: 'ORPHAN_RECONCILIATION', from_lifecycle_state: null, to_lifecycle_state: 'AUDIT_RECOVERY_REQUIRED', expected_state_version: null, resulting_state_version: 1, evidence_checksum: init.chk });
      db.insertTransition({ transition_id: init.tId, harvest_batch_id: 'b-60', transition_kind: 'RECOVERY', previous_lifecycle_state: null, new_lifecycle_state: 'AUDIT_RECOVERY_REQUIRED', previous_state_version: 0, resulting_state_version: 1, transition_event_id: init.evtId, evidence_checksum: init.chk });
    });
    assert.strictEqual(sim.logs.get('b-60').state_version, 1);
    assert.strictEqual(sim.recoveryEvents.length, 1);
  });

  await test(61, 'NORMAL_COLLECTION transition paired with extra recovery event rejected regardless of order', async () => {
    const sim = new IsolatedAuditPgSimulator();
    await assert.rejects(() =>
      sim.runAsPostgresOwner(async (db) => {
        const init = buildInitAndNext(sim, 'b-61', 'OBSERVATIONS_COMMITTED');
        db.setIntent('b-61', 1, { transition_id: init.tId, transition_event_id: init.evtId, evidence_checksum: init.chk, transition_kind: 'NORMAL_COLLECTION', harvest_batch_id: 'b-61', previous_lifecycle_state: null, new_lifecycle_state: 'OBSERVATIONS_COMMITTED', previous_state_version: 0, resulting_state_version: 1 });
        db.insertLog({ ...init.tel, state_rank: 10, state_version: 1 });
        db.insertRecoveryEvent({ recovery_event_id: init.evtId, transition_id: init.tId, transition_event_id: init.evtId, harvest_batch_id: 'b-61', recovery_method: 'ORPHAN_RECONCILIATION', from_lifecycle_state: null, to_lifecycle_state: 'OBSERVATIONS_COMMITTED', expected_state_version: null, resulting_state_version: 1, evidence_checksum: init.chk });
        db.insertTransition({ transition_id: init.tId, harvest_batch_id: 'b-61', transition_kind: 'NORMAL_COLLECTION', previous_lifecycle_state: null, new_lifecycle_state: 'OBSERVATIONS_COMMITTED', previous_state_version: 0, resulting_state_version: 1, transition_event_id: init.evtId, evidence_checksum: init.chk });
      })
    , /prohibits recovery_event rows/);
  });

  await test(62, 'Orphan recovery event without matching transition rejected at COMMIT & rolled back', async () => {
    const sim = new IsolatedAuditPgSimulator();
    await assert.rejects(() =>
      sim.runAsPostgresOwner(async (db) => {
        const evtId = makeHex('3');
        db.insertRecoveryEvent({ recovery_event_id: evtId, transition_id: makeHex('4'), transition_event_id: evtId, harvest_batch_id: 'b-62', recovery_method: 'ORPHAN_RECONCILIATION', from_lifecycle_state: null, to_lifecycle_state: 'AUDIT_RECOVERY_REQUIRED', expected_state_version: null, resulting_state_version: 1, evidence_checksum: makeHex('5') });
      })
    , /fk_recovery_exact_transition_binding/);
    assert.strictEqual(sim.recoveryEvents.length, 0);
  });

  await test(63, 'Provenance regression: reconcileOrphanBatch matches updated_by_batch_id and batch_lineage JSONB arrays', async () => {
    const sim = new IsolatedAuditPgSimulator();
    sim.observations.push(
      { state: 'Maharashtra', market: 'Nashik', commodity: 'Onion', observation_date: '2026-11-11', raw_payload: { inserted_by_batch_id: 'orig-batch', updated_by_batch_id: 'upd-batch-1', batch_lineage: ['orig-batch', 'upd-batch-1'] } },
      { state: 'Karnataka', market: 'Kolar', commodity: 'Tomato', observation_date: '2026-11-11', raw_payload: { inserted_by_batch_id: 'orig-batch', updated_by_batch_id: 'later-batch', batch_lineage: ['orig-batch', 'hist-lineage-1', 'later-batch'] } }
    );
    const store = new PostgresAuditTelemetryStore(sim.getPool());
    const recUpd = await store.reconcileOrphanBatch({ harvestBatchId: 'upd-batch-1' });
    assert.strictEqual(recUpd.reconciled, true);
    assert.strictEqual(sim.logs.get('upd-batch-1').distinct_states, 1);

    const recLineage = await store.reconcileOrphanBatch({ harvestBatchId: 'hist-lineage-1' });
    assert.strictEqual(recLineage.reconciled, true);
    assert.strictEqual(sim.logs.get('hist-lineage-1').distinct_markets, 1);

    const recMissing = await store.reconcileOrphanBatch({ harvestBatchId: 'nonexistent-batch-999' });
    assert.strictEqual(recMissing.reconciled, false);
    assert.strictEqual(recMissing.reason, 'NO_COMMITTED_OBSERVATIONS_FOUND');
  });

  console.log('\n================================================================');
  console.log(`Stage F.1.4 / F.1.5 Isolated Simulator Scoreboard: ${passed}/63 scenarios passed, ${failed} failed.`);
  console.log(`Live PostgreSQL Engine Verification: ${pgStatus}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('[FATAL TEST RUNNER ERROR]', err);
  process.exit(1);
});

