const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const dealService = require('./services/dealService');

async function runMarketplaceTests() {
  console.log('====================================================');
  console.log('MARKETPLACE & NEGOTIATION TWO-WAY VERIFICATION SUITE');
  console.log('====================================================');

  let passed = 0;
  let total = 0;

  function assert(desc, condition, details = '') {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc} ${details ? `(${details})` : ''}`);
    }
  }

  const client = await pool.connect();
  try {
    // 1. Setup mock farmer, buyer, listing, requirement
    const farmerId = 'test-farmer-' + Date.now();
    const buyerId = 'test-buyer-' + Date.now();

    const farmerPhone = '999' + Math.floor(1000000 + Math.random() * 9000000);
    const buyerPhone = '999' + Math.floor(1000000 + Math.random() * 9000000);

    await client.query(
      `INSERT INTO users (id, name, phone, role, verified, status)
       VALUES ($1, 'Test Ramesh Farmer', $2, 'farmer', true, 'approved'),
              ($3, 'Test Agro Buyer Ltd', $4, 'buyer', true, 'approved')
       ON CONFLICT (id) DO NOTHING`,
      [farmerId, farmerPhone, buyerId, buyerPhone]
    );

    // Create Buyer Requirement: 15 Tons Potato
    const reqId = 'req-test-' + Date.now();
    const reqRes = await client.query(
      `INSERT INTO buyer_requirements 
       (id, buyer_id, buyer_name, buyer_company, crop_name, variety, quantity_tons, offered_price_per_kg, location, status)
       VALUES ($1, $2, 'Test Agro Buyer Ltd', 'Test Agro Buyer Ltd', 'Potato', 'Chipsona', 15, 20.0, 'Delhi Hub', 'ACTIVE')
       RETURNING id, quantity_tons, confirmed_procured_tons, status`,
      [reqId, buyerId]
    );
    const requirementId = reqRes.rows[0].id;
    assert('Requirement created with 0 confirmed procurement', reqRes.rows[0].confirmed_procured_tons == 0);

    // Create Farmer Listing: 10 Tons Potato
    const listId = 'list-test-' + Date.now();
    const listRes = await client.query(
      `INSERT INTO farmer_listings
       (id, farmer_id, farmer_name, crop_name, variety, quantity_tons, quantity_kg, expected_price_per_kg, status)
       VALUES ($1, $2, 'Test Ramesh Farmer', 'Potato', 'Chipsona', 10, 10000, 22.0, 'ACTIVE')
       RETURNING id, quantity_tons, reserved_quantity_tons, confirmed_quantity_tons, status`,
      [listId, farmerId]
    );
    const listingId = listRes.rows[0].id;

    const listInit = await dealService.syncListingQuantities(listingId);
    assert('Listing initialized with 10T available, 0T reserved, 0T confirmed', 
      listInit.availableQuantityTons === 10 && listInit.reservedQuantityTons === 0 && listInit.confirmedQuantityTons === 0
    );

    // TEST 1: Buyer sends Direct Offer for 4 Tons @ ₹21.5/kg
    console.log('\n--- Step 1: Buyer sends Direct Offer for 4T ---');
    const offer1 = await dealService.createOffer({
      buyerId,
      buyerName: 'Test Agro Buyer Ltd',
      sellerId: farmerId,
      sellerName: 'Test Ramesh Farmer',
      sellerRole: 'farmer',
      listingId,
      requirementId,
      cropName: 'Potato',
      variety: 'Chipsona',
      quantityTons: 4,
      offeredPricePerKg: 21.5,
      pickupTerms: 'Farm Gate Pickup',
      targetDate: '2026-10-15',
      message: 'Need 4 tons immediately'
    }, { id: buyerId, role: 'buyer', name: 'Test Agro Buyer Ltd' });

    assert('Offer 1 created as PENDING with Round 1 recorded', offer1.status === 'PENDING' && offer1.negotiation_history?.length === 1);
    
    // Check Direction tagging
    const farmerEnriched1 = dealService.enrichOffer(offer1, farmerId);
    const buyerEnriched1 = dealService.enrichOffer(offer1, buyerId);
    assert('Farmer views direct offer as RECEIVED (isMyTurn=true)', farmerEnriched1.direction === 'RECEIVED' && farmerEnriched1.isMyTurn === true);
    assert('Buyer views direct offer as SENT (isMyTurn=false)', buyerEnriched1.direction === 'SENT' && buyerEnriched1.isMyTurn === false);

    // Verify hold on listing
    const listAfterOffer1 = await dealService.syncListingQuantities(listingId);
    assert('Listing hold reserved 4T, remaining available is 6T', 
      listAfterOffer1.reservedQuantityTons === 4 && listAfterOffer1.availableQuantityTons === 6 && listAfterOffer1.status === 'ACTIVE'
    );

    // TEST 2: Double-Booking Prevention: Attempt to offer 7T (Available is only 6T)
    console.log('\n--- Step 2: Double-Booking Prevention Check ---');
    let doubleBookingCaught = false;
    try {
      await dealService.createOffer({
        buyerId,
        buyerName: 'Test Agro Buyer Ltd',
        sellerId: farmerId,
        sellerName: 'Test Ramesh Farmer',
        sellerRole: 'farmer',
        listingId,
        cropName: 'Potato',
        quantityTons: 7, // 7 > 6
        offeredPricePerKg: 22.0
      }, { id: buyerId, role: 'buyer', name: 'Test Agro Buyer Ltd' });
    } catch (err) {
      doubleBookingCaught = true;
      assert('Double-booking prevented: Requesting 7T when 6T available is rejected', err.message.includes('Only 6T'));
    }
    assert('Double-booking validation threw error as expected', doubleBookingCaught);

    // TEST 3: Create Offer 2 for remaining 6T -> Available drops to 0T -> Status becomes RESERVED
    console.log('\n--- Step 3: Second offer for exact remaining 6T ---');
    const offer2 = await dealService.createOffer({
      buyerId,
      buyerName: 'Test Agro Buyer Ltd',
      sellerId: farmerId,
      sellerName: 'Test Ramesh Farmer',
      sellerRole: 'farmer',
      listingId,
      requirementId,
      cropName: 'Potato',
      quantityTons: 6,
      offeredPricePerKg: 21.0,
      pickupTerms: 'Mandi Delivery'
    }, { id: buyerId, role: 'buyer', name: 'Test Agro Buyer Ltd' });

    const listAfterOffer2 = await dealService.syncListingQuantities(listingId);
    assert('All 10T reserved across Offer 1 (4T) and Offer 2 (6T), available=0T', 
      listAfterOffer2.reservedQuantityTons === 10 && listAfterOffer2.availableQuantityTons === 0 && listAfterOffer2.status === 'RESERVED'
    );

    // TEST 4: Negotiation / Counter-Offer flow on Offer 1
    console.log('\n--- Step 4: Farmer counters Offer 1 (asks ₹22.5/kg, 3.5T) ---');
    const counterRes1 = await dealService.counterOffer(offer1.id, {
      counterPricePerKg: 22.5,
      counterQuantityTons: 3.5,
      pickupTerms: 'Farm Gate Pickup Only',
      targetDate: '2026-10-18',
      message: 'Can do 3.5T at ₹22.5/kg'
    }, { id: farmerId, role: 'farmer', name: 'Test Ramesh Farmer' });

    assert('Offer 1 status updated to COUNTERED', counterRes1.status === 'COUNTERED');
    assert('Negotiation trail has 2 rounds', counterRes1.negotiation_history?.length === 2);

    const farmerEnrichedCounter = dealService.enrichOffer(counterRes1, farmerId);
    const buyerEnrichedCounter = dealService.enrichOffer(counterRes1, buyerId);
    assert('After Farmer counters, Buyer turn is active (isMyTurn=true for Buyer)', buyerEnrichedCounter.isMyTurn === true);
    assert('Farmer is waiting for Buyer (isMyTurn=false for Farmer)', farmerEnrichedCounter.isMyTurn === false);

    // Check adjusted reservation (4T -> 3.5T, so 0.5T restored to available!)
    const listAfterCounter = await dealService.syncListingQuantities(listingId);
    assert('Adjusted counter quantity: Reserved is 9.5T (3.5T + 6T), Available restored to 0.5T',
      listAfterCounter.reservedQuantityTons === 9.5 && listAfterCounter.availableQuantityTons === 0.5
    );

    // TEST 5: Acceptance & Confirmed Deal
    console.log('\n--- Step 5: Buyer accepts counter offer on Offer 1 ---');
    const acceptRes = await dealService.acceptOffer(offer1.id, buyerId, 'buyer');
    assert('Offer 1 accepted and order generated', acceptRes.offer.status === 'ACCEPTED' && !!acceptRes.order);

    const listAfterAccept = await dealService.syncListingQuantities(listingId);
    assert('Listing reservation converted to confirmed: Confirmed=3.5T, Reserved=6T (Offer 2), Available=0.5T',
      listAfterAccept.confirmedQuantityTons === 3.5 && listAfterAccept.reservedQuantityTons === 6 && listAfterAccept.availableQuantityTons === 0.5
    );

    // Check Buyer Requirement procurement update
    const reqAfterAccept = await dealService.syncRequirementProcurement(requirementId);
    assert('Buyer Requirement procurement updated to exactly 3.5T / 15T', 
      reqAfterAccept.confirmedProcuredTons === 3.5 && reqAfterAccept.status === 'ACTIVE'
    );

    // TEST 6: Rejection & Release Hold
    console.log('\n--- Step 6: Offer 2 (6T) is rejected by Farmer ---');
    const rejectRes = await dealService.rejectOffer(offer2.id, farmerId, 'farmer', 'Farmer declined');
    assert('Offer 2 rejected', rejectRes.status === 'REJECTED');

    const listAfterReject = await dealService.syncListingQuantities(listingId);
    assert('Offer 2 hold released: Reserved=0T, Confirmed=3.5T, Available=6.5T, Status=ACTIVE',
      listAfterReject.reservedQuantityTons === 0 && listAfterReject.confirmedQuantityTons === 3.5 && listAfterReject.availableQuantityTons === 6.5 && listAfterReject.status === 'ACTIVE'
    );

    console.log('\n====================================================');
    console.log(`RESULTS: ${passed} / ${total} TESTS PASSED`);
    console.log('====================================================');

    if (passed === total) {
      console.log('ALL MARKETPLACE TWO-WAY LOGIC TESTS PASSED PERFECTLY!');
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMarketplaceTests();
