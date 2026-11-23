/**
 * KisanOS Durable Audit & Batch Telemetry Store (Milestones F.1.2, F.1.4 & F.1.5)
 *
 * SERVERLESS DURABILITY DESIGN:
 * Local filesystem logs are ephemeral in serverless runtimes. Production execution
 * durability relies on PostgreSQL tables (`mandi_harvest_execution_log`,
 * `mandi_harvest_lifecycle_transitions`, `mandi_harvest_recovery_events`) governed by
 * hardened postgres-owned `SECURITY DEFINER` gateway functions and bilateral
 * `DEFERRABLE INITIALLY DEFERRED` integrity triggers (Migration 013).
 */

const {
  AUDIT_LIFECYCLE_STATES,
  CANONICAL_STATE_RANKS,
  TRANSITION_KINDS,
  RECOVERY_METHODS,
  AuditContractValidationError,
  rfc8785Canonicalize,
  computeEvidenceChecksum,
  computeTransitionEventId,
  computeRecoveryEventId,
  computeTransitionId,
  assertNonEmptyBatchId,
  assertSha256LowerHex,
  assertStrictLifecycleState,
  assertStrictExpectedStateVersion
} = require('./canonicalAuditIdentity');
const { validateBulletinSixGates } = require('./bulletinValidationService');

const PERMITTED_INITIAL_TRANSITIONS = Object.freeze({
  OBSERVATIONS_COMMITTED: TRANSITION_KINDS.NORMAL_COLLECTION,
  COLLECTION_FULLY_CERTIFIED: TRANSITION_KINDS.NORMAL_COLLECTION,
  REJECTED_AUDIT_PERSISTED: TRANSITION_KINDS.NORMAL_COLLECTION,
  AUDIT_PERSIST_FAILED_AFTER_COMMIT: TRANSITION_KINDS.NORMAL_COLLECTION,
  REJECTED_AUDIT_FAILED: TRANSITION_KINDS.NORMAL_COLLECTION,
  AUDIT_RECOVERY_REQUIRED: TRANSITION_KINDS.RECOVERY
});

const PERMITTED_UPDATE_TRANSITIONS = Object.freeze([
  { from: 'OBSERVATIONS_COMMITTED', to: 'COLLECTION_FULLY_CERTIFIED', kind: TRANSITION_KINDS.NORMAL_COLLECTION, method: 'NORMAL_COLLECTION' },
  { from: 'OBSERVATIONS_COMMITTED', to: 'AUDIT_PERSIST_FAILED_AFTER_COMMIT', kind: TRANSITION_KINDS.NORMAL_COLLECTION, method: 'NORMAL_COLLECTION' },
  { from: 'AUDIT_PERSIST_FAILED_AFTER_COMMIT', to: 'COLLECTION_FULLY_CERTIFIED', kind: TRANSITION_KINDS.RECOVERY, method: 'PAYLOAD_REPLAY' },
  { from: 'REJECTED_AUDIT_FAILED', to: 'REJECTED_AUDIT_PERSISTED', kind: TRANSITION_KINDS.RECOVERY, method: 'PAYLOAD_REPLAY' },
  { from: 'AUDIT_RECOVERY_REQUIRED', to: 'COLLECTION_FULLY_CERTIFIED', kind: TRANSITION_KINDS.RECOVERY, method: 'EVIDENCE_REVERIFICATION' }
]);

const TERMINAL_STATES = new Set([
  AUDIT_LIFECYCLE_STATES.COLLECTION_FULLY_CERTIFIED,
  AUDIT_LIFECYCLE_STATES.REJECTED_AUDIT_PERSISTED
]);

const SIX_GATE_KEYS = [
  'gate1_stream_parity',
  'gate2_geographic_breadth',
  'gate3_market_diversity',
  'gate4_commodity_and_volume',
  'gate5_error_and_duplicate_budget',
  'gate6_volume_continuity'
];

class RecoveryConsistencyError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'RecoveryConsistencyError';
    this.code = 'ERR_RECOVERY_CONSISTENCY_VIOLATION';
    this.details = details;
  }
}

class TransitionIdentityConflictError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'TransitionIdentityConflictError';
    this.code = 'ERR_TRANSITION_IDENTITY_CONFLICT';
    this.details = details;
  }
}

/**
 * Format a JavaScript Date into an explicit IST (+05:30) ISO-8601 string.
 */
function formatISTTimestamp(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + istOffsetMs);
  return istDate.toISOString().replace('Z', '+05:30');
}

/**
 * Build a complete, non-fabricated batch telemetry record covering all required
 * audit dimensions from Milestone F.1.2 Part B & F.1.4 nullable crash-recovery rules.
 */
