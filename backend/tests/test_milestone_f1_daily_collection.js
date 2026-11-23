/**
 * Milestone F.1.1: Daily Mandi Collection Engine Isolated Test Suite (Zero Supabase Connection)
 * 
 * STRICT ISOLATION GUARANTEE:
 * - Does NOT import ../db or connect to production Supabase.
 * - Executes SQL behavior against a deterministic In-Memory PostgreSQL Table Simulator
 *   enforcing 6-dimension NULLS NOT DISTINCT uniqueness, IS DISTINCT FROM conditional upserts,
 *   JSONB previous_raw_payload snapshots, and overlapping-batch surgical rollback guards.
 * 
 * Tests Covered:
 * 1. Batch ID generation determinism
 * 2. Metadata probe & genuine publication timestamp extraction (no fabrication)
 * 3. Rate limiting (HTTP 429) & timeout error handling
 * 4. CSV header normalization (_x0020_ handling)
 * 5. RFC 4180 multiline parsing & NULL arrival preservation
 * 6. Conditional upsert idempotence (0 DB writes on identical rerun, fetched_at untouched)
 * 7. Business-field change detection + complete original raw_payload preservation
 * 8. Provenance correction handling (source / ogd_updated_date updates when business fields unchanged)
 * 9. Overlapping batch safety:
 *    9a. Batch A inserts -> Batch B updates -> Rollback B (restores A) -> Rollback A (deletes)
 *    9b. Batch 0 exists -> Batch A updates -> Batch B updates -> Rollback B -> verify A's exact state
 *    9c. Out-of-order rollback (Attempt Rollback A while B is latest) -> blocked, B preserved untouched
 *    9d. Repeated rollback idempotence (safe 0-mutation rerun)
 */

const assert = require('assert');
const {
  generateHarvestBatchId,
  fetchBulletinMetadata,
  extractMetadataFromPayload,
  normalizeCsvHeaders,
  parseAndValidateBulletinStream,
  upsertObservationsChunk,
  rollbackHarvestBatch
} = require('../services/dailyMandiCollectionService');

/**
 * Deterministic In-Memory PostgreSQL Simulator for `mandi_historical_observations`.
 * Zero network I/O; zero Supabase interaction.
 */
class InMemoryMandiDatabase {
  constructor() {
    this.rowsByKey = new Map();
    this.clockMs = new Date('2026-11-10T01:00:00.000Z').getTime();
    this.writeOperations = 0;
    this.inTransaction = false;
    this.txId = null;
    this.txCounter = 1000;
    this.txSnapshot = null;
    this.savepoints = new Map();
    this.txLog = [];
    this.poolConnectCount = 0;
    this.poolReleaseCount = 0;
    this.failNextQueryMatching = null;
  }

  _cloneMap(map) {
    const cloned = new Map();
    for (const [k, v] of map.entries()) {
      cloned.set(k, JSON.parse(JSON.stringify(v)));
    }
    return cloned;
  }

  asPool() {
    const self = this;
    return {
      async connect() {
        self.poolConnectCount++;
        return {
          query: (sql, params) => self.query(sql, params),
          release: () => { self.poolReleaseCount++; }
        };
      }
    };
  }

  _nextTimestamp() {
    this.clockMs += 1000;
    return new Date(this.clockMs).toISOString();
  }

  _getCompositeKey(row) {
    return [
      row.state,
      row.district,
      row.market,
      row.commodity,
      row.variety === null || row.variety === undefined ? '__NULL__' : row.variety,
      row.observation_date
    ].join('::');
  }

  _isDistinct(a, b) {
    const normA = a === undefined ? null : a;
    const normB = b === undefined ? null : b;
    if (normA === null && normB === null) return false;
    if (normA === null || normB === null) return true;
    if (typeof normA === 'number' || typeof normB === 'number') {
      return Number(normA) !== Number(normB);
    }
    return normA !== normB;
  }

  getRowById(id) {
    for (const row of this.rowsByKey.values()) {
      if (row.id === id) return JSON.parse(JSON.stringify(row));
    }
    return null;
  }

  getAllRows() {
    return Array.from(this.rowsByKey.values()).map((r) => JSON.parse(JSON.stringify(r)));
  }

