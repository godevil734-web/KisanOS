/**
 * KisanOS Canonical Audit Identity & RFC 8785 (JCS) Hashing Contract (Milestone F.1.4 / F.1.5)
 *
 * Implements RFC 8785 JSON Canonicalization Scheme (JCS) over strict non-coerced types
 * so both Node.js (backend) and Python (ml-engine) produce bit-for-bit identical UTF-8
 * payloads and 64-character lowercase SHA-256 digests.
 */

const crypto = require('crypto');

const AUDIT_LIFECYCLE_STATES = Object.freeze({
  OBSERVATIONS_COMMITTED: 'OBSERVATIONS_COMMITTED',
  AUDIT_PERSIST_FAILED_AFTER_COMMIT: 'AUDIT_PERSIST_FAILED_AFTER_COMMIT',
  REJECTED_AUDIT_FAILED: 'REJECTED_AUDIT_FAILED',
  AUDIT_RECOVERY_REQUIRED: 'AUDIT_RECOVERY_REQUIRED',
  REJECTED_AUDIT_PERSISTED: 'REJECTED_AUDIT_PERSISTED',
  COLLECTION_FULLY_CERTIFIED: 'COLLECTION_FULLY_CERTIFIED',
  // Legacy alias retained strictly for backward F.1.2/F.1.3 unit compatibility
  AUDIT_PERSISTED: 'AUDIT_PERSISTED'
});

const CANONICAL_STATE_RANKS = Object.freeze({
  OBSERVATIONS_COMMITTED: 10,
  AUDIT_PERSIST_FAILED_AFTER_COMMIT: 15,
  REJECTED_AUDIT_FAILED: 15,
  AUDIT_RECOVERY_REQUIRED: 20,
  REJECTED_AUDIT_PERSISTED: 30,
  COLLECTION_FULLY_CERTIFIED: 40
});

const VALID_CANONICAL_STATES = new Set(Object.keys(CANONICAL_STATE_RANKS));
const TRANSITION_KINDS = Object.freeze({
  NORMAL_COLLECTION: 'NORMAL_COLLECTION',
  RECOVERY: 'RECOVERY'
});
const RECOVERY_METHODS = new Set([
  'PAYLOAD_REPLAY',
  'ORPHAN_RECONCILIATION',
  'EVIDENCE_REVERIFICATION'
]);
const VALID_OPERATION_KINDS = new Set([
  'NORMAL_COLLECTION',
  'PAYLOAD_REPLAY',
  'ORPHAN_RECONCILIATION',
  'EVIDENCE_REVERIFICATION'
]);
const SHA256_LOWER_HEX_RE = /^[0-9a-f]{64}$/;

class AuditContractValidationError extends Error {
  constructor(message, code = 'ERR_AUDIT_CONTRACT_VALIDATION') {
    super(message);
    this.name = 'AuditContractValidationError';
    this.code = code;
  }
}

/**
 * Serialize a JS value strictly according to RFC 8785 (JCS):
 * - Primitives serialized per ECMAScript/JSON rules (finite numbers only, Object.is(-0) -> 0)
 * - Arrays preserve index order, normalizing undefined array slots -> JSON null unless caller disallowed
 * - Plain objects sort own enumerable keys recursively by UTF-16 code units, omitting undefined values
 * - Zero insignificant whitespace
 */
function rfc8785Canonicalize(value) {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new AuditContractValidationError('RFC 8785 JCS rejects NaN and Infinity numbers');
    }
    const normalized = Object.is(value, -0) ? 0 : value;
    return JSON.stringify(normalized);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const parts = [];
    for (let i = 0; i < value.length; i++) {
      if (value[i] === undefined) {
        throw new AuditContractValidationError(`Array slot ${i} must not be undefined; pass explicit null or concrete value`);
      }
      parts.push(rfc8785Canonicalize(value[i]));
    }
    return `[${parts.join(',')}]`;
  }
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return JSON.stringify(value.toISOString());
    }
    const keys = Object.keys(value).sort(); // Standard JS UTF-16 code unit comparison per RFC 8785 §3.2.3
    const props = [];
    for (const k of keys) {
      const v = value[k];
      if (v === undefined) continue;
      props.push(`${JSON.stringify(k)}:${rfc8785Canonicalize(v)}`);
    }
    return `{${props.join(',')}}`;
  }
  throw new AuditContractValidationError(`Unsupported type for RFC 8785 canonicalization: ${typeof value}`);
}

function sha256Utf8Hex(canonicalJsonStr) {
  return crypto.createHash('sha256').update(Buffer.from(canonicalJsonStr, 'utf8')).digest('hex');
}

function assertNonEmptyBatchId(harvestBatchId) {
  if (typeof harvestBatchId !== 'string' || harvestBatchId.trim() === '' || harvestBatchId.length > 100) {
    throw new AuditContractValidationError('harvestBatchId must be a non-empty string (1..100 chars)');
  }
}