function createBatchTelemetryRecord({
  harvest_batch_id,
  execution_start_utc,
  execution_end_utc = null,
  collection_window = 'MANUAL',
  target_observation_date = null,
  ogd_publication_timestamp = null,
  api_reported_total = null,
  records_fetched = 0,
  records_parsed = 0,
  records_inserted = 0,
  records_updated = 0,
  records_skipped = 0,
  records_rejected = 0,
  duplicate_count = 0,
  distinct_states = 0,
  distinct_markets = 0,
  distinct_commodities = 0,
  gates = null,
  final_validation_status = 'PENDING',
  execution_status = 'IN_PROGRESS',
  observations_committed = false,
  audit_persisted = false,
  fully_certified = false,
  audit_lifecycle_state = AUDIT_LIFECYCLE_STATES.OBSERVATIONS_COMMITTED,
  error_details = null,
  diagnostic_notes = null
} = {}) {
  const startUtc = execution_start_utc instanceof Date
    ? execution_start_utc.toISOString()
    : execution_start_utc || new Date().toISOString();

  const endUtc = execution_end_utc instanceof Date
    ? execution_end_utc.toISOString()
    : execution_end_utc;

  return {
    harvest_batch_id,
    execution_start_utc: startUtc,
    execution_start_ist: formatISTTimestamp(startUtc),
    execution_end_utc: endUtc,
    execution_end_ist: endUtc ? formatISTTimestamp(endUtc) : null,
    collection_window,
    target_observation_date: target_observation_date || null,
    ogd_publication_timestamp: ogd_publication_timestamp || null,
    api_reported_total: api_reported_total !== undefined ? api_reported_total : null,
    records_fetched,
    records_parsed,
    records_inserted,
    records_updated,
    records_skipped,
    records_rejected,
    duplicate_count,
    distinct_states,
    distinct_markets,
    distinct_commodities,
    gates: gates || {},
    final_validation_status,
    execution_status,
    observations_committed: Boolean(observations_committed),
    audit_persisted: Boolean(audit_persisted),
    fully_certified: Boolean(fully_certified),
    audit_lifecycle_state,
    error_details: error_details || null,
    diagnostic_notes: diagnostic_notes || null
  };
}

/**
 * Extract deterministic, wall-clock-free evidence summary for RFC 8785 checksum hashing.
 */
function buildStableEvidencePayload(record = {}) {
  return {
    harvest_batch_id: record.harvest_batch_id,
    collection_window: record.collection_window || 'MANUAL',
    target_observation_date: record.target_observation_date || null,
    ogd_publication_timestamp: record.ogd_publication_timestamp || null,
    api_reported_total: record.api_reported_total !== undefined ? record.api_reported_total : null,
    records_fetched: record.records_fetched !== undefined ? record.records_fetched : null,
    records_parsed: record.records_parsed !== undefined ? record.records_parsed : null,
    records_inserted: record.records_inserted !== undefined ? record.records_inserted : null,
    records_updated: record.records_updated !== undefined ? record.records_updated : null,
    records_skipped: record.records_skipped !== undefined ? record.records_skipped : null,
    records_rejected: record.records_rejected !== undefined ? record.records_rejected : null,
    duplicate_count: record.duplicate_count !== undefined ? record.duplicate_count : null,
    distinct_states: record.distinct_states !== undefined ? record.distinct_states : null,
    distinct_markets: record.distinct_markets !== undefined ? record.distinct_markets : null,
    distinct_commodities: record.distinct_commodities !== undefined ? record.distinct_commodities : null,
    gates: record.gates || {},
    final_validation_status: record.final_validation_status || 'PENDING',
    execution_status: record.execution_status || 'IN_PROGRESS',
    observations_committed: Boolean(record.observations_committed)
  };
}

function isPermittedTransition(fromState, toState, transitionKind) {
  if (fromState === null) {
    return PERMITTED_INITIAL_TRANSITIONS[toState] === transitionKind;
  }
  return PERMITTED_UPDATE_TRANSITIONS.some(
    (rule) => rule.from === fromState && rule.to === toState && rule.kind === transitionKind
  );
}

/**
 * Verify complete six-gate evidence before certifying a batch via recovery.
 */
