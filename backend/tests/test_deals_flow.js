/**
 * backend/tests/test_deals_flow.js
 * Comprehensive End-to-End Test Suite for Offer -> Negotiation -> Deal Flow
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');
const { pool, mapRow } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const BASE_URL = 'http://localhost:5001';

console.log('==============================================================');
console.log('KISANCONNECT — COMPLETE OFFER → ACCEPTANCE → DEAL FLOW TESTS');
console.log('==============================================================\n');

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

async function main() {
  // 1. Generate Auth Tokens for Demo Farmer and Demo Buyer
  const farmerUser = {
    id: 'usr-farmer-a',
    name: 'Ramesh Patel',
    phone: '9800100001',
    role: 'farmer',
    status: 'active'
  };

  const buyerUser = {
    id: 'usr-buyer-1',
    name: 'Vikram Mehta (FreshBites)',
    phone: '9800200001',
    role: 'buyer',
    status: 'active'
  };

  const otherUser = {
    id: 'usr-farmer-b',
    name: 'Suresh Kumar',
    phone: '9800100002',
    role: 'farmer',
    status: 'active'
  };

  const farmerToken = jwt.sign(farmerUser, JWT_SECRET, { expiresIn: '1h' });
  const buyerToken = jwt.sign(buyerUser, JWT_SECRET, { expiresIn: '1h' });
  const otherToken = jwt.sign(otherUser, JWT_SECRET, { expiresIn: '1h' });

  // Setup test listing and requirement
  const testListingId = `test-list-${Date.now()}`;
  const testReqId = `test-req-${Date.now()}`;

  await pool.query(`
    INSERT INTO farmer_listings (
      id, farmer_id, farmer_name, crop_name, variety,
      quantity_tons, quantity_kg, expected_price_per_kg, status, is_demo, created_at, updated_at
    ) VALUES (
      $1, $2, $3, 'Potato', 'Kufri Jyoti',
      15.0, 15000, 22.0, 'ACTIVE', false, NOW(), NOW()
    )
  `, [testListingId, farmerUser.id, farmerUser.name]);

  await pool.query(`
    INSERT INTO buyer_requirements (
      id, buyer_id, buyer_name, buyer_company, buyer_type, crop_name, variety,
      quantity_tons, required_quantity_kg, offered_price_per_kg, status, is_demo, created_at, updated_at
    ) VALUES (
      $1, $2, $3, 'FreshBites Foods', 'bulk', 'Potato', 'Kufri Jyoti',
      40.0, 40000, 21.0, 'OPEN', false, NOW(), NOW()
    )
  `, [testReqId, buyerUser.id, buyerUser.name]);

  let createdOfferId = null;

  // TEST 1: Farmer makes Offer to Buyer
  await runTest('1. Farmer makes Offer to Buyer with valid price & quantity', async () => {
    const res = await fetch(`${BASE_URL}/api/offers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${farmerToken}`
      },
      body: JSON.stringify({
        requirementId: testReqId,
        listingId: testListingId,
        buyerId: buyerUser.id,
        buyerName: buyerUser.name,
        cropName: 'Potato',
        variety: 'Kufri Jyoti',
        quantityTons: 6.0,
        offeredPricePerKg: 22.0,
        deliveryTerms: 'Farm Gate Pickup',
        message: 'Top quality graded Kufri Jyoti potatoes.'
      })
    });

    assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}`);
    const offer = await res.json();
    assert(offer.id, 'Offer must have ID');
    assert.strictEqual(offer.status, 'PENDING', 'Offer status must be PENDING');
    assert.strictEqual(Number(offer.quantityTons), 6.0, 'Quantity must be 6T');
    assert.strictEqual(Number(offer.offeredPricePerKg), 22.0, 'Offered price must be ₹22/kg');
    createdOfferId = offer.id;
  });

  // TEST 2: Sent vs Incoming Offers Visibility
  await runTest('2. Verify Sent Offers for Farmer and Incoming Offers for Buyer', async () => {
    // Farmer checks sent offers
    const sentRes = await fetch(`${BASE_URL}/api/offers/sent`, {
      headers: { 'Authorization': `Bearer ${farmerToken}` }
    });
    const sentList = await sentRes.json();
    const myOffer = sentList.find(o => o.id === createdOfferId);
    assert(myOffer, 'Farmer must see created offer in sent offers');

    // Buyer checks incoming offers
    const incRes = await fetch(`${BASE_URL}/api/offers/incoming`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const incList = await incRes.json();
    const incomingOffer = incList.find(o => o.id === createdOfferId);
    assert(incomingOffer, 'Buyer must see offer in incoming offers');
    assert.strictEqual(incomingOffer.sellerId, farmerUser.id);
  });

  // TEST 3: Unauthorized User Cannot Counter or Accept
  await runTest('3. Unauthorized User cannot Counter or Accept the Offer', async () => {
    const res = await fetch(`${BASE_URL}/api/offers/${createdOfferId}/accept`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${otherToken}` }
    });
    assert.strictEqual(res.status, 400, 'Non-party to offer should be rejected');
  });

  // TEST 4: Buyer Counters the Offer
  await runTest('4. Buyer Counters the Offer with new price and quantity', async () => {
    const res = await fetch(`${BASE_URL}/api/offers/${createdOfferId}/counter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        counterPricePerKg: 21.5,
        counterQuantityTons: 5.0,
        message: 'We can accept 5 Tonnes at ₹21.5/kg delivered.'
      })
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const updated = await res.json();
    assert.strictEqual(updated.status, 'COUNTERED', 'Status must be COUNTERED');
    assert.strictEqual(Number(updated.counterPricePerKg), 21.5, 'Counter price must be ₹21.5');
    assert.strictEqual(Number(updated.counterQuantityTons), 5.0, 'Counter quantity must be 5T');
    assert.strictEqual(updated.counterBy, 'buyer', 'Counter by must be buyer');
  });

  // TEST 5: Farmer Accepts Buyer Counter-Offer -> Atomic Deal Creation
  let createdDealId = null;
  let createdOrderNumber = null;

  await runTest('5. Farmer Accepts Counter-Offer -> Atomic Deal created in orders table', async () => {
    const res = await fetch(`${BASE_URL}/api/offers/${createdOfferId}/accept`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${farmerToken}` }
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success, 'Acceptance must return success: true');
    assert(data.deal, 'Response must include created deal');
    
    createdDealId = data.deal.id;
    createdOrderNumber = data.deal.orderNumber;

    assert(createdOrderNumber.startsWith('KC-DEAL-'), `Order number must start with KC-DEAL-, got ${createdOrderNumber}`);
    assert.strictEqual(Number(data.deal.quantityTons), 5.0, 'Agreed quantity must be 5T');
    assert.strictEqual(Number(data.deal.agreedPricePerKg), 21.5, 'Agreed price must be ₹21.5/kg');
    assert.strictEqual(data.deal.status, 'ACTIVE', 'Deal status must be ACTIVE');
    assert.strictEqual(data.deal.paymentStatus, 'ESCROW_LOCKED', 'Payment status must be ESCROW_LOCKED');

    // Verify database row for offer was updated
    const offerDbRes = await pool.query('SELECT * FROM offers WHERE id = $1', [createdOfferId]);
    assert.strictEqual(offerDbRes.rows[0].status, 'ACCEPTED');
    assert.strictEqual(offerDbRes.rows[0].deal_id, createdDealId);
  });

  // TEST 6: Inventory Consistency Checks
  await runTest('6. Inventory Consistency: Listing and Requirement quantities deducted correctly', async () => {
    // Farmer listing had 15T, 5T sold -> remaining should be 10T
    const listRes = await pool.query('SELECT * FROM farmer_listings WHERE id = $1', [testListingId]);
    const remainingListingQty = Number(listRes.rows[0].quantity_tons) - Number(listRes.rows[0].confirmed_quantity_tons || 0);
    assert.strictEqual(remainingListingQty, 10.0, `Expected 10.0T remaining in listing, got ${remainingListingQty}`);

    // Buyer requirement had 40T, 5T fulfilled -> remaining should be 35T
    const reqRes = await pool.query('SELECT * FROM buyer_requirements WHERE id = $1', [testReqId]);
    const remainingReqQty = Number(reqRes.rows[0].quantity_tons) - Number(reqRes.rows[0].confirmed_procured_tons || 0);
    assert.strictEqual(remainingReqQty, 35.0, `Expected 35.0T remaining in requirement, got ${remainingReqQty}`);
  });

  // TEST 7: Duplicate Acceptance Prevention
  await runTest('7. Duplicate Acceptance is Blocked (Atomicity & Idempotency)', async () => {
    const res = await fetch(`${BASE_URL}/api/offers/${createdOfferId}/accept`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${farmerToken}` }
    });
    assert.strictEqual(res.status, 400, 'Duplicate acceptance must be rejected');
    const body = await res.json();
    assert(body.error.includes('already accepted') || body.error.includes('already exists'), 'Expected already accepted error');
  });

  // TEST 8: Shared Visibility: Both Farmer and Buyer see the EXACT SAME Deal
  await runTest('8. Shared Deal Visibility: Both Farmer & Buyer see the exact same Deal ID', async () => {
    // Farmer checks /api/deals
    const fDealsRes = await fetch(`${BASE_URL}/api/deals`, {
      headers: { 'Authorization': `Bearer ${farmerToken}` }
    });
    const fDeals = await fDealsRes.json();
    const farmerDeal = fDeals.find(d => d.id === createdDealId);
    assert(farmerDeal, 'Farmer must see deal in /api/deals');

    // Buyer checks /api/deals
    const bDealsRes = await fetch(`${BASE_URL}/api/deals`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const bDeals = await bDealsRes.json();
    const buyerDeal = bDeals.find(d => d.id === createdDealId);
    assert(buyerDeal, 'Buyer must see deal in /api/deals');

    // Compare deal facts
    assert.strictEqual(farmerDeal.id, buyerDeal.id, 'Deal IDs must match');
    assert.strictEqual(farmerDeal.orderNumber, buyerDeal.orderNumber, 'Order numbers must match');
    assert.strictEqual(Number(farmerDeal.quantityTons), Number(buyerDeal.quantityTons), 'Quantities must match');
    assert.strictEqual(Number(farmerDeal.produceTotal), Number(buyerDeal.produceTotal), 'Produce totals must match');
  });

  // TEST 9: Rejection Lifecycle
  await runTest('9. Offer Rejection: Rejecting an offer updates status and DOES NOT create a deal', async () => {
    // Create new offer
    const offerRes = await fetch(`${BASE_URL}/api/offers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${farmerToken}`
      },
      body: JSON.stringify({
        requirementId: testReqId,
        listingId: testListingId,
        buyerId: buyerUser.id,
        buyerName: buyerUser.name,
        cropName: 'Potato',
        variety: 'Kufri Jyoti',
        quantityTons: 2.0,
        offeredPricePerKg: 35.0, // High price
        message: 'Premium grade'
      })
    });

    const offer2 = await offerRes.json();
    assert.strictEqual(offer2.status, 'PENDING');

    // Buyer rejects
    const rejectRes = await fetch(`${BASE_URL}/api/offers/${offer2.id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ reason: 'Price too high for this grade' })
    });

    assert.strictEqual(rejectRes.status, 200);
    const rejectedOffer = await rejectRes.json();
    assert.strictEqual(rejectedOffer.status, 'REJECTED');

    // Verify no orders were created
    const ordersRes = await pool.query('SELECT * FROM orders WHERE offer_id = $1', [offer2.id]);
    assert.strictEqual(ordersRes.rows.length, 0, 'No deal/order should exist for rejected offer');

    // Verify listing quantity was NOT deducted
    const listRes = await pool.query('SELECT * FROM farmer_listings WHERE id = $1', [testListingId]);
    const availableQty = Number(listRes.rows[0].quantity_tons) - Number(listRes.rows[0].confirmed_quantity_tons || 0);
    assert.strictEqual(availableQty, 10.0, 'Listing quantity should remain 10T');
  });

  // TEST 10: Insufficient Quantity Protection
  await runTest('10. Validation: Offer quantity exceeding available listing stock is rejected', async () => {
    // Listing has 10T available, trying to offer 50T
    const res = await fetch(`${BASE_URL}/api/offers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${farmerToken}`
      },
      body: JSON.stringify({
        requirementId: testReqId,
        listingId: testListingId,
        buyerId: buyerUser.id,
        buyerName: buyerUser.name,
        cropName: 'Potato',
        quantityTons: 50.0,
        offeredPricePerKg: 20.0
      })
    });

    assert.strictEqual(res.status, 400, 'Over-quantity offer should return 400');
    const body = await res.json();
    assert(body.error.includes('उपलब्ध') || body.error.includes('available'), 'Expected available stock error');
  });

  // Clean up test records
  await pool.query('DELETE FROM orders WHERE offer_id = $1', [createdOfferId]);
  await pool.query('DELETE FROM offers WHERE listing_id = $1', [testListingId]);
  await pool.query('DELETE FROM farmer_listings WHERE id = $1', [testListingId]);
  await pool.query('DELETE FROM buyer_requirements WHERE id = $1', [testReqId]);

  console.log('\n==============================================================');
  console.log(`SUMMARY: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('==============================================================\n');

  await pool.end();
  process.exit(testsFailed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test Suite Unhandled Exception:', err);
  process.exit(1);
});
