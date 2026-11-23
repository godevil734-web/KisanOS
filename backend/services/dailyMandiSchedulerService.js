/**
 * KisanOS Daily Mandi Scheduler & Runtime Feature Flag Service (Milestone F.1.3)
 * 
 * Coordinates safe, idempotent, serverless-compatible daily harvest invocations.
 * 
 * Safeguards Enforced:
 * 1. Fail-closed runtime feature flag: MANDI_DAILY_HARVEST_ENABLED defaults to DISABLED
 *    unless explicitly set to 'true' / '1' / 'enabled'. Checked dynamically on every call.
 * 2. When disabled: ZERO HTTP requests and ZERO database queries executed.
 * 3. Provisional IST collection windows: 01:30 IST (probe), 04:00 IST (primary), 06:00 IST (retry).
 * 4. Duplicate-window suppression: Skips bulk CSV downloads if target date & OGD timestamp
 *    were already COLLECTION_FULLY_CERTIFIED by an earlier window.
 * 5. Concurrency lock guard (InMemory / PG Advisory Lock) preventing overlapping executions.
 * 6. Bounded exponential backoff + jitter for transient HTTP 429 / 5xx / timeouts ONLY.
 *    Never retries 4xx client errors or Six-Gate validation rejections.
 */

const https = require('https');
const {
  resolveDataGovApiKey,
  generateHarvestBatchId,
  fetchBulletinMetadata,
  collectValidatedBulletin
} = require('./dailyMandiCollectionService');
const { DATA_GOV_RESOURCE_ID } = require('./historicalIngestionService');
const { InMemoryAuditStore } = require('./auditTelemetryStore');

const HARVEST_ADVISORY_LOCK_KEY = 84729103;

/**
 * Provisional IST collection windows (subject to ongoing telemetry calibration).
 */
const PROVISIONAL_IST_WINDOWS = [
  { name: '01:30_IST', hourIst: 1, minuteIst: 30, role: 'PRELIMINARY_PROBE' },
  { name: '04:00_IST', hourIst: 4, minuteIst: 0, role: 'PRIMARY_COLLECTION' },
  { name: '06:00_IST', hourIst: 6, minuteIst: 0, role: 'FINAL_RETRY' }
];

/**
 * Evaluate runtime feature flag dynamically on every invocation.
 * Strictly fails CLOSED: missing, empty, or non-true values return false.
 */
function isDailyHarvestEnabled(envObj = process.env) {
  if (!envObj || typeof envObj !== 'object') return false;
  const raw = envObj.MANDI_DAILY_HARVEST_ENABLED;
  if (typeof raw !== 'string') return false;
  const norm = raw.trim().toLowerCase();
  return norm === 'true' || norm === '1' || norm === 'enabled';
}

/**
 * Convert a UTC Date into IST components (+05:30).
 */
function getIstDateComponents(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const istMs = d.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(ist.getUTCDate()).padStart(2, '0');
  return {
    istDateStr: `${yyyy}-${mm}-${dd}`,
    hourIst: ist.getUTCHours(),
    minuteIst: ist.getUTCMinutes(),
    totalMinutesIst: ist.getUTCHours() * 60 + ist.getUTCMinutes()
  };
}

/**
 * Resolve which provisional IST window corresponds to a given timestamp.
 * Matches within a configurable tolerance window (default ±45 minutes).
 */
function resolveIstWindow(date = new Date(), {
  windows = PROVISIONAL_IST_WINDOWS,
  toleranceMinutes = 45
} = {}) {
  const { istDateStr, totalMinutesIst } = getIstDateComponents(date);

  let bestMatch = null;
  let smallestDelta = Infinity;

  for (const w of windows) {
    const windowMins = w.hourIst * 60 + w.minuteIst;
    const delta = Math.abs(totalMinutesIst - windowMins);
    if (delta <= toleranceMinutes && delta < smallestDelta) {
      smallestDelta = delta;
      bestMatch = w;
    }
  }

  return {
    matched: Boolean(bestMatch),
    windowName: bestMatch ? bestMatch.name : 'OUTSIDE_SCHEDULE_WINDOW',
    role: bestMatch ? bestMatch.role : 'AD_HOC',
    istDateStr,
    deltaMinutes: bestMatch ? smallestDelta : null
  };
}

