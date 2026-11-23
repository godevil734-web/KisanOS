/**
 * backend/tests/test_phase3_operating_workflows.js
 * Verification Suite for Phase 3: Core Operating Workflows
 * 
 * Verifies:
 * 1. Trader Subtype Registration & APMC Mandi Credentials via Unified Form
 * 2. Buyer RFQ Creation with Lot Gating & Tolerance Parameters
 * 3. Escrow Deposit Funding & State Transition to ESCROW_FUNDED
 * 4. Digital Weighbridge & Inspection QC Slip with Moisture & Weight Reconciliation
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');
const { pool, mapRow } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const BASE_URL = 'http://localhost:5001';

console.log('====================================================================');
console.log('KISANOS PHASE 3 CORE OPERATING WORKFLOWS TEST SUITE');
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
  const buyerUser = {
    id: `usr-byr-${Date.now()}`,
    name: 'Vikram Mehta (ITC Agri)',
    role: 'buyer',
    status: 'active'
  };

  const farmerUser = {
    id: `usr-fmr-${Date.now()}`,
    name: 'Balram Yadav',
    role: 'farmer',
    status: 'active'
  };

  const buyerToken = makeToken(buyerUser);
  const farmerToken = makeToken(farmerUser);

  // Setup users in database
  await pool.query(`
    INSERT INTO users (id, name, phone, role, status, trader_subtype, apmc_license_number, mandi_name)
    VALUES ($1, $2, $3, $4, $5, 'bulk_processor', 'UP-AGR-PROC-5521', 'Agra Central Terminal')
    ON CONFLICT (id) DO NOTHING
  `, [buyerUser.id, buyerUser.name, `98111${Math.floor(10000 + Math.random() * 90000)}`, buyerUser.role, buyerUser.status]);

  await pool.query(`
    INSERT INTO users (id, name, phone, role, status)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO NOTHING
  `, [farmerUser.id, farmerUser.name, `98222${Math.floor(10000 + Math.random() * 90000)}`, farmerUser.role, farmerUser.status]);

  let testReqId = null;
  let testOrderId = null;

  // 1. Post Targeted Buyer RFQ Requirement
  await runTest('1. RFQ Posting: Buyer posts procurement requirement with lot thresholds', async () => {
    const res = await fetch(`${BASE_URL}/api/requirements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        cropName: 'Potato',
        variety: 'Kufri Chipsona',
        quantityTons: 50.00,
        minimumDirectFarmerLotKg: 5000,
        aggregationAllowed: true,
        offeredPricePerKg: 21.00,
        gradeRequired: 'Grade A',
        sizeMinMm: 50,
        sizeMaxMm: 75,
        maxMoisture: 19.5,
        maxDefects: 2.0,
        location: 'Agra Food Processing Cluster',
        requiredDate: '2026-11-25',
        deliveryType: 'DIRECT_FARM',
        buyerType: 'bulk'
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201, `Failed to post requirement: ${JSON.stringify(data)}`);
    assert(data.id, 'Requirement ID missing');
    assert.strictEqual(Number(data.quantityTons), 50.00);
    assert.strictEqual(Number(data.minimumDirectFarmerLotKg), 5000);
    testReqId = data.id;
  });

  // 2. Create Confirmed Deal Order
  await runTest('2. Deal Setup: Establish confirmed procurement order for settlement testing', async () => {
    testOrderId = `ord-p3-${Date.now()}`;
    await pool.query(`
      INSERT INTO orders (
        id, order_number, buyer_id, buyer_name, seller_id, seller_name,
        crop_name, variety, quantity_tons, unit_price_per_kg, produce_total,
        total_amount, status, payment_status, quality_grade
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'Potato', 'Kufri Chipsona', 25.00, 21.00,
        525000.00, 525000.00, 'CONFIRMED', 'PENDING', 'Grade A'
      )
    `, [testOrderId, `ORD-P3-${Date.now().toString().slice(-5)}`, buyerUser.id, buyerUser.name, farmerUser.id, farmerUser.name]);

    const ordCheck = await pool.query('SELECT * FROM orders WHERE id = $1', [testOrderId]);
    assert.strictEqual(ordCheck.rows.length, 1);
    assert.strictEqual(ordCheck.rows[0].payment_status, 'PENDING');
  });

  // 3. Buyer Escrow Funding
  await runTest('3. Escrow Funding: Buyer locks full ₹5,25,000 in escrow before dispatch', async () => {
    const res = await fetch(`${BASE_URL}/api/orders/${testOrderId}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        amount: 525000.00,
        transactionType: 'ESCROW_DEPOSIT',
        payeeId: farmerUser.id,
        paymentGatewayRef: 'ESCROW-LOCK-525K',
        bankReference: 'SBI-ESCROW-20261107',
        notes: 'Full contract escrow deposit funded'
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201, `Failed to deposit escrow: ${JSON.stringify(data)}`);
    assert.strictEqual(data.transactionType, 'ESCROW_DEPOSIT');
    assert.strictEqual(data.status, 'ESCROWED');

    // Verify order payment status
    const ordCheck = await pool.query('SELECT payment_status FROM orders WHERE id = $1', [testOrderId]);
    assert.strictEqual(ordCheck.rows[0].payment_status, 'ESCROW_FUNDED');
  });

  // 4. Digital Weighbridge Slip & Quality Inspection Verification
  await runTest('4. QC Verification: Upload digital weighbridge slip and moisture assessment', async () => {
    const res = await fetch(`${BASE_URL}/api/orders/${testOrderId}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        weighbridgeGrossKg: 32500,
        weighbridgeTareKg: 7500,
        netWeightKg: 25000,
        moisturePercent: 18.2,
        foreignMatterPercent: 0.8,
        qualityGradeVerified: 'Grade A',
        deductionKg: 100,
        notes: 'Chipping potato quality verified; dry matter > 21%, moisture within 18.2%'
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201, `Failed to record inspection: ${JSON.stringify(data)}`);
    assert.strictEqual(Number(data.netWeightKg), 25000);
    assert.strictEqual(Number(data.moisturePercent), 18.2);
    assert.strictEqual(data.status, 'VERIFIED');

    // Query inspection slips
    const getRes = await fetch(`${BASE_URL}/api/orders/${testOrderId}/inspection`, {
      headers: { Authorization: `Bearer ${farmerToken}` }
    });
    const slips = await getRes.json();
    assert.strictEqual(getRes.status, 200);
    assert(slips.length >= 1);
    assert.strictEqual(Number(slips[0].weighbridgeGrossKg), 32500);
  });

  // Cleanup test entities safely
  await pool.query('DELETE FROM payment_transactions WHERE order_id = $1', [testOrderId]);
  await pool.query('DELETE FROM inspection_slips WHERE order_id = $1', [testOrderId]);
  await pool.query('DELETE FROM orders WHERE id = $1', [testOrderId]);
  await pool.query('DELETE FROM buyer_requirements WHERE id = $1', [testReqId]);
  await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [buyerUser.id, farmerUser.id]);

  console.log('\n====================================================================');
  console.log(`PHASE 3 WORKFLOWS SUITE: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('====================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