function assertSha256LowerHex(hexStr, fieldName) {
  if (typeof hexStr !== 'string' || !SHA256_LOWER_HEX_RE.test(hexStr)) {
    throw new AuditContractValidationError(`${fieldName} must be an exact 64-character lowercase SHA-256 hex digest`);
  }
}

function assertStrictLifecycleState(state, fieldName, allowNull = false) {
  if (allowNull && state === null) return;
  if (typeof state !== 'string' || !VALID_CANONICAL_STATES.has(state)) {
    throw new AuditContractValidationError(`${fieldName} invalid lifecycle state: ${String(state)}`);
  }
}

function assertStrictExpectedStateVersion(version) {
  if (version === null) return;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    throw new AuditContractValidationError(
      `expectedStateVersion must be a non-negative safe integer or literal null (got ${typeof version}: ${String(version)})`
    );
  }
}

/**
 * Compute deterministic RFC 8785 SHA-256 checksum over stable evidence payload.
 * Excludes volatile wall-clock metadata by caller contract or explicit sanitization.
 */
function computeEvidenceChecksum(evidencePayload) {
  if (evidencePayload === undefined || evidencePayload === null || typeof evidencePayload !== 'object') {
    throw new AuditContractValidationError('evidencePayload must be a non-null object or array');
  }
  return sha256Utf8Hex(rfc8785Canonicalize(evidencePayload));
}

/**
 * Compute canonical transition_event_id (also equals recovery_event_id for recovery operations)
 * using exact 6-element positional RFC 8785 JCS array.
 */
function computeTransitionEventId({
  harvestBatchId,
  operationKind,
  fromLifecycleState,
  toLifecycleState,
  expectedStateVersion,
  evidenceChecksum
}) {
  assertNonEmptyBatchId(harvestBatchId);
  if (typeof operationKind !== 'string' || !VALID_OPERATION_KINDS.has(operationKind)) {
    throw new AuditContractValidationError(`operationKind must be a valid operation enum (got ${String(operationKind)})`);
  }
  assertStrictLifecycleState(fromLifecycleState, 'fromLifecycleState', true);
  assertStrictLifecycleState(toLifecycleState, 'toLifecycleState', false);
  assertStrictExpectedStateVersion(expectedStateVersion);
  assertSha256LowerHex(evidenceChecksum, 'evidenceChecksum');

  const canonical = rfc8785Canonicalize([
    harvestBatchId,
    operationKind,
    fromLifecycleState,
    toLifecycleState,
    expectedStateVersion,
    evidenceChecksum
  ]);
  return sha256Utf8Hex(canonical);
}

/**
 * Backward-compatible alias emphasizing recovery_event_id === transition_event_id.
 */
function computeRecoveryEventId({
  harvestBatchId,
  recoveryMethod,
  fromLifecycleState,
  toLifecycleState,
  expectedStateVersion,
  evidenceChecksum
}) {
  if (typeof recoveryMethod !== 'string' || !RECOVERY_METHODS.has(recoveryMethod)) {
    throw new AuditContractValidationError(`recoveryMethod must be a valid recovery enum (got ${String(recoveryMethod)})`);
  }
  return computeTransitionEventId({
    harvestBatchId,
    operationKind: recoveryMethod,
    fromLifecycleState,
    toLifecycleState,
    expectedStateVersion,
    evidenceChecksum
  });
}

/**
 * Compute deterministic step primary key transition_id.
 */
function computeTransitionId({
  harvestBatchId,
  transitionKind,
  resultingStateVersion,
  transitionEventId
}) {
  assertNonEmptyBatchId(harvestBatchId);
  if (transitionKind !== TRANSITION_KINDS.NORMAL_COLLECTION && transitionKind !== TRANSITION_KINDS.RECOVERY) {
    throw new AuditContractValidationError(`Invalid transitionKind: ${String(transitionKind)}`);
  }
  if (typeof resultingStateVersion !== 'number' || !Number.isInteger(resultingStateVersion) || resultingStateVersion < 1) {
    throw new AuditContractValidationError(
      `resultingStateVersion must be an integer >= 1 (got ${typeof resultingStateVersion}: ${String(resultingStateVersion)})`
    );
  }
  assertSha256LowerHex(transitionEventId, 'transitionEventId');

  return sha256Utf8Hex(
    rfc8785Canonicalize([
      harvestBatchId,
      transitionKind,
      resultingStateVersion,
      transitionEventId
    ])
  );
}

module.exports = {
  AUDIT_LIFECYCLE_STATES,
  CANONICAL_STATE_RANKS,
  VALID_CANONICAL_STATES,
  TRANSITION_KINDS,
  RECOVERY_METHODS,
  VALID_OPERATION_KINDS,
  SHA256_LOWER_HEX_RE,
  AuditContractValidationError,
  rfc8785Canonicalize,
  sha256Utf8Hex,
  computeEvidenceChecksum,
  computeTransitionEventId,
  computeRecoveryEventId,
  computeTransitionId,
  assertNonEmptyBatchId,
  assertSha256LowerHex,
  assertStrictLifecycleState,
  assertStrictExpectedStateVersion
};