/**
 * Lock provider abstractions preventing overlapping collection invocations.
 */
class InMemoryLockProvider {
  constructor() {
    this.locks = new Set();
  }
  async tryAcquire(key = HARVEST_ADVISORY_LOCK_KEY) {
    if (this.locks.has(key)) return false;
    this.locks.add(key);
    return true;
  }
  async release(key = HARVEST_ADVISORY_LOCK_KEY) {
    this.locks.delete(key);
  }
}

class PostgresAdvisoryLockProvider {
  constructor(poolOrClient) {
    if (!poolOrClient) {
      throw new Error('PostgresAdvisoryLockProvider requires a pg Pool or Client instance');
    }
    this.poolOrClient = poolOrClient;
    this.heldClient = null;
    this.isAcquired = false;
    this.acquiredKey = null;
    this.unresolvedLock = false;
  }

  async tryAcquire(key = HARVEST_ADVISORY_LOCK_KEY) {
    // Refuse new acquisitions while a lock is actively held OR remains unresolved after unlock failure
    if (this.heldClient || this.isAcquired || this.unresolvedLock) {
      return false;
    }

    const isPool = typeof this.poolOrClient.connect === 'function';
    const client = isPool ? await this.poolOrClient.connect() : this.poolOrClient;
    let acquireError = null;

    try {
      const res = await client.query('SELECT pg_try_advisory_lock($1::bigint) AS acquired;', [key]);
      const acquired = Boolean(res.rows && res.rows[0] && res.rows[0].acquired);

      if (acquired) {
        // Hold this exact dedicated client for the full protected duration
        this.heldClient = client;
        this.isAcquired = true;
        this.acquiredKey = key;
        this.unresolvedLock = false;
        return true;
      }

      // Lock held by another process: release dedicated pool client immediately
      if (isPool && typeof client.release === 'function') {
        client.release();
      }
      return false;
    } catch (err) {
      acquireError = err;
      if (isPool && typeof client.release === 'function') {
        client.release(acquireError);
      }
      throw err;
    }
  }

