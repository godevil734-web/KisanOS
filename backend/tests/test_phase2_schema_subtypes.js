/**
 * backend/tests/test_phase2_schema_subtypes.js
 * Verification Suite for Phase 2: Database Schema & Trader Subtype Extensions
 * 
 * Verifies:
 * 1. Trader Subtype Registration & Database Persistence
 * 2. Payment Transactions & Escrow Ledger REST endpoints
 * 3. Digital Weighbridge & Inspection Slip REST endpoints
 * 4. Access controls & security on new financial and QC endpoints
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');
const { pool, mapRow } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const BASE_URL = 'http://localhost:5001';

console.log('====================================================================');
console.log('KISANOS PHASE 2 TRADER SUBTYPES & ESCROW LEDGER TEST SUITE');
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
  const mandiTraderUser = {
    id: `usr-trd-${Date.now()}`,
    name: 'Sanjay Aggarwal',
    mobile: `98765${Math.floor(10000 + Math.random() * 90000)}`,
    email: `sanjay.mandi.${Date.now()}@agriexample.com`,
    role: 'buyer',
    businessName: 'Aggarwal Mandi Trading Co.',
    contactPerson: 'Sanjay Aggarwal',
    city: 'Agra Mandi',
    traderSubtype: 'mandi_trader',
    apmcLicenseNumber: 'UP-AGR-APMC-8842',
    mandiName: 'Agra Mandi (Fatehabad Road)',
    taxIdGst: '09AAACA8842K1ZB',
    password: 'SecurePassword@2026'
  };

  const commissionAgentUser = {
    id: `usr-ca-${Date.now()}`,
    name: 'Harish Chandra Arhatiya',
    mobile: `98766${Math.floor(10000 + Math.random() * 90000)}`,
    email: `harish.arhat.${Date.now()}@agriexample.com`,
    role: 'buyer',
    businessName: 'Kisan Kalyan Commission Agency',
    contactPerson: 'Harish Chandra',
    city: 'Hathras Mandi',
    traderSubtype: 'commission_agent',
    apmcLicenseNumber: 'UP-HTR-CA-1029',
    mandiName: 'Hathras Mandi',
    taxIdGst: '09BBBCB1029K2ZC',
    password: 'SecurePassword@2026'
  };

  const sellerUser = {
    id: `usr-sel-${Date.now()}`,
    name: 'Gopal Kisan',
    phone: `98767${Math.floor(10000 + Math.random() * 90000)}`,
    role: 'farmer',
    status: 'active'
  };

  const intruderUser = {
    id: `usr-int-${Date.now()}`,
    name: 'Unrelated Intruder',
    phone: `98768${Math.floor(10000 + Math.random() * 90000)}`,
    role: 'buyer',
    status: 'active'
  };

  // Seed seller and intruder in DB
  await pool.query(`
    INSERT INTO users (id, name, phone, role, status)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO NOTHING
  `, [sellerUser.id, sellerUser.name, sellerUser.phone, sellerUser.role, sellerUser.status]);

  await pool.query(`
    INSERT INTO users (id, name, phone, role, status)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO NOTHING
  `, [intruderUser.id, intruderUser.name, intruderUser.phone, intruderUser.role, intruderUser.status]);

  const sellerToken = makeToken(sellerUser);
  const intruderToken = makeToken(intruderUser);

  let registeredTraderToken = null;
  let registeredTraderId = null;

  // 1. Business Signup with Trader Subtype (Mandi Trader)
  await runTest('1. Registration: Mandi Trader registers with APMC license and mandi name', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signup/business`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mandiTraderUser)
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200, `Signup failed: ${JSON.stringify(data)}`);
    assert(data.token, 'Token not received');
    assert.strictEqual(data.user.traderSubtype, 'mandi_trader');
    assert.strictEqual(data.user.apmcLicenseNumber, 'UP-AGR-APMC-8842');
    assert.strictEqual(data.user.mandiName, 'Agra Mandi (Fatehabad Road)');

    registeredTraderToken = data.token;
    registeredTraderId = data.user.id;

    // Verify DB columns directly in users table
    const dbCheck = await pool.query('SELECT * FROM users WHERE id = $1', [registeredTraderId]);
    assert.strictEqual(dbCheck.rows[0].trader_subtype, 'mandi_trader');
    assert.strictEqual(dbCheck.rows[0].apmc_license_number, 'UP-AGR-APMC-8842');
    assert.strictEqual(dbCheck.rows[0].mandi_name, 'Agra Mandi (Fatehabad Road)');
  });

  // 2. Business Signup with Commission Agent Subtype
  await runTest('2. Registration: Commission Agent (Arhatiya) registers with license', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signup/business`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(commissionAgentUser)
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200, `Commission agent signup failed: ${JSON.stringify(data)}`);
    assert.strictEqual(data.user.traderSubtype, 'commission_agent');
    assert.strictEqual(data.user.apmcLicenseNumber, 'UP-HTR-CA-1029');
  });

  // Create a dummy order for testing Payment & Inspection endpoints
  const testOrderId = `ord-p2-${Date.now()}`;
  await pool.query(`
    INSERT INTO orders (id, order_number, buyer_id, buyer_name, seller_id, seller_name, crop_name, quantity_tons, unit_price_per_kg, produce_total, total_amount, status, payment_status)
    VALUES ($1, $2, $3, $4, $5, $6, 'Potato', 10.00, 20.00, 200000.00, 200000.00, 'CONFIRMED', 'PENDING')
  `, [testOrderId, `ORD-TEST-${Date.now().toString().slice(-5)}`, registeredTraderId, mandiTraderUser.name, sellerUser.id, sellerUser.name]);

  // 3. Payment Transactions Ledger: Record Escrow Deposit
  await runTest('3. Escrow Ledger: Buyer deposits 100% deal amount into Escrow', async () => {
    const res = await fetch(`${BASE_URL}/api/orders/${testOrderId}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${registeredTraderToken}`
      },
      body: JSON.stringify({
        amount: 200000.00,
        transactionType: 'ESCROW_DEPOSIT',
        payeeId: sellerUser.id,
        paymentGatewayRef: 'PAY_ESCROW_998822',
        bankReference: 'HDFC_CMS_20261107',
        notes: '100% Buyer escrow deposit locked for procurement'
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201, `Failed to record payment: ${JSON.stringify(data)}`);
    assert.strictEqual(data.transactionType, 'ESCROW_DEPOSIT');
    assert.strictEqual(data.status, 'ESCROWED');
    assert.strictEqual(Number(data.amount), 200000.00);

    // Verify order paymentStatus was updated to ESCROW_FUNDED
    const ordCheck = await pool.query('SELECT payment_status FROM orders WHERE id = $1', [testOrderId]);
    assert.strictEqual(ordCheck.rows[0].payment_status, 'ESCROW_FUNDED');
  });

  // 4. Payment Transactions Query: Retrieve Order Payments
  await runTest('4. Escrow Ledger: Retrieve payment transactions for order', async () => {
    const res = await fetch(`${BASE_URL}/api/orders/${testOrderId}/payments`, {
      headers: { Authorization: `Bearer ${sellerToken}` }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(data) && data.length >= 1);
    assert.strictEqual(data[0].transactionType, 'ESCROW_DEPOSIT');
  });

  // 5. Digital Weighbridge & Inspection Slip Recording
  await runTest('5. QC & Weighbridge: Record weighbridge slip with net weight and moisture check', async () => {
    const res = await fetch(`${BASE_URL}/api/orders/${testOrderId}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${registeredTraderToken}`
      },
      body: JSON.stringify({
        weighbridgeGrossKg: 14200,
        weighbridgeTareKg: 4200,
        netWeightKg: 10000,
        moisturePercent: 18.5,
        foreignMatterPercent: 1.2,
        qualityGradeVerified: 'Grade A',
        deductionKg: 50,
        notes: 'Clean potato tubers, minor soil adherence (0.5% deduction applied)'
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201, `Failed to record inspection: ${JSON.stringify(data)}`);
    assert.strictEqual(Number(data.netWeightKg), 10000);
    assert.strictEqual(Number(data.moisturePercent), 18.5);
    assert.strictEqual(data.status, 'VERIFIED');
  });

  // 6. Security Check: Unrelated user cannot read payments or inspection slips (403)
  await runTest('6. Security: Unrelated user receives 403 on order payment ledger & inspection', async () => {
    const payRes = await fetch(`${BASE_URL}/api/orders/${testOrderId}/payments`, {
      headers: { Authorization: `Bearer ${intruderToken}` }
    });
    assert.strictEqual(payRes.status, 403, 'Intruder should receive 403 on payments');

    const qcRes = await fetch(`${BASE_URL}/api/orders/${testOrderId}/inspection`, {
      headers: { Authorization: `Bearer ${intruderToken}` }
    });
    assert.strictEqual(qcRes.status, 403, 'Intruder should receive 403 on inspection');
  });

  // Cleanup test order and users safely
  await pool.query('DELETE FROM payment_transactions WHERE order_id = $1', [testOrderId]);
  await pool.query('DELETE FROM inspection_slips WHERE order_id = $1', [testOrderId]);
  await pool.query('DELETE FROM orders WHERE id = $1', [testOrderId]);
  await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3, $4)', [
    registeredTraderId, commissionAgentUser.id, sellerUser.id, intruderUser.id
  ]);

  console.log('\n====================================================================');
  console.log(`PHASE 2 SCHEMA & SUBTYPES SUITE: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('====================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

