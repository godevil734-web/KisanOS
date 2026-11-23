/**
 * Test Suite: Phase 5 Multi-Farmer Aggregation & Historical Clearing Dataset
 * KisanOS 2.0
 */

const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const { pool, hashPassword } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'kisanconnect_jwt_secret_dev_2026';

function generateTestToken(user) {
  return jwt.sign(
    { id: user.id, phone: user.phone, role: user.role, status: user.status || 'ACTIVE' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

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

async function runPhase5Tests() {
  console.log('====================================================================');
  console.log('KISANOS PHASE 5 AGGREGATION & CLEARING DATASET TEST SUITE');
  console.log('====================================================================\n');

  let passed = 0;
  let failed = 0;

  const testId = Date.now();
  const aggregatorUser = {
    id: `usr-agg-${testId}`,
    phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
    name: 'Agra Kisan FPO Aggregator',
    role: 'aggregator',
    status: 'ACTIVE'
  };

  const farmerA = {
    id: `usr-farmA-${testId}`,
    phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
    name: 'Ramesh Sharma',
    role: 'farmer',
    status: 'ACTIVE'
  };

  const farmerB = {
    id: `usr-farmB-${testId}`,
    phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
    name: 'Suresh Patel',
    role: 'farmer',
    status: 'ACTIVE'
  };

  const listingAId = `list-A-${testId}`;
  const listingBId = `list-B-${testId}`;
  let createdPlanId = null;

  try {
    const pw = await hashPassword('TestPass@123');

    // Create test users
    for (const u of [aggregatorUser, farmerA, farmerB]) {
      await pool.query(`
        INSERT INTO users (id, phone, name, password, role, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone
      `, [u.id, u.phone, u.name, pw, u.role, u.status]);
    }

    // Create test listings
    await pool.query(`
      INSERT INTO farmer_listings (id, farmer_id, farmer_name, crop_name, variety, quantity_tons, expected_price_per_kg, status, location, created_at)
      VALUES 
        ($1, $2, $3, 'Potato', 'Kufri Jyoti', 15.0, 18.0, 'ACTIVE', 'Fatehabad, Agra', NOW()),
        ($4, $5, $6, 'Potato', 'Kufri Jyoti', 12.0, 18.5, 'ACTIVE', 'Shamshabad, Agra', NOW())
    `, [listingAId, farmerA.id, farmerA.name, listingBId, farmerB.id, farmerB.name]);

  } catch (setupErr) {
    console.error('Setup failed:', setupErr);
    process.exit(1);
  }

  const aggToken = generateTestToken(aggregatorUser);
  const farmerAToken = generateTestToken(farmerA);

  // TEST 1: Create Multi-Farmer Procurement Plan -> verifies procurement_allocations child records
  try {
    const planPayload = {
      cropName: 'Potato',
      variety: 'Kufri Jyoti',
      targetQuantityTons: 25.0,
      buyerName: 'Haldiram Snacks Ltd',
      buyerCompany: 'Haldiram Snacks Ltd',
      buyerOfferedPricePerKg: 22.0,
      selectedFarmers: [
        {
          listingId: listingAId,
          farmerId: farmerA.id,
          farmerName: farmerA.name,
          allocatedQuantityTons: 14.0,
          farmerPricePerKg: 18.0
        },
        {
          listingId: listingBId,
          farmerId: farmerB.id,
          farmerName: farmerB.name,
          allocatedQuantityTons: 10.0,
          farmerPricePerKg: 18.5
        }
      ],
      notes: 'Phase 5 Multi-Farmer Aggregation Lot'
    };

    const res = await makeRequest('POST', '/api/aggregator/procurement-plans', planPayload, {
      Authorization: `Bearer ${aggToken}`
    });

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assert(res.body.id, 'Plan ID must be returned');
    createdPlanId = res.body.id;

    // Check procurement_allocations table in PostgreSQL
    const allocDbRes = await pool.query(
      'SELECT * FROM procurement_allocations WHERE plan_id = $1 ORDER BY allocated_quantity_tons DESC',
      [createdPlanId]
    );

    assert.strictEqual(allocDbRes.rows.length, 2, 'Should create 2 allocation records');
    assert.strictEqual(Number(allocDbRes.rows[0].allocated_quantity_tons), 14.0, 'First allocation must be 14.0 tons');
    assert.strictEqual(Number(allocDbRes.rows[1].allocated_quantity_tons), 10.0, 'Second allocation must be 10.0 tons');
    assert.strictEqual(allocDbRes.rows[0].status, 'ALLOCATED', 'Allocation status must be ALLOCATED');

    console.log(`✅ [PASS] 1. Multi-Farmer Procurement: Created plan ${createdPlanId} with 2 farmer allocations (Total: 24.0T pooled)`);
    passed++;
  } catch (err) {
    console.error('❌ [FAIL] 1. Multi-Farmer Procurement failed:', err.message);
    failed++;
  }

  // TEST 2: Retrieve Aggregator Plan Allocations with Payout Breakdown
  try {
    const res = await makeRequest('GET', `/api/aggregator/procurement-plans/${createdPlanId}/allocations`, null, {
      Authorization: `Bearer ${aggToken}`
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.strictEqual(res.body.totalAllocations, 2, 'Total allocations must be 2');
    assert.strictEqual(res.body.totalAllocatedTons, 24.0, 'Total allocated tons must be 24.0');
    // Farmer A: 14,000 kg * 18 = ₹2,52,000; Farmer B: 10,000 kg * 18.5 = ₹1,85,000 -> Total = ₹4,37,000
    assert.strictEqual(res.body.totalFarmerPayout, 437000, `Expected 437000, got ${res.body.totalFarmerPayout}`);
    assert.strictEqual(res.body.allocations[0].payoutAmount, 252000, 'Farmer A payout must be ₹2,52,000');

    console.log(`✅ [PASS] 2. Allocation Ledger: 24.0T allocated across 2 farmers (Total Payout: ₹${res.body.totalFarmerPayout.toLocaleString('en-IN')})`);
    passed++;
  } catch (err) {
    console.error('❌ [FAIL] 2. Allocation Ledger failed:', err.message);
    failed++;
  }

  // TEST 3: Create Batch -> Transitions Plan & Allocations to CONFIRMED
  try {
    const res = await makeRequest('POST', `/api/aggregator/procurement-plans/${createdPlanId}/create-batch`, {}, {
      Authorization: `Bearer ${aggToken}`
    });

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assert.strictEqual(res.body.plan.status, 'AGGREGATED', 'Plan status must transition to AGGREGATED');
    assert(res.body.batch && res.body.batch.id, 'Batch must be created');

    // Verify allocations updated to CONFIRMED in DB
    const allocCheck = await pool.query(
      'SELECT DISTINCT status FROM procurement_allocations WHERE plan_id = $1',
      [createdPlanId]
    );
    assert.strictEqual(allocCheck.rows[0].status, 'CONFIRMED', 'Allocations must transition to CONFIRMED');

    console.log(`✅ [PASS] 3. Batch Assembly: Plan transitioned to AGGREGATED; child allocations confirmed`);
    passed++;
  } catch (err) {
    console.error('❌ [FAIL] 3. Batch Assembly failed:', err.message);
    failed++;
  }

  // TEST 4: Farmer Views Their Pooled Allocation & Estimated Payout
  try {
    const res = await makeRequest('GET', '/api/farmer/procurement-allocations', null, {
      Authorization: `Bearer ${farmerAToken}`
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body), 'Response must be an array');
    const myAlloc = res.body.find(a => a.planId === createdPlanId);
    assert(myAlloc, 'Farmer A must find their allocation');
    assert.strictEqual(Number(myAlloc.allocatedQuantityTons), 14.0, 'Allocated tons must be 14.0');
    assert.strictEqual(myAlloc.estimatedFarmerPayout, 252000, 'Estimated payout must be ₹2,52,000');

    console.log(`✅ [PASS] 4. Farmer View: Farmer A verified allocation in "${myAlloc.buyerName}" pool (Payout: ₹${myAlloc.estimatedFarmerPayout.toLocaleString('en-IN')})`);
    passed++;
  } catch (err) {
    console.error('❌ [FAIL] 4. Farmer View failed:', err.message);
    failed++;
  }

  // TEST 5: Historical Clearing Dataset API
  try {
    const res = await makeRequest('GET', '/api/market-prices/historical-clearing?crop=Potato');

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.body.summary, 'Summary must be present');
    assert(res.body.summary.totalTrades >= 1, 'Total trades must be >= 1');
    assert(res.body.summary.weightedAveragePricePerKg > 0, 'Weighted average clearing price must be positive');
    assert(res.body.trades && res.body.trades.length > 0, 'Trades array must contain cleared deals');

    const s = res.body.summary;
    console.log(`✅ [PASS] 5. Historical Clearing Dataset: ${s.totalTrades} deals, ${s.totalVolumeTons}T volume, Weighted Avg: ₹${s.weightedAveragePricePerKg}/kg (Spread vs APMC Modal: ${res.body.apmcBenchmark ? `+₹${res.body.apmcBenchmark.spreadVsModal}/kg` : 'N/A'})`);
    passed++;
  } catch (err) {
    console.error('❌ [FAIL] 5. Historical Clearing Dataset failed:', err.message);
    failed++;
  }

  // TEST 6: Procurement Cancellation Safeguards & State Transition Guards
  try {
    // 6a. Attempt to cancel COMPLETED plan -> Must be rejected (400)
    await pool.query("UPDATE procurement_plans SET status = 'COMPLETED' WHERE id = $1", [createdPlanId]);
    const resCompleted = await makeRequest('POST', `/api/aggregator/procurement-plans/${createdPlanId}/cancel`, {}, {
      Authorization: `Bearer ${aggToken}`
    });
    assert.strictEqual(resCompleted.status, 400, `Expected 400 for COMPLETED plan cancel, got ${resCompleted.status}`);
    assert(resCompleted.body.error && resCompleted.body.error.includes('COMPLETED'), 'Must return descriptive error for COMPLETED plan');

    // 6b. Attempt to cancel DISPATCHED plan -> Must be rejected (400)
    await pool.query("UPDATE procurement_plans SET status = 'DISPATCHED' WHERE id = $1", [createdPlanId]);
    const resDispatched = await makeRequest('POST', `/api/aggregator/procurement-plans/${createdPlanId}/cancel`, {}, {
      Authorization: `Bearer ${aggToken}`
    });
    assert.strictEqual(resDispatched.status, 400, `Expected 400 for DISPATCHED plan cancel, got ${resDispatched.status}`);

    // 6c. Attempt to cancel FULFILLED plan -> Must be rejected (400)
    await pool.query("UPDATE procurement_plans SET status = 'FULFILLED' WHERE id = $1", [createdPlanId]);
    const resFulfilled = await makeRequest('POST', `/api/aggregator/procurement-plans/${createdPlanId}/cancel`, {}, {
      Authorization: `Bearer ${aggToken}`
    });
    assert.strictEqual(resFulfilled.status, 400, `Expected 400 for FULFILLED plan cancel, got ${resFulfilled.status}`);

    // Verify allocations are still CONFIRMED (not modified)
    const allocIntactCheck = await pool.query(
      'SELECT DISTINCT status FROM procurement_allocations WHERE plan_id = $1',
      [createdPlanId]
    );
    assert.strictEqual(allocIntactCheck.rows[0].status, 'CONFIRMED', 'Allocations must remain CONFIRMED when cancellation is rejected');

    // 6d. Normal cancellation on active/aggregated plan -> Must succeed (200)
    await pool.query("UPDATE procurement_plans SET status = 'AGGREGATED' WHERE id = $1", [createdPlanId]);
    const res = await makeRequest('POST', `/api/aggregator/procurement-plans/${createdPlanId}/cancel`, {}, {
      Authorization: `Bearer ${aggToken}`
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.strictEqual(res.body.plan.status, 'CANCELLED', 'Plan status must be CANCELLED');

    const allocCheck = await pool.query(
      'SELECT DISTINCT status FROM procurement_allocations WHERE plan_id = $1',
      [createdPlanId]
    );
    assert.strictEqual(allocCheck.rows[0].status, 'CANCELLED', 'Allocations must transition to CANCELLED');

    console.log(`✅ [PASS] 6. Cancellation Safeguards: Rejected cancellation for COMPLETED, DISPATCHED, and FULFILLED states; normal cancellation successfully released reservations`);
    passed++;
  } catch (err) {
    console.error('❌ [FAIL] 6. Plan Cancellation Safeguards failed:', err.message);
    failed++;
  }

  // Cleanup
  try {
    await pool.query('DELETE FROM procurement_allocations WHERE plan_id = $1', [createdPlanId]);
    await pool.query('DELETE FROM procurement_plans WHERE id = $1', [createdPlanId]);
    await pool.query('DELETE FROM farmer_listings WHERE id IN ($1, $2)', [listingAId, listingBId]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [aggregatorUser.id, farmerA.id, farmerB.id]);
  } catch (cleanErr) {
    // Non-fatal
  }

  console.log('\n====================================================================');
  console.log(`PHASE 5 AGGREGATION & CLEARING SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================================\n');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runPhase5Tests().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});