  async release(key = HARVEST_ADVISORY_LOCK_KEY) {
    if (!this.heldClient || !this.isAcquired) {
      return false;
    }

    const client = this.heldClient;
    const lockKey = this.acquiredKey !== null ? this.acquiredKey : key;
    const isPool = typeof this.poolOrClient.connect === 'function';

    // Phase 1: Confirm PostgreSQL unlock ONLY (strictly requires rows[0].unlocked === true)
    try {
      const res = await client.query('SELECT pg_advisory_unlock($1::bigint) AS unlocked;', [lockKey]);
      const confirmedUnlocked = Boolean(
        res &&
        Array.isArray(res.rows) &&
        res.rows.length > 0 &&
        res.rows[0] &&
        res.rows[0].unlocked === true
      );

      if (!confirmedUnlocked) {
        throw new Error(
          `PostgreSQL did not confirm advisory unlock for key ${lockKey} (expected rows[0].unlocked === true)`
        );
      }
    } catch (unlockErr) {
      // Unlock failed: preserve unresolved state and prevent future acquisitions
      this.unresolvedLock = true;

      if (isPool) {
        // Pool-owned client: discard broken connection safely via release(err)
        this.heldClient = null;
        if (typeof client.release === 'function') {
          try {
            client.release(unlockErr);
          } catch (_releaseErr) {}
        }
        unlockErr.ownership = 'POOL_OWNED';
        unlockErr.connectionDiscarded = true;
        throw unlockErr;
      } else {
        // Caller-owned client: retain heldClient reference & clearly surface requirement to close/discard broken session
        const callerErr = new Error(
          `PostgreSQL advisory unlock failed on caller-owned client (${unlockErr.message}). ` +
          `Session lock (${lockKey}) may still be held; caller must discard or close this broken PostgreSQL session.`
        );
        callerErr.cause = unlockErr;
        callerErr.ownership = 'CALLER_OWNED';
        callerErr.requiresSessionDiscard = true;
        callerErr.lockKey = lockKey;
        throw callerErr;
      }
    }

    // Unlock confirmed by PostgreSQL: NOW clear lock tracking state
    this.heldClient = null;
    this.isAcquired = false;
    this.acquiredKey = null;
    this.unresolvedLock = false;

    // Phase 2: Pool client-release cleanup separated strictly from PostgreSQL unlock state
    if (isPool && typeof client.release === 'function') {
      try {
        client.release();
      } catch (releaseErr) {
        releaseErr.unlockConfirmed = true;
        throw releaseErr;
      }
    }

    return true;
  }
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientHttpError(err) {
  if (!err || !err.message) return false;
  const msg = err.message.toUpperCase();
  if (msg.includes('HTTP 429')) return true;
  if (msg.includes('HTTP 500') || msg.includes('HTTP 502') || msg.includes('HTTP 503') || msg.includes('HTTP 504')) return true;
  if (msg.includes('TIMED OUT') || msg.includes('TIMEOUT') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT')) return true;
  return false;
}

/**
 * Execute an HTTP operation with bounded exponential backoff, randomized jitter,
 * and strict timeout enforcement. Retries ONLY transient network / 429 / 5xx errors.
 */
async function executeWithBackoff(operationFn, {
  maxRetries = 3,
  baseDelayMs = 1000,
  maxDelayMs = 15000,
  jitterFn = () => Math.floor(Math.random() * 400),
  sleepFn = defaultSleep
} = {}) {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return await operationFn(attempt);
    } catch (err) {
      if (!isTransientHttpError(err) || attempt > maxRetries) {
        err.attemptsMade = attempt;
        throw err;
      }
      const expDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const boundedDelay = Math.min(expDelay + jitterFn(), maxDelayMs);
      await sleepFn(boundedDelay);
    }
  }
}

/**
 * Fetch full daily CSV feed string from data.gov.in with strict AbortController / HTTP timeout.
 */