function verifyCertificationEvidenceComplete(telemetryRecord, { validationInputs = null, validateSixGatesFn = validateBulletinSixGates } = {}) {
  if (validationInputs) {
    const res = validateSixGatesFn(validationInputs);
    if (!res || !res.passed) {
      throw new AuditContractValidationError(
        `Recovery certification rejected by validateBulletinSixGates (${res ? res.finalValidationStatus : 'NO_RESULT'})`,
        'ERR_INCOMPLETE_CERTIFICATION_EVIDENCE'
      );
    }
    return res;
  }

  if (!telemetryRecord || telemetryRecord.observations_committed !== true) {
    throw new AuditContractValidationError('Cannot certify batch without observations_committed = true', 'ERR_INCOMPLETE_CERTIFICATION_EVIDENCE');
  }
  const requiredNonNull = ['api_reported_total', 'records_fetched', 'records_parsed', 'records_rejected', 'duplicate_count'];
  for (const field of requiredNonNull) {
    if (telemetryRecord[field] === null || telemetryRecord[field] === undefined) {
      throw new AuditContractValidationError(
        `Cannot certify recovered batch with missing ${field}; batch must remain AUDIT_RECOVERY_REQUIRED`,
        'ERR_INCOMPLETE_CERTIFICATION_EVIDENCE'
      );
    }
  }
  const gates = telemetryRecord.gates || {};
  for (const key of SIX_GATE_KEYS) {
    if (!gates[key] || gates[key].passed !== true) {
      throw new AuditContractValidationError(
        `Cannot certify recovered batch: missing or failed gate '${key}'`,
        'ERR_INCOMPLETE_CERTIFICATION_EVIDENCE'
      );
    }
  }
  if (telemetryRecord.execution_status !== 'SUCCESS') {
    throw new AuditContractValidationError(
      `Cannot certify recovered batch with execution_status=${telemetryRecord.execution_status}`,
      'ERR_INCOMPLETE_CERTIFICATION_EVIDENCE'
    );
  }
  return { passed: true, gates };
}

/**
 * Abstract base interface for durable telemetry persistence.
 */
class AuditTelemetryStore {
  async saveRun(_telemetryRecord) {
    throw new Error('AuditTelemetryStore.saveRun() must be implemented by concrete adapter');
  }

  async getLastSuccessfulRun(_options = {}) {
    throw new Error('AuditTelemetryStore.getLastSuccessfulRun() must be implemented by concrete adapter');
  }

  async findCertifiedRun(_options = {}) {
    throw new Error('AuditTelemetryStore.findCertifiedRun() must be implemented by concrete adapter');
  }

  async listRuns(_limit = 50) {
    throw new Error('AuditTelemetryStore.listRuns() must be implemented by concrete adapter');
  }
}

/**
 * Isolated In-Memory Audit Store for deterministic unit/integration testing.
 * Zero disk I/O; zero database connections.
 */
class InMemoryAuditStore extends AuditTelemetryStore {
  constructor() {
    super();
    this.runs = [];
  }

  async saveRun(telemetryRecord) {
    const copy = JSON.parse(JSON.stringify(telemetryRecord));
    this.runs.push(copy);
    return copy;
  }

  async getLastSuccessfulRun({ excludeBatchId = null } = {}) {
    for (let i = this.runs.length - 1; i >= 0; i--) {
      const r = this.runs[i];
      if (
        (r.execution_status === 'SUCCESS' || r.execution_status === 'SUCCESS_INVESTIGATION_NEEDED') &&
        (!excludeBatchId || r.harvest_batch_id !== excludeBatchId)
      ) {
        return JSON.parse(JSON.stringify(r));
      }
    }
    return null;
  }

  async findCertifiedRun({ targetObservationDate, ogdPublicationTimestamp = null, collectionWindow = null } = {}) {
    if (!targetObservationDate || !ogdPublicationTimestamp) return null;
    for (let i = this.runs.length - 1; i >= 0; i--) {
      const r = this.runs[i];
      if (
        r.fully_certified === true &&
        r.audit_persisted === true &&
        r.observations_committed === true &&
        r.execution_status === 'SUCCESS' &&
        r.audit_lifecycle_state === AUDIT_LIFECYCLE_STATES.COLLECTION_FULLY_CERTIFIED &&
        r.target_observation_date === targetObservationDate &&
        r.ogd_publication_timestamp === ogdPublicationTimestamp &&
        (!collectionWindow || r.collection_window === collectionWindow)
      ) {
        return JSON.parse(JSON.stringify(r));
      }
    }
    return null;
  }

  async listRuns(limit = 50) {
    return this.runs.slice(-limit).map((r) => JSON.parse(JSON.stringify(r)));
  }
}

/**
 * Simulates an audit storage failure (e.g., network outage or permission error)
 * to test graceful error isolation without aborting/corrupting market observations.
 */
class FailingAuditStore extends AuditTelemetryStore {
  constructor(errorMessage = 'Simulated telemetry persistence outage') {
    super();
    this.errorMessage = errorMessage;
  }

  async saveRun() {
    throw new Error(this.errorMessage);
  }

  async getLastSuccessfulRun() {
    throw new Error(this.errorMessage);
  }

  async findCertifiedRun() {
    throw new Error(this.errorMessage);
  }

  async listRuns() {
    throw new Error(this.errorMessage);
  }
}

/**
 * Durable PostgreSQL Telemetry Store adhering to Design v2.2.9 & Migration 013.
 * Executes all mutations through hardened `postgres`-owned SECURITY DEFINER gateway functions
 * with 64-bit advisory locks, RFC 8785 JCS identity generation, and 5-step replay verification.
 */
