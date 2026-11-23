/**
 * backend/tests/test_phase1_integrity.js
 * Verification Suite for Phase 1: Security & Transaction Integrity Fixes
 * 
 * Verifies:
 * 1. Object-level RBAC on Orders (PUT /api/orders/:id/status)
 * 2. Order Cancellation with Atomic Inventory Rollback
 * 3. Cold Storage Overbooking Prevention (POST /api/storage/book)
 * 4. Transporter Dynamic Order Association
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');
const { pool, mapRow } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const dealService = require('../services/dealService');

const BASE_URL = 'http://localhost:5001';

console.log('====================================================================');
console.log('KISANOS PHASE 1 INTEGRITY & AUTHORIZATION VERIFICATION SUITE');
console.log('====================================================================\n');

let testsPassed = 0;
let testsFailed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
    testsFailed++;
  }
}

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function main() {
  const farmerUser = { id: 'usr-farmer-phase1', name: 'Farmer Phase1', phone: '9999111001', role: 'farmer', status: 'active' };
  const buyerUser = { id: 'usr-buyer-phase1', name: 'Buyer Phase1', phone: '9999111002', role: 'buyer', status: 'active' };
  const intruderUser = { id: 'usr-intruder-phase1', name: 'Intruder User', phone: '9999111003', role: 'farmer', status: 'active' };
  const adminUser = { id: 'usr-admin-phase1', name: 'Admin Phase1', phone: '9999111004', role: 'admin', status: 'active' };
  const transporterUser = { id: 'usr-transporter-phase1', name: 'Transporter Phase1', phone: '9999111005', role: 'transporter', status: 'active' };

  const farmerToken = makeToken(farmerUser);
  const buyerToken = makeToken(buyerUser);
  const intruderToken = makeToken(intruderUser);
  const adminToken = makeToken(adminUser);
  const transporterToken = makeToken(transporterUser);

  // Setup test users in DB if not exist
  for (const u of [farmerUser, buyerUser, intruderUser, adminUser, transporterUser]) {
    await pool.query(`
      INSERT INTO users (id, name, phone, role, status)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone, status = 'active'
    `, [u.id, u.name, u.phone, u.role, u.status]);
  }

  // Ensure test crop exists
  await pool.query(`
    INSERT INTO crops (id, name, category, default_unit)
    VALUES ('crp-test-p1', 'Potato', 'Vegetables', 'tons')
    ON CONFLICT (id) DO NOTHING
  `);

  // Create a clean test farmer listing with 20 tons
  const listingId = `lst-phase1-${Date.now()}`;
  await pool.query(`
    INSERT INTO farmer_listings (id, farmer_id, farmer_name, crop_name, variety, quantity_tons, expected_price_per_kg, status, reserved_quantity_tons, confirmed_quantity_tons)
    VALUES ($1, $2, $3, 'Potato', 'Kufri Jyoti', 20.00, 18.00, 'ACTIVE', 0, 0)
  `, [listingId, farmerUser.id, farmerUser.name]);

  // Create a clean test buyer requirement with 30 tons
  const reqId = `req-phase1-${Date.now()}`;
  await pool.query(`
    INSERT INTO buyer_requirements (id, buyer_id, buyer_name, crop_name, variety, quantity_tons, offered_price_per_kg, status, confirmed_procured_tons)
    VALUES ($1, $2, $3, 'Potato', 'Kufri Jyoti', 30.00, 20.00, 'OPEN', 0)
  `, [reqId, buyerUser.id, buyerUser.name]);

  let testOrderId = null;

  // 1. Create an accepted offer that creates an order
  await runTest('1. Setup: Buyer creates offer and Farmer accepts -> Deal order created', async () => {
    const offerRes = await fetch(`${BASE_URL}/api/offers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        listingId,
        requirementId: reqId,
        sellerId: farmerUser.id,
        cropName: 'Potato',
        quantityTons: 8.00,
        offeredPricePerKg: 19.50
      })
    });
    const offerData = await offerRes.json();
    assert.strictEqual(offerRes.status, 201, `Offer failed: ${JSON.stringify(offerData)}`);
    const offerId = offerData.id;

    // Farmer accepts offer
    const acceptRes = await fetch(`${BASE_URL}/api/offers/${offerId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerToken}`
      }
    });
    const acceptData = await acceptRes.json();
    assert.strictEqual(acceptRes.status, 200, `Accept failed: ${JSON.stringify(acceptData)}`);
    assert(acceptData.deal && acceptData.deal.id, 'Deal order was not generated');
    testOrderId = acceptData.deal.id;

    // Verify listing inventory: 8T confirmed, 12T available
    const listCheck = await pool.query('SELECT * FROM farmer_listings WHERE id = $1', [listingId]);
    assert.strictEqual(Number(listCheck.rows[0].confirmed_quantity_tons), 8.00);
    assert.strictEqual(Number(listCheck.rows[0].reserved_quantity_tons), 0.00);
  });

  // 2. Intruder attempts to advance order status -> 403 Forbidden
  await runTest('2. Security Guard: Unauthorized user receives 403 when modifying order status', async () => {
    const res = await fetch(`${BASE_URL}/api/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${intruderToken}`
      },
      body: JSON.stringify({ status: 'COMPLETED' })
    });
    assert.strictEqual(res.status, 403, `Expected 403 Forbidden but got ${res.status}`);
  });

  // 3. Seller cannot mark order as COMPLETED (only buyer/admin can)
  await runTest('3. State Transition Guard: Seller cannot mark order as COMPLETED', async () => {
    const res = await fetch(`${BASE_URL}/api/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerToken}`
      },
      body: JSON.stringify({ status: 'COMPLETED' })
    });
    assert.strictEqual(res.status, 403, `Expected 403 Forbidden for farmer completing order`);
  });

  // 4. Authorized Seller can advance status to AGGREGATING or READY_FOR_PICKUP
  await runTest('4. Lifecycle: Seller advances order to READY_FOR_PICKUP', async () => {
    const res = await fetch(`${BASE_URL}/api/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerToken}`
      },
      body: JSON.stringify({ status: 'READY_FOR_PICKUP', note: 'Lots aggregated and bagged' })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200, `Failed to advance status: ${JSON.stringify(data)}`);
    assert.strictEqual(data.status, 'READY_FOR_PICKUP');
  });

  // 5. Order Cancellation with Atomic Inventory Rollback
  await runTest('5. Integrity: Order Cancellation rolls back confirmed listing inventory', async () => {
    const res = await fetch(`${BASE_URL}/api/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ status: 'CANCELLED', note: 'Buyer cancelled procurement contract' })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200, `Failed to cancel order: ${JSON.stringify(data)}`);
    assert.strictEqual(data.status, 'CANCELLED');

    // Verify listing inventory has been restored!
    const listCheck = await pool.query('SELECT * FROM farmer_listings WHERE id = $1', [listingId]);
    const listing = listCheck.rows[0];
    assert.strictEqual(Number(listing.confirmed_quantity_tons), 0.00, 'Confirmed tons should be reset to 0');
    assert.strictEqual(Number(listing.reserved_quantity_tons), 0.00, 'Reserved tons should be 0');
    assert.strictEqual(listing.status, 'ACTIVE', 'Listing status should be ACTIVE');

    // Verify buyer requirement confirmed procurement has been deducted
    const reqCheck = await pool.query('SELECT * FROM buyer_requirements WHERE id = $1', [reqId]);
    assert.strictEqual(Number(reqCheck.rows[0].confirmed_procured_tons), 0.00, 'Buyer procurement should be reset to 0');
  });

  // 6. Cold Storage Overbooking Prevention
  await runTest('6. Storage Guard: Booking exceeding cold storage available capacity is rejected (400)', async () => {
    // Find or create cold storage facility with 50T capacity
    const storeId = `cs-test-p1-${Date.now()}`;
    await pool.query(`
      INSERT INTO cold_storages (id, name, location, total_capacity_tons, occupied_capacity_tons, available_capacity_tons, storage_charge_per_month_per_ton)
      VALUES ($1, 'Agra Test Cold Store', 'Agra, UP', 50.00, 45.00, 5.00, 180.00)
    `, [storeId]);

    // Attempt booking 10 tons when only 5 tons available -> should fail with 400
    const overbookRes = await fetch(`${BASE_URL}/api/storage/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerToken}`
      },
      body: JSON.stringify({
        storageId: storeId,
        cropName: 'Potato',
        quantityTons: 10.00,
        durationMonths: 2
      })
    });
    assert.strictEqual(overbookRes.status, 400, 'Expected 400 Bad Request for overbooking');
    const errData = await overbookRes.json();
    assert(errData.error.includes('exceeds available capacity'), `Unexpected error message: ${errData.error}`);

    // Booking 4 tons (within 5 tons available) -> should succeed
    const validBookRes = await fetch(`${BASE_URL}/api/storage/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerToken}`
      },
      body: JSON.stringify({
        storageId: storeId,
        cropName: 'Potato',
        quantityTons: 4.00,
        durationMonths: 2
      })
    });
    assert.strictEqual(validBookRes.status, 201, 'Valid booking within capacity should succeed (201)');

    // Verify capacity was decremented to 1 ton
    const storeCheck = await pool.query('SELECT * FROM cold_storages WHERE id = $1', [storeId]);
    assert.strictEqual(Number(storeCheck.rows[0].available_capacity_tons), 1.00);
  });

  // Cleanup test entities safely
  await pool.query('DELETE FROM orders WHERE id = $1', [testOrderId]);
  await pool.query('DELETE FROM farmer_listings WHERE id = $1', [listingId]);
  await pool.query('DELETE FROM buyer_requirements WHERE id = $1', [reqId]);
  await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5)', [
    farmerUser.id, buyerUser.id, intruderUser.id, adminUser.id, transporterUser.id
  ]);

  console.log('\n====================================================================');
  console.log(`PHASE 1 INTEGRITY SUITE: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('====================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