  async query(sql, params = []) {
    const trimmed = sql.trim();
    const cleanSql = trimmed.toUpperCase();

    if (this.failNextQueryMatching && trimmed.includes(this.failNextQueryMatching)) {
      this.failNextQueryMatching = null;
      throw new Error('Simulated DB error mid-transaction');
    }

    if (cleanSql.startsWith('SELECT TXID_CURRENT_IF_ASSIGNED')) {
      return { rows: [{ txid: this.inTransaction ? this.txId : null }] };
    }

    if (cleanSql === 'BEGIN' || cleanSql === 'BEGIN;') {
      assert(!this.inTransaction, 'Cannot start BEGIN inside already active transaction');
      this.inTransaction = true;
      this.txId = ++this.txCounter;
      this.txSnapshot = this._cloneMap(this.rowsByKey);
      this.savepoints.clear();
      this.txLog.push('BEGIN');
      return { rows: [] };
    }

    if (cleanSql === 'COMMIT' || cleanSql === 'COMMIT;') {
      assert(this.inTransaction, 'No active transaction to COMMIT');
      this.inTransaction = false;
      this.txId = null;
      this.txSnapshot = null;
      this.savepoints.clear();
      this.txLog.push('COMMIT');
      return { rows: [] };
    }

    if (cleanSql === 'ROLLBACK' || cleanSql === 'ROLLBACK;') {
      assert(this.inTransaction, 'No active transaction to ROLLBACK');
      this.rowsByKey = this._cloneMap(this.txSnapshot);
      this.inTransaction = false;
      this.txId = null;
      this.txSnapshot = null;
      this.savepoints.clear();
      this.txLog.push('ROLLBACK');
      return { rows: [] };
    }

    if (cleanSql.startsWith('SAVEPOINT ')) {
      assert(this.inTransaction, 'SAVEPOINT requires active transaction');
      const spName = trimmed.split(/\s+/)[1].replace(/;$/, '');
      this.savepoints.set(spName, this._cloneMap(this.rowsByKey));
      this.txLog.push(`SAVEPOINT:${spName}`);
      return { rows: [] };
    }

    if (cleanSql.startsWith('RELEASE SAVEPOINT ')) {
      assert(this.inTransaction, 'RELEASE SAVEPOINT requires active transaction');
      const spName = trimmed.split(/\s+/)[2].replace(/;$/, '');
      this.savepoints.delete(spName);
      this.txLog.push(`RELEASE_SAVEPOINT:${spName}`);
      return { rows: [] };
    }

    if (cleanSql.startsWith('ROLLBACK TO SAVEPOINT ')) {
      assert(this.inTransaction, 'ROLLBACK TO SAVEPOINT requires active transaction');
      const spName = trimmed.split(/\s+/)[3].replace(/;$/, '');
      const spMap = this.savepoints.get(spName);
      assert(spMap, `Savepoint ${spName} does not exist`);
      this.rowsByKey = this._cloneMap(spMap);
      this.txLog.push(`ROLLBACK_TO_SAVEPOINT:${spName}`);
      return { rows: [] };
    }

    if (sql.includes('FOR UPDATE')) {
      return { rows: [] };
    }

    // 1. Handle conditional upsert
    if (sql.includes('INSERT INTO mandi_historical_observations')) {
      // Verify required SQL safeguards exist in the query string
      assert(sql.includes("'previous_raw_payload', mandi_historical_observations.raw_payload"), 'SQL must save complete previous_raw_payload');
      assert(sql.includes("mandi_historical_observations.source IS DISTINCT FROM EXCLUDED.source"), 'SQL must detect genuine source provenance changes');
      assert(sql.includes("ogd_updated_date"), 'SQL must detect genuine ogd_updated_date changes');
      assert(!sql.includes('mandi_historical_observations.fetched_at IS DISTINCT FROM'), 'SQL must exclude fetched_at from IS DISTINCT FROM');

      const incoming = {
        id: params[0],
        state: params[1],
        district: params[2],
        market: params[3],
        commodity: params[4],
        variety: params[5],
        grade: params[6],
        observation_date: params[7],
        min_price_per_quintal: params[8],
        max_price_per_quintal: params[9],
        modal_price_per_quintal: params[10],
        modal_price_per_kg: params[11],
        raw_arrivals_value: params[12],
        raw_arrivals_unit: params[13],
        arrival_quantity_tonnes: params[14],
        source: params[15],
        raw_payload: JSON.parse(params[16])
      };
      const batchId = params[17];
      const key = this._getCompositeKey(incoming);
      const existing = this.rowsByKey.get(key);

      if (!existing) {
        const now = this._nextTimestamp();
        this.rowsByKey.set(key, {
          ...incoming,
          fetched_at: now,
          created_at: now
        });
        this.writeOperations++;
        return { rows: [{ id: incoming.id, is_insert: true }] };
      }

      // Check 8 business fields + 2 genuine provenance fields ONLY
      const businessChanged =
        this._isDistinct(existing.modal_price_per_quintal, incoming.modal_price_per_quintal) ||
        this._isDistinct(existing.min_price_per_quintal, incoming.min_price_per_quintal) ||
        this._isDistinct(existing.max_price_per_quintal, incoming.max_price_per_quintal) ||
        this._isDistinct(existing.modal_price_per_kg, incoming.modal_price_per_kg) ||
        this._isDistinct(existing.arrival_quantity_tonnes, incoming.arrival_quantity_tonnes) ||
        this._isDistinct(existing.raw_arrivals_value, incoming.raw_arrivals_value) ||
        this._isDistinct(existing.raw_arrivals_unit, incoming.raw_arrivals_unit) ||
        this._isDistinct(existing.grade, incoming.grade);

      const provenanceChanged =
        this._isDistinct(existing.source, incoming.source) ||
        this._isDistinct(
          existing.raw_payload?.ogd_updated_date ?? null,
          incoming.raw_payload?.ogd_updated_date ?? null
        );

      if (!businessChanged && !provenanceChanged) {
        // Identical observation: 0 DB writes
        return { rows: [] };
      }

      // Build complete previous_state snapshot before updating
      const previousState = {
        modal_price_per_quintal: existing.modal_price_per_quintal,
        min_price_per_quintal: existing.min_price_per_quintal,
        max_price_per_quintal: existing.max_price_per_quintal,
        modal_price_per_kg: existing.modal_price_per_kg,
        raw_arrivals_value: existing.raw_arrivals_value,
        raw_arrivals_unit: existing.raw_arrivals_unit,
        arrival_quantity_tonnes: existing.arrival_quantity_tonnes,
        grade: existing.grade,
        source: existing.source,
        previous_fetched_at: existing.fetched_at,
        previous_raw_payload: JSON.parse(JSON.stringify(existing.raw_payload))
      };

      const preservedInsertedBy = existing.raw_payload?.inserted_by_batch_id ?? null;
      const prevLineage = Array.isArray(existing.raw_payload?.batch_lineage)
        ? existing.raw_payload.batch_lineage
        : [];

      const updatedPayload = {
        ...JSON.parse(JSON.stringify(incoming.raw_payload)),
        inserted_by_batch_id: preservedInsertedBy,
        updated_by_batch_id: batchId,
        batch_lineage: [...prevLineage, batchId],
        previous_state: previousState
      };

      this.rowsByKey.set(key, {
        ...existing,
        modal_price_per_quintal: incoming.modal_price_per_quintal,
        min_price_per_quintal: incoming.min_price_per_quintal,
        max_price_per_quintal: incoming.max_price_per_quintal,
        modal_price_per_kg: incoming.modal_price_per_kg,
        raw_arrivals_value: incoming.raw_arrivals_value,
        raw_arrivals_unit: incoming.raw_arrivals_unit,
        arrival_quantity_tonnes: incoming.arrival_quantity_tonnes,
        grade: incoming.grade,
        source: incoming.source,
        raw_payload: updatedPayload,
        fetched_at: this._nextTimestamp()
      });
      this.writeOperations++;
      return { rows: [{ id: existing.id, is_insert: false }] };
    }

    // 2. Handle rollback blockedCheckSql
    if (sql.includes('AS blocked_count')) {
      const targetBatch = params[0];
      let blockedCount = 0;
      for (const row of this.rowsByKey.values()) {
        const rp = row.raw_payload || {};
        const touchedByTarget =
          rp.inserted_by_batch_id === targetBatch ||
          (Array.isArray(rp.batch_lineage) && rp.batch_lineage.includes(targetBatch));
        if (touchedByTarget && rp.updated_by_batch_id && rp.updated_by_batch_id !== targetBatch) {
          blockedCount++;
        }
      }
      return { rows: [{ blocked_count: String(blockedCount) }] };
    }

    // 3. Handle rollback deleteSql
    if (sql.includes('DELETE FROM mandi_historical_observations')) {
      const targetBatch = params[0];
      const deletedIds = [];
      for (const [key, row] of this.rowsByKey.entries()) {
        const rp = row.raw_payload || {};
        if (
          rp.inserted_by_batch_id === targetBatch &&
          !rp.updated_by_batch_id &&
          !rp.previous_state
        ) {
          this.rowsByKey.delete(key);
          deletedIds.push({ id: row.id });
          this.writeOperations++;
        }
      }
      return { rows: deletedIds };
    }

    // 4. Handle rollback restoreSql
    if (sql.includes('UPDATE mandi_historical_observations')) {
      const targetBatch = params[0];
      const restoredIds = [];
      for (const [key, row] of this.rowsByKey.entries()) {
        const rp = row.raw_payload || {};
        if (rp.updated_by_batch_id === targetBatch && rp.previous_state?.previous_raw_payload) {
          const prev = rp.previous_state;
          this.rowsByKey.set(key, {
            ...row,
            modal_price_per_quintal: prev.modal_price_per_quintal,
            min_price_per_quintal: prev.min_price_per_quintal,
            max_price_per_quintal: prev.max_price_per_quintal,
            modal_price_per_kg: prev.modal_price_per_kg,
            raw_arrivals_value: prev.raw_arrivals_value,
            raw_arrivals_unit: prev.raw_arrivals_unit,
            arrival_quantity_tonnes: prev.arrival_quantity_tonnes,
            grade: prev.grade,
            source: prev.source || row.source,
            fetched_at: prev.previous_fetched_at,
            raw_payload: JSON.parse(JSON.stringify(prev.previous_raw_payload))
          });
          restoredIds.push({ id: row.id });
          this.writeOperations++;
        }
      }
      return { rows: restoredIds };
    }

    throw new Error(`Unsupported SQL query in isolated mock DB: ${sql.slice(0, 80)}`);
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

function makeRecord(overrides = {}) {
  return {
    id: overrides.id || 'obs_001',
    state: overrides.state || 'Uttar Pradesh',
    district: overrides.district || 'Agra',
    market: overrides.market || 'Agra APMC',
    commodity: overrides.commodity || 'Potato',
    variety: overrides.variety || 'Desi',
    grade: overrides.grade !== undefined ? overrides.grade : 'FAQ',
    observation_date: overrides.observation_date || '2026-11-10',
    min_price_per_quintal: overrides.min_price_per_quintal ?? 1400,
    max_price_per_quintal: overrides.max_price_per_quintal ?? 1600,
    modal_price_per_quintal: overrides.modal_price_per_quintal ?? 1500,
    modal_price_per_kg: overrides.modal_price_per_kg ?? 15.0,
    raw_arrivals_value: overrides.raw_arrivals_value ?? null,
    raw_arrivals_unit: overrides.raw_arrivals_unit ?? null,
    arrival_quantity_tonnes: overrides.arrival_quantity_tonnes ?? null,
    source: overrides.source || 'ogd:agmarknet-daily:9ef84268-d588-465a-a308-a864a43d0070',
    raw_payload: overrides.raw_payload || {
      ogd_updated_date: '2026-11-10T01:30:00.000Z',
      raw_tag: 'initial'
    }
  };
}

async function runMilestoneF1Tests() {
  console.log('================================================================');
  console.log('🌾 KisanOS 2.0: Milestone F.1.1 Hardened Collection Tests');
  console.log('   Environment: 100% Isolated In-Memory PG Simulator (NO Supabase I/O)');
  console.log('================================================================\n');

  // 1. Batch ID determinism
  runTest('1. Batch ID generation creates unique, deterministic identifiers', () => {
    const fixedDate = new Date('2026-11-10T04:00:00.000Z');
    const batchId = generateHarvestBatchId('04:00_IST', fixedDate);
    assert.strictEqual(batchId, 'harvest_20261110_040000_04_00_IST');
  });

  // 2. Metadata timestamp extraction (never fabricates)
  runTest('2. Metadata parser extracts genuine updated_date and never fabricates missing dates', () => {
    const withDate = extractMetadataFromPayload({ updated_date: '2026-11-09T22:00:40Z', total: 7011 });
    assert.strictEqual(withDate.ogdUpdatedDate, '2026-11-09T22:00:40.000Z');

    const withoutDate = extractMetadataFromPayload({ total: 5400 });
    assert.strictEqual(withoutDate.ogdUpdatedDate, null);
  });

  // 3. Mock metadata HTTP 429 & timeout
  await runAsyncTest('3. Metadata probe handles HTTP 429 and timeouts with explicit errors', async () => {
    await assert.rejects(
      async () => fetchBulletinMetadata({ fetchFn: async () => { throw new Error('HTTP 429: Rate limit'); } }),
      /HTTP 429/
    );
    await assert.rejects(
      async () => fetchBulletinMetadata({ fetchFn: async () => { throw new Error('Timed out'); } }),
      /Timed out/
    );
  });

  // 4. Header normalization
  runTest('4. Header normalizer handles spaces, dashes, and XML-escaped spaces (_x0020_)', () => {
    const normalized = normalizeCsvHeaders(['State', 'Modal_x0020_Price', 'Min_x0020_Price']);
    assert.deepStrictEqual(normalized, ['state', 'modal_price', 'min_price']);
  });

  // 5. Streaming RFC 4180 parser
  await runAsyncTest('5. Streaming CSV parser parses multiline quotes and preserves NULL arrivals', async () => {
    const csv = [
      'State,District,Market,Commodity,Variety,Grade,Arrival_Date,Min_x0020_Price,Max_x0020_Price,Modal_x0020_Price',
      '"Uttar Pradesh","Agra","Agra APMC",Potato,"Desi",FAQ,10/11/2026,1400,1600,1500',
      '"Madhya Pradesh","Indore","Indore APMC","Soybean\nYellow",Yellow,FAQ,10/11/2026,4100,4500,4300'
    ].join('\n');

    const parsed = await parseAndValidateBulletinStream(csv, {
      batchId: 'harvest_test_01',
      ogdUpdatedDate: '2026-11-10T01:30:00.000Z'
    });
    assert.strictEqual(parsed.validRecords.length, 2);
    assert.strictEqual(parsed.validRecords[0].arrival_quantity_tonnes, null);
    assert.strictEqual(parsed.validRecords[1].commodity, 'Soybean Yellow');
  });

  // 6. Conditional Upsert Idempotence (zero DB writes on identical rerun)
  await runAsyncTest('6. Conditional upsert causes 0 DB writes and leaves fetched_at untouched on identical rerun', async () => {
    const db = new InMemoryMandiDatabase();
    const rec = makeRecord({ id: 'rec_idempotent' });

    const res1 = await upsertObservationsChunk(db, [rec], 'batch_run_1');
    assert.deepStrictEqual(res1, { imported: 1, updated: 0, skipped: 0 });
    const rowAfter1 = db.getRowById('rec_idempotent');
    const writesAfter1 = db.writeOperations;

    // Rerun identical business & provenance data under a different batch ID (e.g. next window)
    const res2 = await upsertObservationsChunk(db, [makeRecord({ id: 'rec_idempotent' })], 'batch_run_2');
    assert.deepStrictEqual(res2, { imported: 0, updated: 0, skipped: 1 });
    assert.strictEqual(db.writeOperations, writesAfter1, 'Zero DB write operations on identical rerun');
    assert.strictEqual(db.getRowById('rec_idempotent').fetched_at, rowAfter1.fetched_at, 'fetched_at must stay unchanged');
  });

  // 7. Complete raw_payload & provenance correction handling
  await runAsyncTest('7. Provenance corrections (source or ogd_updated_date) update cleanly while preserving complete original raw_payload', async () => {
    const db = new InMemoryMandiDatabase();
    const recInitial = makeRecord({
      id: 'rec_prov',
      source: 'ogd:provisional-feed',
      raw_payload: {
        ogd_updated_date: '2026-11-10T01:30:00.000Z',
        custom_vendor_note: 'provisional_v1'
      }
    });

    await upsertObservationsChunk(db, [recInitial], 'batch_prov_1');
    const state1 = db.getRowById('rec_prov');

    // Genuine provenance correction (source tag upgraded, business prices identical)
    const recCorrectedSource = makeRecord({
      id: 'rec_prov',
      source: 'ogd:agmarknet-daily:9ef84268-d588-465a-a308-a864a43d0070',
      raw_payload: {
        ogd_updated_date: '2026-11-10T01:30:00.000Z',
        custom_vendor_note: 'canonical_v2'
      }
    });
    const upRes1 = await upsertObservationsChunk(db, [recCorrectedSource], 'batch_prov_2');
    assert.deepStrictEqual(upRes1, { imported: 0, updated: 1, skipped: 0 });

    const state2 = db.getRowById('rec_prov');
    assert.strictEqual(state2.source, 'ogd:agmarknet-daily:9ef84268-d588-465a-a308-a864a43d0070');
    assert.strictEqual(state2.raw_payload.inserted_by_batch_id, 'batch_prov_1', 'Original creator preserved');
    assert.strictEqual(state2.raw_payload.updated_by_batch_id, 'batch_prov_2');
    assert.deepStrictEqual(state2.raw_payload.previous_state.previous_raw_payload, state1.raw_payload);

    // Genuine ogd_updated_date correction (business prices & source identical)
    const recCorrectedTime = makeRecord({
      id: 'rec_prov',
      source: 'ogd:agmarknet-daily:9ef84268-d588-465a-a308-a864a43d0070',
      raw_payload: {
        ogd_updated_date: '2026-11-10T03:45:00.000Z',
        custom_vendor_note: 'canonical_v3'
      }
    });
    const upRes2 = await upsertObservationsChunk(db, [recCorrectedTime], 'batch_prov_3');
    assert.deepStrictEqual(upRes2, { imported: 0, updated: 1, skipped: 0 });
    assert.strictEqual(db.getRowById('rec_prov').raw_payload.ogd_updated_date, '2026-11-10T03:45:00.000Z');
  });

  // 8. Overlapping Batch Safety: A inserts -> B updates -> rollback B -> rollback A
  await runAsyncTest('8. Overlapping batches: A inserts -> B updates -> rollback B restores complete A raw_payload -> rollback A deletes', async () => {
    const db = new InMemoryMandiDatabase();

    // Batch A inserts
    const recA = makeRecord({
      id: 'rec_overlap_1',
      modal_price_per_quintal: 1500,
      raw_payload: { ogd_updated_date: '2026-11-10T01:30:00Z', origin_field: 'alpha' }
    });
    await upsertObservationsChunk(db, [recA], 'batch_A');
    const snapshotAfterA = db.getRowById('rec_overlap_1');

    // Batch B updates
    const recB = makeRecord({
      id: 'rec_overlap_1',
      modal_price_per_quintal: 1750,
      modal_price_per_kg: 17.5,
      raw_payload: { ogd_updated_date: '2026-11-10T04:00:00Z', updated_field: 'beta' }
    });
    await upsertObservationsChunk(db, [recB], 'batch_B');

    // Rollback B
    const rbB = await rollbackHarvestBatch(db, 'batch_B');
    assert.strictEqual(rbB.deletedNewRows, 0);
    assert.strictEqual(rbB.restoredUpdatedRows, 1);
    assert.strictEqual(rbB.blockedByLaterBatch, 0);

    const rowAfterRollbackB = db.getRowById('rec_overlap_1');
    assert.strictEqual(rowAfterRollbackB.modal_price_per_quintal, 1500);
    assert.strictEqual(rowAfterRollbackB.fetched_at, snapshotAfterA.fetched_at);
    assert.deepStrictEqual(rowAfterRollbackB.raw_payload, snapshotAfterA.raw_payload, 'Must restore bit-for-bit identical Batch A raw_payload');

    // Rollback A
    const rbA = await rollbackHarvestBatch(db, 'batch_A');
    assert.strictEqual(rbA.deletedNewRows, 1);
    assert.strictEqual(rbA.restoredUpdatedRows, 0);
    assert.strictEqual(rbA.blockedByLaterBatch, 0);
    assert.strictEqual(db.getRowById('rec_overlap_1'), null, 'Row newly created by A is now deleted');
  });

  // 9. Overlapping Batch Safety: Batch 0 exists -> A updates -> B updates -> rollback B -> verify A's exact state
  await runAsyncTest('9. Sequential updates: Batch 0 -> A updates -> B updates -> rollback B preserves A state & lineage', async () => {
    const db = new InMemoryMandiDatabase();

    await upsertObservationsChunk(db, [makeRecord({ id: 'rec_seq', modal_price_per_quintal: 1000 })], 'batch_0');
    await upsertObservationsChunk(db, [makeRecord({ id: 'rec_seq', modal_price_per_quintal: 1100 })], 'batch_A');
    const snapshotAfterA = db.getRowById('rec_seq');

    await upsertObservationsChunk(db, [makeRecord({ id: 'rec_seq', modal_price_per_quintal: 1200 })], 'batch_B');

    // Rollback B
    const rbB = await rollbackHarvestBatch(db, 'batch_B');
    assert.strictEqual(rbB.restoredUpdatedRows, 1);

    const rowAfterRollbackB = db.getRowById('rec_seq');
    assert.strictEqual(rowAfterRollbackB.modal_price_per_quintal, 1100);
    assert.strictEqual(rowAfterRollbackB.raw_payload.updated_by_batch_id, 'batch_A');
    assert.deepStrictEqual(rowAfterRollbackB.raw_payload.batch_lineage, ['batch_0', 'batch_A']);
    assert.deepStrictEqual(rowAfterRollbackB.raw_payload, snapshotAfterA.raw_payload);
  });

  // 10. Out-of-order rollback protection & repeated rollback idempotence
  await runAsyncTest('10. Out-of-order rollback never overwrites later batch B; repeated rollback is safe & idempotent', async () => {
    const db = new InMemoryMandiDatabase();

    await upsertObservationsChunk(db, [makeRecord({ id: 'rec_guard', modal_price_per_quintal: 1000 })], 'batch_A');
    await upsertObservationsChunk(db, [makeRecord({ id: 'rec_guard', modal_price_per_quintal: 1250 })], 'batch_B');
    const snapshotB = db.getRowById('rec_guard');

    // Attempt rollback A while B holds latest revision
    const rbA_early = await rollbackHarvestBatch(db, 'batch_A');
    assert.strictEqual(rbA_early.deletedNewRows, 0, 'Must NOT delete row modified by later batch B');
    assert.strictEqual(rbA_early.restoredUpdatedRows, 0, 'Must NOT overwrite later batch B');
    assert.strictEqual(rbA_early.blockedByLaterBatch, 1, 'Reports blocked status clearly');
    assert.deepStrictEqual(db.getRowById('rec_guard'), snapshotB, 'Batch B data completely intact');

    // Proper rollback of B followed by repeated rollback of B
    const rbB_1 = await rollbackHarvestBatch(db, 'batch_B');
    assert.strictEqual(rbB_1.restoredUpdatedRows, 1);

    const writesBeforeRepeat = db.writeOperations;
    const rbB_2 = await rollbackHarvestBatch(db, 'batch_B');
    assert.strictEqual(rbB_2.deletedNewRows, 0);
    assert.strictEqual(rbB_2.restoredUpdatedRows, 0);
    assert.strictEqual(rbB_2.blockedByLaterBatch, 0);
    assert.strictEqual(db.writeOperations, writesBeforeRepeat, 'Repeated rollback performs zero writes');
  });

  // 11. Transaction Ownership: Pool input acquires dedicated client, owns BEGIN/COMMIT, and releases
  await runAsyncTest('11. Rollback using Pool acquires connection, owns BEGIN/COMMIT, and releases client', async () => {
    const db = new InMemoryMandiDatabase();
    await upsertObservationsChunk(db, [makeRecord({ id: 'rec_pool_tx' })], 'batch_pool_1');
    const poolProxy = db.asPool();

    const rb = await rollbackHarvestBatch(poolProxy, 'batch_pool_1');
    assert.strictEqual(rb.transactionMode, 'POOL_OWNED_TX');
    assert.strictEqual(rb.deletedNewRows, 1);
    assert.strictEqual(db.poolConnectCount, 1);
    assert.strictEqual(db.poolReleaseCount, 1);
    assert.strictEqual(db.inTransaction, false, 'Transaction cleanly committed');
    assert.deepStrictEqual(db.txLog.slice(-2), ['BEGIN', 'COMMIT']);
  });

  // 12. Transaction Ownership: Client with NO active transaction auto-detects and owns BEGIN/COMMIT
  await runAsyncTest('12. Rollback using standalone Client (no active tx) auto-detects and owns BEGIN/COMMIT', async () => {
    const db = new InMemoryMandiDatabase();
    await upsertObservationsChunk(db, [makeRecord({ id: 'rec_client_tx' })], 'batch_client_1');

    const rb = await rollbackHarvestBatch(db, 'batch_client_1');
    assert.strictEqual(rb.transactionMode, 'CLIENT_OWNED_TX');
    assert.strictEqual(rb.deletedNewRows, 1);
    assert.strictEqual(db.inTransaction, false);
    assert.deepStrictEqual(db.txLog.slice(-2), ['BEGIN', 'COMMIT']);
  });

  // 13. Transaction Ownership: Rollback inside existing caller-owned transaction uses SAVEPOINT and never commits outer tx
  await runAsyncTest('13. Rollback inside active caller transaction uses SAVEPOINT and preserves caller tx control', async () => {
    const db = new InMemoryMandiDatabase();
    await upsertObservationsChunk(db, [makeRecord({ id: 'rec_sp_tx' })], 'batch_sp_1');

    await db.query('BEGIN');
    const rb = await rollbackHarvestBatch(db, 'batch_sp_1');
    assert.strictEqual(rb.transactionMode, 'CALLER_SAVEPOINT');
    assert.strictEqual(rb.deletedNewRows, 1);
    assert.strictEqual(db.inTransaction, true, 'Caller transaction MUST remain open (never committed by helper)');
    assert(db.txLog.includes('SAVEPOINT:sp_rollback_harvest_batch'));
    assert(db.txLog.includes('RELEASE_SAVEPOINT:sp_rollback_harvest_batch'));
    assert(!db.txLog.includes('COMMIT'), 'Helper must NEVER commit caller-owned transaction');
    await db.query('COMMIT');
  });

  // 14. Transaction Ownership: Failure mid-rollback cleans up transaction state properly
  await runAsyncTest('14. Rollback error triggers ROLLBACK (for pool/client) or ROLLBACK TO SAVEPOINT (inside caller tx)', async () => {
    // 14a: Pool failure rolls back completely and releases connection
    const dbPool = new InMemoryMandiDatabase();
    await upsertObservationsChunk(dbPool, [makeRecord({ id: 'rec_fail_pool' })], 'batch_fail_1');
    dbPool.failNextQueryMatching = 'DELETE FROM mandi_historical_observations';

    await assert.rejects(
      async () => rollbackHarvestBatch(dbPool.asPool(), 'batch_fail_1'),
      /Simulated DB error/
    );
    assert.strictEqual(dbPool.poolReleaseCount, 1, 'Pool client MUST be released on failure');
    assert.strictEqual(dbPool.inTransaction, false, 'Transaction cleanly rolled back');
    assert.ok(dbPool.getRowById('rec_fail_pool'), 'Row remains intact after failed rollback');

    // 14b: Savepoint failure inside caller transaction restores savepoint without breaking outer work
    const dbCaller = new InMemoryMandiDatabase();
    await upsertObservationsChunk(dbCaller, [makeRecord({ id: 'rec_unrelated_outer', market: 'Outer APMC', modal_price_per_quintal: 2000 })], 'batch_outer');
    await dbCaller.query('BEGIN');
    await upsertObservationsChunk(dbCaller, [makeRecord({ id: 'rec_caller_work', market: 'Caller APMC', modal_price_per_quintal: 3000 })], 'batch_caller_tx');
    dbCaller.failNextQueryMatching = 'DELETE FROM mandi_historical_observations';

    await assert.rejects(
      async () => rollbackHarvestBatch(dbCaller, 'batch_outer'),
      /Simulated DB error/
    );
    assert.strictEqual(dbCaller.inTransaction, true, 'Outer caller transaction stays alive');
    assert(dbCaller.txLog.includes('ROLLBACK_TO_SAVEPOINT:sp_rollback_harvest_batch'));
    assert.ok(dbCaller.getRowById('rec_caller_work'), 'Unrelated caller work in outer tx preserved cleanly');
    await dbCaller.query('COMMIT');
  });

  // 15. Ensure rollback does not commit unrelated caller changes when caller chooses to ROLLBACK
  await runAsyncTest('15. Rollback inside caller tx allows caller to ROLLBACK both unrelated work and batch rollback', async () => {
    const db = new InMemoryMandiDatabase();
    await upsertObservationsChunk(db, [makeRecord({ id: 'rec_batch_target', market: 'Target APMC' })], 'batch_rollback_me');

    await db.query('BEGIN');
    // Unrelated caller change in the same tx
    await upsertObservationsChunk(db, [makeRecord({ id: 'rec_unrelated_new', market: 'Unrelated APMC', modal_price_per_quintal: 5000 })], 'batch_unrelated');
    // Run surgical rollback inside caller's tx
    await rollbackHarvestBatch(db, 'batch_rollback_me');
    assert.strictEqual(db.getRowById('rec_batch_target'), null, 'Tentatively deleted inside open tx');
    assert.ok(db.getRowById('rec_unrelated_new'), 'Unrelated row tentatively inserted inside open tx');

    // Now caller decides to abort the entire outer transaction
    await db.query('ROLLBACK');
    assert.strictEqual(db.inTransaction, false);
    assert.ok(db.getRowById('rec_batch_target'), 'Batch target restored because outer tx rolled back');
    assert.strictEqual(db.getRowById('rec_unrelated_new'), null, 'Unrelated row never committed and cleanly rolled back');
  });

  console.log('\n================================================================');
  console.log(`Milestone F.1.1 Hardened Scoreboard: ${passedTests}/${totalTests} tests passed.`);
  console.log('================================================================');
  assert.strictEqual(passedTests, totalTests);
}

runMilestoneF1Tests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