function defaultFetchCsvStream({
  apiKey = resolveDataGovApiKey(),
  resourceId = DATA_GOV_RESOURCE_ID,
  timeoutMs = 30000
} = {}) {
  if (!apiKey) {
    return Promise.reject(new Error('HTTP 401: DATA_GOV_API_KEY is missing'));
  }

  const url = `https://api.data.gov.in/resource/${resourceId}?api-key=${encodeURIComponent(apiKey)}&format=csv&limit=25000`;

  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode === 429) {
        return reject(new Error('HTTP 429: Rate limit exceeded on CSV stream'));
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`HTTP ${res.statusCode}: Failed to fetch CSV stream`));
      }

      let chunks = [];
      let streamAborted = false;

      res.on('data', (chunk) => chunks.push(chunk));
      res.on('aborted', () => {
        streamAborted = true;
        reject(new Error('CSV response stream aborted before EOF'));
      });
      res.on('end', () => {
        if (!streamAborted) {
          resolve(Buffer.concat(chunks).toString('utf8'));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`CSV stream request timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => reject(err));
  });
}

/**
 * Determine whether an earlier scheduled window has already DURABLY certified
 * this exact IST target cycle and genuine OGD publication timestamp.
 * 
 * Production Requirements:
 * - Must read from durable certified-run history (e.g. future PostgresAuditTelemetryStore).
 * - Must match exact IST target_observation_date AND non-null genuine ogd_publication_timestamp.
 * - Must ignore INCOMPLETE, REJECTED, AUDIT_PERSIST_FAILED, or un-persisted runs.
 * - Missing/unavailable audit history or missing OGD timestamps MUST return null
 *   (never interpreted as proof that an earlier window succeeded).
 */
async function findAlreadyCertifiedRun(auditStore, targetDateStr, currentOgdUpdatedDate) {
  if (!auditStore || (typeof auditStore.findCertifiedRun !== 'function' && typeof auditStore.listRuns !== 'function')) {
    return null;
  }
  if (!targetDateStr || !currentOgdUpdatedDate) {
    // Cannot safely prove same release without both genuine IST date and OGD timestamp
    return null;
  }

  // Prefer unbounded indexed lookup (F.1.4 / F.1.5 PostgresAuditTelemetryStore & upgraded stores)
  if (typeof auditStore.findCertifiedRun === 'function') {
    try {
      const certified = await auditStore.findCertifiedRun({
        targetObservationDate: targetDateStr,
        ogdPublicationTimestamp: currentOgdUpdatedDate
      });
      const certDateStr = certified && certified.target_observation_date instanceof Date
        ? certified.target_observation_date.toISOString().slice(0, 10)
        : (certified ? certified.target_observation_date : null);
      const certOgdMs = certified && certified.ogd_publication_timestamp
        ? Date.parse(certified.ogd_publication_timestamp)
        : NaN;
      const targetOgdMs = Date.parse(currentOgdUpdatedDate);
      const ogdMatches = Number.isFinite(certOgdMs) && Number.isFinite(targetOgdMs)
        ? certOgdMs === targetOgdMs
        : (certified ? certified.ogd_publication_timestamp === currentOgdUpdatedDate : false);

      if (
        certified &&
        certified.fully_certified === true &&
        certified.audit_persisted === true &&
        certified.observations_committed === true &&
        certified.execution_status === 'SUCCESS' &&
        certified.audit_lifecycle_state === 'COLLECTION_FULLY_CERTIFIED' &&
        certDateStr === targetDateStr &&
        ogdMatches
      ) {
        return certified;
      }
      return null;
    } catch (_certifiedLookupErr) {
      return null;
    }
  }

  if (typeof auditStore.listRuns !== 'function') {
    return null;
  }

  let runs = [];
  try {
    runs = await auditStore.listRuns(50);
  } catch (_auditReadErr) {
    // Missing or unreachable audit history must fail-safe to null (never skip blindly)
    return null;
  }

  if (!Array.isArray(runs) || runs.length === 0) {
    return null;
  }

  for (let i = runs.length - 1; i >= 0; i--) {
    const r = runs[i];
    if (
      r.fully_certified === true &&
      r.audit_persisted === true &&
      r.observations_committed === true &&
      r.execution_status === 'SUCCESS' &&
      r.audit_lifecycle_state === 'COLLECTION_FULLY_CERTIFIED' &&
      r.target_observation_date === targetDateStr &&
      r.ogd_publication_timestamp === currentOgdUpdatedDate
    ) {
      return r;
    }
  }
  return null;
}

/**
 * Main Scheduled Daily Harvest Orchestrator.
 * Strictly guarded by runtime feature flag, advisory locking, backoff retries,
 * earlier-window deduplication, and Six-Gate completeness validation.
 */
async function runScheduledHarvestCycle({
  now = new Date(),
  windowName = null,
  env = process.env,
  dbClientOrPool = null,
  auditStore = new InMemoryAuditStore(),
  lockProvider = new InMemoryLockProvider(),
  fetchMetadataFn = null,
  fetchCsvFn = null,
  retryOptions = {},
  timeoutMs = 15000,
  customThresholds = null,
  isHoliday = false
} = {}) {
  // 1. Dynamic Feature Flag Guard (MUST be checked before ANY network or DB I/O)
  if (!isDailyHarvestEnabled(env)) {
    return {
      executed: false,
      status: 'DISABLED_BY_FEATURE_FLAG',
      reason: 'MANDI_DAILY_HARVEST_ENABLED is disabled or unset',
      networkCallsMade: 0,
      dbQueriesMade: 0
    };
  }

  // 2. Resolve Active IST Schedule Window
  const windowInfo = resolveIstWindow(now);
  const resolvedWindow = windowName || windowInfo.windowName;
  const targetDateStr = windowInfo.istDateStr;
  const batchId = generateHarvestBatchId(resolvedWindow, now);

  // 3. Acquire Distributed / Concurrency Lock
  const lockAcquired = await lockProvider.tryAcquire(HARVEST_ADVISORY_LOCK_KEY);
  if (!lockAcquired) {
    return {
      executed: false,
      status: 'SKIPPED_LOCKED_CONCURRENT_RUN',
      batchId,
      windowName: resolvedWindow,
      reason: 'Another harvest execution currently holds the advisory lock'
    };
  }

  let metadataAttempts = 0;
  let csvAttempts = 0;

  try {
    // 4. Fetch OGD Metadata with Bounded Retry & Timeout
    const metaFetcher = fetchMetadataFn || (() => fetchBulletinMetadata({ timeoutMs }));
    const metadata = await executeWithBackoff(async () => {
      metadataAttempts++;
      return await metaFetcher();
    }, retryOptions);

    // 5. Duplicate Window Guard: Skip if earlier window already fully certified this OGD release
    const earlierCertified = await findAlreadyCertifiedRun(
      auditStore,
      targetDateStr,
      metadata.ogdUpdatedDate || null
    );
    if (earlierCertified) {
      return {
        executed: false,
        status: 'SKIPPED_ALREADY_CERTIFIED',
        batchId,
        windowName: resolvedWindow,
        certifiedBatchId: earlierCertified.harvest_batch_id,
        ogdUpdatedDate: metadata.ogdUpdatedDate || null,
        metadataAttempts,
        csvAttempts: 0
      };
    }

    // 6. Stream Full CSV with Bounded Retry & Timeout (transient failures only)
    const csvFetcher = fetchCsvFn || (() => defaultFetchCsvStream({ timeoutMs: timeoutMs * 2 }));
    const csvSource = await executeWithBackoff(async () => {
      csvAttempts++;
      return await csvFetcher();
    }, retryOptions);

    // 7. Execute Six-Gate Validated Collection (Never bypasses validation, never retries invalid bulletins)
    const collectionResult = await collectValidatedBulletin({
      csvSource,
      metadata,
      streamComplete: true,
      windowName: resolvedWindow,
      targetDate: targetDateStr,
      isHoliday,
      dbClientOrPool,
      auditStore,
      customThresholds,
      batchId
    });

    return {
      executed: true,
      status: collectionResult.telemetry.execution_status,
      batchId,
      windowName: resolvedWindow,
      metadataAttempts,
      csvAttempts,
      ...collectionResult
    };
  } catch (err) {
    // Handle terminal transient/timeout or client network errors cleanly without DB mutation
    return {
      executed: true,
      status: 'FETCH_FAILED',
      batchId,
      windowName: resolvedWindow,
      error: err.message,
      metadataAttempts,
      csvAttempts
    };
  } finally {
    try {
      await lockProvider.release(HARVEST_ADVISORY_LOCK_KEY);
    } catch (unlockErr) {
      console.error('[HARVEST SCHEDULER] Advisory lock release warning:', unlockErr.message);
    }
  }
}

module.exports = {
  HARVEST_ADVISORY_LOCK_KEY,
  PROVISIONAL_IST_WINDOWS,
  isDailyHarvestEnabled,
  getIstDateComponents,
  resolveIstWindow,
  InMemoryLockProvider,
  PostgresAdvisoryLockProvider,
  isTransientHttpError,
  executeWithBackoff,
  findAlreadyCertifiedRun,
  runScheduledHarvestCycle
};