class PostgresAuditTelemetryStore extends AuditTelemetryStore {
  constructor(dbClientOrPool, { actor = 'kisanos-audit-store', validateSixGatesFn = validateBulletinSixGates } = {}) {
    super();
    if (!dbClientOrPool || typeof dbClientOrPool.query !== 'function') {
      throw new Error('PostgresAuditTelemetryStore requires a pg Pool or Client instance');
    }
    this.db = dbClientOrPool;
    this.actor = actor;
    this.validateSixGatesFn = validateSixGatesFn;
    this._savepointCounter = 0;
  }

  _isPool(conn) {
    return typeof conn.connect === 'function';
  }

  async _withTransaction(fn) {
    if (this._isPool(this.db)) {
      const client = await this.db.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client, { usesSavepoint: false });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch (_rbErr) {
          // Ignore secondary rollback errors
        }
        throw err;
      } finally {
        client.release();
      }
    }

    const spName = `sp_audit_${++this._savepointCounter}`;
    let startedOwnTx = false;
    try {
      await this.db.query('BEGIN');
      startedOwnTx = true;
    } catch (_alreadyInTxOrError) {
      await this.db.query(`SAVEPOINT ${spName}`);
    }

    try {
      const result = await fn(this.db, { usesSavepoint: !startedOwnTx });
      if (startedOwnTx) {
        await this.db.query('COMMIT');
      } else {
        await this.db.query(`RELEASE SAVEPOINT ${spName}`);
      }
      return result;
    } catch (err) {
      try {
        if (startedOwnTx) {
          await this.db.query('ROLLBACK');
        } else {
          await this.db.query(`ROLLBACK TO SAVEPOINT ${spName}`);
        }
      } catch (_rbErr) {
        // Ignore rollback failure
      }
      throw err;
    }
  }

  async _withReadOnlyRollbackTransaction(fn) {
    return this._withTransaction(async (client, meta) => {
      const res = await fn(client, meta);
      return res;
    });
  }

  /**
   * Direct partial-index lookup (`idx_mandi_harvest_certified_lookup`, LIMIT 1).
   * Eliminates `listRuns(50)` sliding-window blindness across any run volume.
   */
  async findCertifiedRun({ targetObservationDate, ogdPublicationTimestamp = null, collectionWindow = null } = {}) {
    if (!targetObservationDate || !ogdPublicationTimestamp) {
      return null;
    }

    const params = [targetObservationDate, ogdPublicationTimestamp];
    let windowClause = '';
    if (collectionWindow) {
      params.push(collectionWindow);
      windowClause = `AND collection_window = $3`;
    }

    const sql = `
      SELECT
        *,
        target_observation_date::text AS target_observation_date,
        CASE
          WHEN ogd_publication_timestamp IS NULL THEN NULL
          ELSE pg_catalog.to_char(ogd_publication_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        END AS ogd_publication_timestamp
      FROM public.mandi_harvest_execution_log
      WHERE fully_certified = TRUE
        AND audit_persisted = TRUE
        AND observations_committed = TRUE
        AND execution_status = 'SUCCESS'
        AND audit_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED'
        AND target_observation_date = $1::date
        AND ogd_publication_timestamp = $2::timestamptz
        ${windowClause}
      ORDER BY execution_end_utc DESC NULLS LAST, created_at DESC
      LIMIT 1;
    `;
    const result = await this.db.query(sql, params);
    return result.rows[0] ? { ...result.rows[0] } : null;
  }

  async getLastSuccessfulRun({ excludeBatchId = null } = {}) {
    const params = [];
    let excludeClause = '';
    if (excludeBatchId) {
      params.push(excludeBatchId);
      excludeClause = 'AND harvest_batch_id != $1';
    }
    const sql = `
      SELECT *
      FROM public.mandi_harvest_execution_log
      WHERE observations_committed = TRUE
        AND execution_status IN ('SUCCESS', 'SUCCESS_INVESTIGATION_NEEDED')
        ${excludeClause}
      ORDER BY target_observation_date DESC NULLS LAST, execution_end_utc DESC NULLS LAST
      LIMIT 1;
    `;
    const result = await this.db.query(sql, params);
    return result.rows[0] ? { ...result.rows[0] } : null;
  }

  async listRuns(limit = 50) {
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 50));
    const result = await this.db.query(
      `SELECT * FROM public.mandi_harvest_execution_log ORDER BY execution_start_utc DESC LIMIT $1`,
      [safeLimit]
    );
    return result.rows.map((r) => ({ ...r }));
  }

  /**
   * 5-Step Historical Replay Verification Sequence (Design v2.2.9 §3.1).
   * Must be invoked inside an active transaction after acquiring 64-bit advisory xact lock.
   */
  async _verifyHistoricalReplayInTx(client, {
    existingEvent,
    harvestBatchId,
    recoveryMethod,
    fromLifecycleState,
    toLifecycleState,
    expectedStateVersion,
    evidenceChecksum
  }) {
    const expectedResultingVersion = expectedStateVersion === null ? 1 : expectedStateVersion + 1;

    // Step 1: Verify all 6 recovery-event identity fields, resulting_state_version, & recovery === transition event id
    if (
      existingEvent.harvest_batch_id !== harvestBatchId ||
      existingEvent.recovery_method !== recoveryMethod ||
      existingEvent.from_lifecycle_state !== fromLifecycleState ||
      existingEvent.to_lifecycle_state !== toLifecycleState ||
      existingEvent.expected_state_version !== expectedStateVersion ||
      existingEvent.evidence_checksum !== evidenceChecksum ||
      existingEvent.resulting_state_version !== expectedResultingVersion ||
      existingEvent.recovery_event_id !== existingEvent.transition_event_id
    ) {
      throw new RecoveryConsistencyError(
        `Step 1 replay mismatch for recovery_event_id ${existingEvent.recovery_event_id}`,
        { step: 1, recoveryEventId: existingEvent.recovery_event_id }
      );
    }

    // Step 2: Load parent row (serialized under held 64-bit advisory xact lock; SELECT-only compatible for service_role)
    const parentRes = await client.query(
      `SELECT * FROM public.mandi_harvest_execution_log WHERE harvest_batch_id = $1`,
      [harvestBatchId]
    );
    const parentRow = parentRes.rows[0] || null;
    if (!parentRow || parentRow.state_version < existingEvent.resulting_state_version) {
      throw new RecoveryConsistencyError(
        `Step 2 parent missing or state_version (${parentRow ? parentRow.state_version : 'NONE'}) < event resulting_state_version (${existingEvent.resulting_state_version})`,
        { step: 2, harvestBatchId }
      );
    }

    const origTransRes = await client.query(
      `SELECT * FROM public.mandi_harvest_lifecycle_transitions
       WHERE harvest_batch_id = $1 AND transition_id = $2 AND resulting_state_version = $3`,
      [harvestBatchId, existingEvent.transition_id, existingEvent.resulting_state_version]
    );
    const tOrig = origTransRes.rows[0] || null;
    if (!tOrig) {
      throw new RecoveryConsistencyError(
        `Step 2 original transition T_orig (${existingEvent.transition_id} @ v${existingEvent.resulting_state_version}) missing`,
        { step: 2, transitionId: existingEvent.transition_id }
      );
    }

    // Step 3: Verify ALL fields of T_orig completely BEFORE inspecting subsequent transitions
    const expectedOrigPrevVer = existingEvent.expected_state_version === null ? 0 : existingEvent.expected_state_version;
    if (
      tOrig.harvest_batch_id !== existingEvent.harvest_batch_id ||
      tOrig.transition_kind !== TRANSITION_KINDS.RECOVERY ||
      tOrig.previous_lifecycle_state !== existingEvent.from_lifecycle_state ||
      tOrig.new_lifecycle_state !== existingEvent.to_lifecycle_state ||
      tOrig.previous_state_version !== expectedOrigPrevVer ||
      tOrig.resulting_state_version !== existingEvent.resulting_state_version ||
      tOrig.transition_event_id !== existingEvent.transition_event_id ||
      tOrig.transition_event_id !== existingEvent.recovery_event_id ||
      tOrig.evidence_checksum !== existingEvent.evidence_checksum ||
      !isPermittedTransition(tOrig.previous_lifecycle_state, tOrig.new_lifecycle_state, tOrig.transition_kind)
    ) {
      throw new RecoveryConsistencyError(
        `Step 3 original transition T_orig contradicts recovery_event_id ${existingEvent.recovery_event_id}`,
        { step: 3, transitionId: tOrig.transition_id }
      );
    }

    // Step 4: Walk & verify every subsequent transition [v_orig + 1 .. parentRow.state_version]
    const subRes = await client.query(
      `SELECT * FROM public.mandi_harvest_lifecycle_transitions
       WHERE harvest_batch_id = $1 AND resulting_state_version > $2
       ORDER BY resulting_state_version ASC`,
      [harvestBatchId, existingEvent.resulting_state_version]
    );
    const laterTransitions = subRes.rows || [];
    let cursor = tOrig;

    for (const step of laterTransitions) {
      if (step.resulting_state_version > parentRow.state_version) {
        throw new RecoveryConsistencyError(
          `Step 4 trailing transition v${step.resulting_state_version} exceeds parent state_version ${parentRow.state_version}`,
          { step: 4 }
        );
      }
      if (
        step.previous_state_version !== cursor.resulting_state_version ||
        step.resulting_state_version !== cursor.resulting_state_version + 1 ||
        step.previous_lifecycle_state !== cursor.new_lifecycle_state ||
        !isPermittedTransition(step.previous_lifecycle_state, step.new_lifecycle_state, step.transition_kind)
      ) {
        throw new RecoveryConsistencyError(
          `Step 4 broken or prohibited transition chain between v${cursor.resulting_state_version} and v${step.resulting_state_version}`,
          { step: 4, fromVersion: cursor.resulting_state_version, toVersion: step.resulting_state_version }
        );
      }

      // Verify canonical transition_id hash integrity when verifying historical steps
      const recomputedTid = computeTransitionId({
        harvestBatchId: step.harvest_batch_id,
        transitionKind: step.transition_kind,
        resultingStateVersion: step.resulting_state_version,
        transitionEventId: step.transition_event_id
      });
      if (step.transition_id !== recomputedTid) {
        throw new RecoveryConsistencyError(
          `Step 4 transition_id canonical mismatch at v${step.resulting_state_version}`,
          { step: 4, version: step.resulting_state_version }
        );
      }
      cursor = step;
    }

    // Step 5: Verify complete chain ends identically at parentRow's actual state and version
    if (
      cursor.resulting_state_version !== parentRow.state_version ||
      cursor.new_lifecycle_state !== parentRow.audit_lifecycle_state
    ) {
      throw new RecoveryConsistencyError(
        `Step 5 verified chain ends at (${cursor.new_lifecycle_state} v${cursor.resulting_state_version}) but parent is (${parentRow.audit_lifecycle_state} v${parentRow.state_version})`,
        { step: 5 }
      );
    }

    return {
      idempotentHit: true,
      chainVerified: true,
      verifiedConsistent: true,
      alreadyApplied: true,
      parentRow: { ...parentRow },
      originalTransition: { ...tOrig }
    };
  }

  /**
   * Public wrapper for historical recovery event replay verification (zero writes; clean rollback).
   */
  async replayHistoricalRecoveryEvent({
    harvestBatchId,
    recoveryMethod,
    fromLifecycleState,
    toLifecycleState,
    expectedStateVersion,
    evidenceChecksum
  }) {
    const recoveryEventId = computeRecoveryEventId({
      harvestBatchId,
      recoveryMethod,
      fromLifecycleState,
      toLifecycleState,
      expectedStateVersion,
      evidenceChecksum
    });

    return this._withTransaction(async (client) => {
      await client.query(`SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1, 0))`, [harvestBatchId]);
      const evtRes = await client.query(
        `SELECT * FROM public.mandi_harvest_recovery_events WHERE recovery_event_id = $1`,
        [recoveryEventId]
      );
      const existingEvent = evtRes.rows[0];
      if (!existingEvent) {
        throw new RecoveryConsistencyError(`Recovery event ${recoveryEventId} not found`, { recoveryEventId });
      }
      return this._verifyHistoricalReplayInTx(client, {
        existingEvent,
        harvestBatchId,
        recoveryMethod,
        fromLifecycleState,
        toLifecycleState,
        expectedStateVersion,
        evidenceChecksum
      });
    });
  }

  /**
   * Persist initial telemetry run (or idempotently validate against existing state via RFC 8785 gateway).
   */
  async saveRun(telemetryRecord, {
    transitionKind = null,
    operationKind = null,
    fromLifecycleState = null,
    expectedStateVersion = null,
    transitionReason = null,
    validationInputs = null,
    recoveryNotes = null
  } = {}) {
    const targetState = telemetryRecord.audit_lifecycle_state;
    const resolvedKind = transitionKind || PERMITTED_INITIAL_TRANSITIONS[targetState] || TRANSITION_KINDS.NORMAL_COLLECTION;
    const resolvedOp = operationKind || (resolvedKind === TRANSITION_KINDS.RECOVERY ? 'ORPHAN_RECONCILIATION' : 'NORMAL_COLLECTION');

    if (
      resolvedKind === TRANSITION_KINDS.RECOVERY &&
      targetState === AUDIT_LIFECYCLE_STATES.COLLECTION_FULLY_CERTIFIED
    ) {
      verifyCertificationEvidenceComplete(telemetryRecord, { validationInputs, validateSixGatesFn: this.validateSixGatesFn });
    }

    const stableEvidence = buildStableEvidencePayload(telemetryRecord);
    const evidenceChecksum = computeEvidenceChecksum(stableEvidence);
    const resultingStateVersion = expectedStateVersion === null ? 1 : expectedStateVersion + 1;

    const transitionEventId = computeTransitionEventId({
      harvestBatchId: telemetryRecord.harvest_batch_id,
      operationKind: resolvedOp,
      fromLifecycleState,
      toLifecycleState: targetState,
      expectedStateVersion,
      evidenceChecksum
    });
    const transitionId = computeTransitionId({
      harvestBatchId: telemetryRecord.harvest_batch_id,
      transitionKind: resolvedKind,
      resultingStateVersion,
      transitionEventId
    });

    return this._withTransaction(async (client) => {
      await client.query(`SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1, 0))`, [
        telemetryRecord.harvest_batch_id
      ]);

      // If RECOVERY event already exists, run complete 5-step replay verifier
      if (resolvedKind === TRANSITION_KINDS.RECOVERY) {
        const evtRes = await client.query(
          `SELECT * FROM public.mandi_harvest_recovery_events WHERE recovery_event_id = $1`,
          [transitionEventId]
        );
        if (evtRes.rows[0]) {
          return this._verifyHistoricalReplayInTx(client, {
            existingEvent: evtRes.rows[0],
            harvestBatchId: telemetryRecord.harvest_batch_id,
            recoveryMethod: resolvedOp,
            fromLifecycleState,
            toLifecycleState: targetState,
            expectedStateVersion,
            evidenceChecksum
          });
        }
      }

      // Check existing transition_event_id (normal or recovery concurrent collision)
      const existingTransRes = await client.query(
        `SELECT * FROM public.mandi_harvest_lifecycle_transitions WHERE transition_event_id = $1`,
        [transitionEventId]
      );
      if (existingTransRes.rows[0]) {
        const ex = existingTransRes.rows[0];
        const expectedPrevVer = expectedStateVersion === null ? 0 : expectedStateVersion;
        if (
          ex.harvest_batch_id !== telemetryRecord.harvest_batch_id ||
          ex.transition_kind !== resolvedKind ||
          ex.previous_lifecycle_state !== fromLifecycleState ||
          ex.new_lifecycle_state !== targetState ||
          ex.previous_state_version !== expectedPrevVer ||
          ex.resulting_state_version !== resultingStateVersion ||
          ex.evidence_checksum !== evidenceChecksum
        ) {
          throw new TransitionIdentityConflictError(
            `ERR_TRANSITION_IDENTITY_CONFLICT: transition_event_id ${transitionEventId} collides with conflicting content`
          );
        }
        return {
          idempotentHit: true,
          alreadyApplied: true,
          transitionId: ex.transition_id,
          transitionEventId: ex.transition_event_id
        };
      }

      // Guard certified / terminal immutability cleanly on stale retries (serialized via held 64-bit advisory xact lock)
      const parentCheck = await client.query(
        `SELECT * FROM public.mandi_harvest_execution_log WHERE harvest_batch_id = $1`,
        [telemetryRecord.harvest_batch_id]
      );
      const existingParent = parentCheck.rows[0];
      if (existingParent && TERMINAL_STATES.has(existingParent.audit_lifecycle_state) && expectedStateVersion === null) {
        return {
          idempotentHit: true,
          terminalPreserved: true,
          audit_lifecycle_state: existingParent.audit_lifecycle_state,
          state_version: existingParent.state_version
        };
      }

      const gatewayRes = await client.query(
        `SELECT * FROM public.fn_mandi_record_lifecycle_transition(
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15
        )`,
        [
          telemetryRecord.harvest_batch_id,
          resolvedKind,
          resolvedOp,
          fromLifecycleState,
          targetState,
          expectedStateVersion,
          resultingStateVersion,
          transitionEventId,
          transitionId,
          evidenceChecksum,
          transitionReason || `${resolvedOp}: ${fromLifecycleState || 'INITIAL'} -> ${targetState}`,
          this.actor,
          JSON.stringify(telemetryRecord),
          resolvedKind === TRANSITION_KINDS.RECOVERY ? JSON.stringify(stableEvidence) : null,
          recoveryNotes
        ]
      );

      return gatewayRes.rows[0] || { outcome: 'APPLIED', harvest_batch_id: telemetryRecord.harvest_batch_id };
    });
  }

  /**
   * Perform Contract A lifecycle promotion or recovery transition atomically via gateway RPC.
   */
  async transitionBatch({
    telemetryRecord,
    transitionKind = TRANSITION_KINDS.NORMAL_COLLECTION,
    operationKind = 'NORMAL_COLLECTION',
    fromLifecycleState,
    toLifecycleState,
    expectedStateVersion,
    transitionReason = null,
    validationInputs = null,
    recoveryNotes = null
  }) {
    assertStrictLifecycleState(fromLifecycleState, 'fromLifecycleState', true);
    assertStrictLifecycleState(toLifecycleState, 'toLifecycleState', false);
    assertStrictExpectedStateVersion(expectedStateVersion);

    if (!isPermittedTransition(fromLifecycleState, toLifecycleState, transitionKind)) {
      throw new AuditContractValidationError(
        `Prohibited lifecycle transition (${transitionKind}: ${fromLifecycleState} -> ${toLifecycleState})`,
        'ERR_PROHIBITED_TRANSITION'
      );
    }

    return this.saveRun(
      { ...telemetryRecord, audit_lifecycle_state: toLifecycleState },
      {
        transitionKind,
        operationKind,
        fromLifecycleState,
        expectedStateVersion,
        transitionReason,
        validationInputs,
        recoveryNotes
      }
    );
  }

  /**
   * Reconstruct post-crash orphan observation commits safely into AUDIT_RECOVERY_REQUIRED
   * without fabricating missing raw metrics or auto-certifying.
   */
  async reconcileOrphanBatch({
    harvestBatchId,
    collectionWindow = 'MANUAL',
    targetObservationDate = null,
    ogdPublicationTimestamp = null,
    recoveryNotes = 'Reconstructed from committed mandi_historical_observations post-crash'
  }) {
    assertNonEmptyBatchId(harvestBatchId);

    const obsStatsRes = await this.db.query(
      `SELECT
         COUNT(*)::integer AS committed_rows,
         COUNT(DISTINCT state)::integer AS distinct_states,
         COUNT(DISTINCT market)::integer AS distinct_markets,
         COUNT(DISTINCT commodity)::integer AS distinct_commodities,
         MIN(observation_date)::text AS observed_date
       FROM public.mandi_historical_observations
       WHERE raw_payload->>'inserted_by_batch_id' = $1
          OR raw_payload->>'updated_by_batch_id' = $1
          OR (
            pg_catalog.jsonb_typeof(raw_payload->'batch_lineage') = 'array'
            AND (raw_payload->'batch_lineage') @> pg_catalog.to_jsonb(ARRAY[$1::text])
          )`,
      [harvestBatchId]
    );
    const stats = obsStatsRes.rows[0] || {};
    const committedRows = Number(stats.committed_rows || 0);
    if (committedRows <= 0) {
      return { reconciled: false, reason: 'NO_COMMITTED_OBSERVATIONS_FOUND', harvestBatchId };
    }

    const telemetry = createBatchTelemetryRecord({
      harvest_batch_id: harvestBatchId,
      collection_window: collectionWindow,
      target_observation_date: targetObservationDate || stats.observed_date || null,
      ogd_publication_timestamp: ogdPublicationTimestamp,
      api_reported_total: null,
      records_fetched: null,
      records_parsed: null,
      records_inserted: null,
      records_updated: null,
      records_skipped: null,
      records_rejected: null,
      duplicate_count: null,
      distinct_states: Number(stats.distinct_states || 0),
      distinct_markets: Number(stats.distinct_markets || 0),
      distinct_commodities: Number(stats.distinct_commodities || 0),
      gates: {},
      final_validation_status: 'AUDIT_RECOVERY_REQUIRED',
      execution_status: 'AUDIT_RECOVERY_REQUIRED',
      observations_committed: true,
      audit_persisted: true,
      fully_certified: false,
      audit_lifecycle_state: AUDIT_LIFECYCLE_STATES.AUDIT_RECOVERY_REQUIRED
    });

    const outcome = await this.transitionBatch({
      telemetryRecord: telemetry,
      transitionKind: TRANSITION_KINDS.RECOVERY,
      operationKind: 'ORPHAN_RECONCILIATION',
      fromLifecycleState: null,
      toLifecycleState: AUDIT_LIFECYCLE_STATES.AUDIT_RECOVERY_REQUIRED,
      expectedStateVersion: null,
      transitionReason: 'Crash orphan reconciliation from committed observation rows',
      recoveryNotes
    });

    return { reconciled: true, harvestBatchId, outcome };
  }

  /**
   * Contract B metadata-only update via gateway RPC (zero transition history inserted).
   */
  async updateBatchMetadata({
    harvestBatchId,
    expectedStateVersion,
    diagnosticNotes = null,
    errorDetails = null
  }) {
    assertNonEmptyBatchId(harvestBatchId);
    assertStrictExpectedStateVersion(expectedStateVersion);
    if (expectedStateVersion === null || expectedStateVersion < 1) {
      throw new AuditContractValidationError('expectedStateVersion must be >= 1 for metadata updates');
    }

    const res = await this.db.query(
      `SELECT * FROM public.fn_mandi_update_batch_metadata($1, $2, $3, $4)`,
      [harvestBatchId, expectedStateVersion, diagnosticNotes, errorDetails]
    );
    return res.rows[0] || null;
  }
}

module.exports = {
  AUDIT_LIFECYCLE_STATES,
  CANONICAL_STATE_RANKS,
  TRANSITION_KINDS,
  RECOVERY_METHODS,
  PERMITTED_INITIAL_TRANSITIONS,
  PERMITTED_UPDATE_TRANSITIONS,
  TERMINAL_STATES,
  AuditContractValidationError,
  RecoveryConsistencyError,
  TransitionIdentityConflictError,
  rfc8785Canonicalize,
  computeEvidenceChecksum,
  computeTransitionEventId,
  computeRecoveryEventId,
  computeTransitionId,
  buildStableEvidencePayload,
  verifyCertificationEvidenceComplete,
  isPermittedTransition,
  formatISTTimestamp,
  createBatchTelemetryRecord,
  AuditTelemetryStore,
  InMemoryAuditStore,
  FailingAuditStore,
  PostgresAuditTelemetryStore
};
