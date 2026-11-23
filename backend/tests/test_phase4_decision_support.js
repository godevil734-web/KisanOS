/**
 * Test Suite: Phase 4 Decision Support & Market Intelligence
 * KisanOS 2.0
 */

const assert = require('assert');
const http = require('http');
const { pool } = require('../db');
const { 
  getMandiModalBenchmark, 
  calculateFarmer3WayComparison, 
  calculateNetRealization, 
  calculateStorageScenario 
} = require('../services/netRealizationService');

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5001,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers
      }
    }, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const json = raw ? JSON.parse(raw) : null;
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: raw });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runPhase4Tests() {
  console.log('====================================================================');
  console.log('KISANOS PHASE 4 DECISION SUPPORT & MARKET INTELLIGENCE TEST SUITE');
  console.log('====================================================================\n');

  let passed = 0;
  let failed = 0;

  // TEST 1: Live APMC Modal Benchmark Retrieval from PostgreSQL snapshots
  try {
    const benchmark = await getMandiModalBenchmark({
      cropName: 'Potato',
      state: 'Uttar Pradesh',
      district: 'Agra'
    });

    assert(benchmark.available === true, 'Mandi benchmark should be available');
    assert(benchmark.modalPricePerKg > 0, 'Modal price per kg should be greater than 0');
    assert(benchmark.mandiDeductions.totalMandiDeductionsPerKg > 0, 'Mandi deductions must be calculated');
    assert(benchmark.netMandiRealizationPerKg < benchmark.modalPricePerKg, 'Net mandi realization must be less than gross modal price');
    assert(benchmark.market, 'Market name must be present');

    console.log(`✅ [PASS] 1. Mandi Benchmark: Retrieved ${benchmark.commodity} from ${benchmark.market} (Modal: ₹${benchmark.modalPricePerKg}/kg, Net APMC: ₹${benchmark.netMandiRealizationPerKg}/kg)`);
    passed++;
  } catch (err) {
    console.error('❌ [FAIL] 1. Mandi Benchmark retrieval failed:', err.message);
    failed++;
  }

  // TEST 2: 3-Way Comparative Decision Engine Math
  try {
    const comparison = await calculateFarmer3WayComparison({
      buyerPricePerKg: 20.0,
      cropName: 'Potato',
      state: 'Uttar Pradesh',
      district: 'Agra',
      distanceKm: 25,
      buyerPicksUp: true,
      coldStorageId: 'cs-401',
      quantityKg: 2000
    });

    assert(comparison.options.direct.grossPricePerKg === 20.0, 'Direct price must equal buyer offer');
    assert(comparison.options.direct.netRealizationPerKg === 19.7, 'Direct net must deduct loading and platform fee');
    assert(comparison.options.mandiSpot.available === true, 'Mandi spot option must be active');
    assert(comparison.options.mandiSpot.spreadVsDirectPerKg !== undefined, 'Spread vs direct must be computed');
    assert(comparison.options.coldStorage.monthlyChargePerKg === 0.45, 'Should pull ₹0.45/kg/mo from cold_storages cs-401');
    assert(comparison.synthesis.bestOption, 'Synthesis must indicate best option');

    console.log(`✅ [PASS] 2. Decision Engine Math: Direct ₹${comparison.options.direct.netRealizationPerKg}/kg vs Mandi ₹${comparison.options.mandiSpot.netRealizationPerKg}/kg vs Cold Store ₹${comparison.options.coldStorage.netRealizationPerKg}/kg (Best: ${comparison.synthesis.bestOption})`);
    passed++;
  } catch (err) {
    console.error('❌ [FAIL] 2. Decision Engine Math failed:', err.message);
    failed++;
  }

  // TEST 3: API Endpoint /api/net-realization/3way-comparison
  try {
    const res = await makeRequest('POST', '/api/net-realization/3way-comparison', {
      buyerPricePerKg: 22.0,
      cropName: 'Potato',
      state: 'Uttar Pradesh',
      district: 'Agra',
      buyerPicksUp: true,
      quantityKg: 5000
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.body.options && res.body.options.direct, 'Response must include direct option');
    assert(res.body.options.mandiSpot, 'Response must include mandiSpot option');
    assert(res.body.options.coldStorage, 'Response must include coldStorage option');
    assert(res.body.synthesis && res.body.synthesis.summaryHi, 'Response must include Hindi synthesis');

    console.log(`✅ [PASS] 3. API /api/net-realization/3way-comparison: HTTP 200 with synthesis "${res.body.synthesis.bestOption}"`);
    passed++;
  } catch (err) {
    console.error('❌ [FAIL] 3. API /api/net-realization/3way-comparison failed:', err.message);
    failed++;
  }

  // TEST 4: Enhanced /api/storage/scenario with Database Cold Store Lookup
  try {
    const res = await makeRequest('POST', '/api/storage/scenario', {
      cropName: 'Potato',
      coldStorageId: 'cs-401',
      storageDurationMonths: 3
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.strictEqual(res.body.facilityName, 'Agra Imperial Cold Logistics & CA Store', 'Should resolve facility name from DB');
    assert.strictEqual(res.body.storageChargeTotal, 1.35, '3 months at ₹0.45/kg/mo must equal ₹1.35');
    assert(res.body.estimatedFutureNetRealization > 0, 'Future net realization must be positive');
    assert(res.body.recommendation, 'Recommendation text must be present');

    console.log(`✅ [PASS] 4. API /api/storage/scenario: Successfully bound to DB store "${res.body.facilityName}" (Charge Total: ₹${res.body.storageChargeTotal}/kg)`);
    passed++;
  } catch (err) {
    console.error('❌ [FAIL] 4. API /api/storage/scenario failed:', err.message);
    failed++;
  }

  // TEST 5: Match Requirements Listing API enriches Mandi Benchmark
  try {
    // Pick an existing listing
    const listingRes = await pool.query("SELECT id FROM farmer_listings WHERE status = 'ACTIVE' LIMIT 1");
    if (listingRes.rows.length > 0) {
      const listingId = listingRes.rows[0].id;
      const res = await makeRequest('GET', `/api/matches/listing/${listingId}`);
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      if (res.body.matches && res.body.matches.length > 0) {
        const firstMatch = res.body.matches[0];
        assert(firstMatch.netRealization, 'Match must include netRealization');
        console.log(`✅ [PASS] 5. API /api/matches/listing/:id: Match enriched with netRealization and Mandi comparison`);
      } else {
        console.log(`✅ [PASS] 5. API /api/matches/listing/:id: Executed successfully (listing ${listingId} has 0 matching open requirements)`);
      }
      passed++;
    } else {
      console.log(`⚠️ [SKIP] 5. No active farmer listing found in DB, skipping match listing check.`);
      passed++;
    }
  } catch (err) {
    console.error('❌ [FAIL] 5. Match listing enrichment failed:', err.message);
    failed++;
  }

  console.log('\n====================================================================');
  console.log(`PHASE 4 DECISION SUPPORT SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================================\n');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runPhase4Tests().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});

