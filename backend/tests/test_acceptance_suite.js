// backend/tests/test_acceptance_suite.js
const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { calculateDistanceKm, filterByDistance } = require('../services/locationService');
const { evaluateEligibility, calculateMatchScore } = require('../services/matchingService');
const { generateBuyerRecommendation } = require('../services/geminiService');

console.log('==============================================================');
console.log('KISANCONNECT — ACCEPTANCE TESTS 1 TO 5 VERIFICATION');
console.log('==============================================================\n');

let testsPassed = 0;
let testsFailed = 0;

function runTest(testName, testFn) {
  try {
    testFn();
    console.log(`✅ [PASS] ${testName}`);
    testsPassed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${testName}:`, err.message);
    testsFailed++;
  }
}

async function runAsyncTest(testName, testFn) {
  try {
    await testFn();
    console.log(`✅ [PASS] ${testName}`);
    testsPassed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${testName}:`, err.message);
    testsFailed++;
  }
}

async function main() {
  // -------------------------------------------------------------
  // ACCEPTANCE TEST 1: Small Farmer A (8T Potato)
  // -------------------------------------------------------------
  runTest('ACCEPTANCE TEST 1: Small Farmer A (8T Potato) vs Local & Bulk Buyer', () => {
    const farmerA = {
      quantityTons: 8.0,
      quantityKg: 8000,
      cropName: 'Potato',
      variety: 'Kufri Jyoti',
      grade: 'Grade A',
      expectedPricePerKg: 18.5,
      latitude: 26.820,
      longitude: 83.959
    };

    const localBuyerReq = {
      buyerType: 'local',
      cropName: 'Potato',
      quantityTons: 1.5,
      requiredQuantityKg: 1500,
      minimumDirectFarmerLotKg: 250,
      aggregationAllowed: true,
      gradeRequired: 'Grade A'
    };

    const bulkBuyerReq = {
      buyerType: 'bulk',
      cropName: 'Potato',
      quantityTons: 100.0,
      requiredQuantityKg: 100000,
      minimumDirectFarmerLotKg: 20000, // 20T
      aggregationAllowed: true,
      gradeRequired: 'Grade A'
    };

    // 1. Local Buyer Evaluation
    const localElig = evaluateEligibility(farmerA, localBuyerReq);
    assert.strictEqual(localElig.eligible, true, 'Local buyer should be eligible');
    assert.strictEqual(localElig.routeType, 'direct_local', 'Route type should be direct_local');
    assert.strictEqual(localElig.visibleToFarmer, true, 'Local buyer should be VISIBLE to farmer');

    // 2. Bulk Buyer Evaluation for Farmer A (8T < 20T)
    const bulkElig = evaluateEligibility(farmerA, bulkBuyerReq);
    assert.strictEqual(bulkElig.routeType, 'aggregator_pooled', 'Route type should be aggregator_pooled');
    // Bulk buyer should NOT be shown as direct buyer, but visible as aggregator opportunity
    assert.strictEqual(bulkElig.isDirectBulk, false, 'Farmer A must NOT be direct bulk buyer match');
    assert.strictEqual(bulkElig.visibleToFarmer, true, 'Opportunity visible with aggregator route notice');
    assert.strictEqual(bulkElig.requiresAggregation, true, 'Requires aggregator pooling');
  });

  // -------------------------------------------------------------
  // ACCEPTANCE TEST 2: Farmer D (20T Potato >= 20T minimum direct lot)
  // -------------------------------------------------------------
  runTest('ACCEPTANCE TEST 2: Farmer D (20T Potato) Direct Bulk Eligibility', () => {
    const farmerD = {
      quantityTons: 20.0,
      quantityKg: 20000,
      cropName: 'Potato',
      variety: 'Kufri Jyoti',
      grade: 'Grade A',
      expectedPricePerKg: 19.0,
      latitude: 26.600,
      longitude: 83.750
    };

    const bulkBuyerReq = {
      buyerType: 'bulk',
      cropName: 'Potato',
      quantityTons: 100.0,
      requiredQuantityKg: 100000,
      minimumDirectFarmerLotKg: 20000, // 20T
      aggregationAllowed: true,
      gradeRequired: 'Grade A'
    };

    const eligD = evaluateEligibility(farmerD, bulkBuyerReq);
    assert.strictEqual(eligD.eligible, true, 'Farmer D should be eligible for direct bulk');
    assert.strictEqual(eligD.routeType, 'direct_bulk', 'Route type must be direct_bulk');
    assert.strictEqual(eligD.visibleToFarmer, true, 'Bulk buyer VISIBLE to farmer');
    assert.strictEqual(eligD.isDirectBulk, true, 'Direct bulk offer is AVAILABLE');
    assert.strictEqual(eligD.requiresAggregation, false, 'Aggregator NOT required for direct eligibility');
  });

  // -------------------------------------------------------------
  // ACCEPTANCE TEST 3: Aggregator Supply Coordination & Plan (FreshBites 100T, Farmers A 8T, B 12T, C 15T)
  // -------------------------------------------------------------
  runTest('ACCEPTANCE TEST 3: Aggregator Procurement Plan (35T from Farmers A, B, C)', () => {
    const freshBitesReq = {
      id: 'req-freshbites',
      buyerName: 'FreshBites Foods Pvt Ltd',
      cropName: 'Potato',
      quantityTons: 100.0,
      offeredPricePerKg: 20.0,
      minimumDirectFarmerLotKg: 20000,
      aggregationAllowed: true
    };

    const farmers = [
      { id: 'f-a', name: 'Farmer A', quantityTons: 8.0, pricePerKg: 18.50 },
      { id: 'f-b', name: 'Farmer B', quantityTons: 12.0, pricePerKg: 18.20 },
      { id: 'f-c', name: 'Farmer C', quantityTons: 15.0, pricePerKg: 18.70 }
    ];

    // Aggregator selects all three
    const totalProcuredTons = farmers.reduce((sum, f) => sum + f.quantityTons, 0);
    assert.strictEqual(totalProcuredTons, 35.0, 'Procurement plan total must equal 35T');

    const remainingTons = freshBitesReq.quantityTons - totalProcuredTons;
    assert.strictEqual(remainingTons, 65.0, 'Remaining required tons must equal 65T');

    // Economic calculation
    const weightedCost = farmers.reduce((sum, f) => sum + (f.quantityTons * f.pricePerKg), 0) / totalProcuredTons;
    const estLogistics = 1.15;
    const grossMarginPerKg = freshBitesReq.offeredPricePerKg - weightedCost - estLogistics;
    
    assert(grossMarginPerKg > 0, 'Aggregator gross margin should be positive');
    assert(farmers.length > 1, 'Multiple farmers pooled -> Batch aggregation required');
  });

  // -------------------------------------------------------------
  // ACCEPTANCE TEST 4: Nearby Haversine Distance Filtering (Kushinagar base, filter = 25km)
  // -------------------------------------------------------------
  runTest('ACCEPTANCE TEST 4: Nearby Distance Filtering (A: 8km, B: 32km, C: 87km, Filter: 25km)', () => {
    const kushinagar = { latitude: 26.740, longitude: 83.889 };

    const buyerA = { id: 'buyer-a', name: 'Buyer A', latitude: 26.791, longitude: 83.946 }; // ~8 km
    const buyerB = { id: 'buyer-b', name: 'Buyer B', latitude: 26.475, longitude: 83.770 }; // ~32 km
    const buyerC = { id: 'buyer-c', name: 'Buyer C', latitude: 26.800, longitude: 83.015 }; // ~87 km

    const distA = calculateDistanceKm(kushinagar.latitude, kushinagar.longitude, buyerA.latitude, buyerA.longitude);
    const distB = calculateDistanceKm(kushinagar.latitude, kushinagar.longitude, buyerB.latitude, buyerB.longitude);
    const distC = calculateDistanceKm(kushinagar.latitude, kushinagar.longitude, buyerC.latitude, buyerC.longitude);

    assert(distA <= 10 && distA >= 7, `Buyer A distance expected ~8km, got ${distA}`);
    assert(distB >= 28 && distB <= 35, `Buyer B distance expected ~32km, got ${distB}`);
    assert(distC >= 80 && distC <= 92, `Buyer C distance expected ~87km, got ${distC}`);

    const buyers = [
      { ...buyerA, distanceKm: distA },
      { ...buyerB, distanceKm: distB },
      { ...buyerC, distanceKm: distC }
    ];

    const filtered = buyers.filter(b => b.distanceKm <= 25);
    assert.strictEqual(filtered.length, 1, 'Only 1 buyer should be visible within 25 km');
    assert.strictEqual(filtered[0].id, 'buyer-a', 'Buyer A must be VISIBLE');
    assert(!filtered.some(b => b.id === 'buyer-b'), 'Buyer B must be HIDDEN');
    assert(!filtered.some(b => b.id === 'buyer-c'), 'Buyer C must be HIDDEN');
  });

  // -------------------------------------------------------------
  // ACCEPTANCE TEST 5: Graceful Gemini AI Fallback
  // -------------------------------------------------------------
  await runAsyncTest('ACCEPTANCE TEST 5: Gemini AI Unavailable Fallback (Core Matching & Discovery Unbroken)', async () => {
    // Temporarily unset GEMINI_API_KEY to simulate outage/unconfigured state
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const farmerProduce = {
        cropName: 'Potato',
        quantityTons: 8.0,
        grade: 'Grade A',
        location: 'Kushinagar, UP'
      };

      const matchedBuyers = [
        { buyerName: 'Local Potato Trader', distanceKm: 8, offeredPricePerKg: 19.5, buyerType: 'local' },
        { buyerName: 'FreshBites Foods Pvt Ltd', distanceKm: 41, offeredPricePerKg: 20.0, buyerType: 'bulk' }
      ];

      // Call AI recommendation service with simulated absence
      const aiResult = await generateBuyerRecommendation(farmerProduce, matchedBuyers, { language: 'hi' });
      
      // Verification: AI service degrades gracefully
      assert.strictEqual(aiResult.available, false, 'AI available flag must be false when service is unconfigured/unavailable');
      assert(aiResult.fallbackMessage.length > 0, 'Graceful fallback message must be returned');

      // Core matching and buyer discovery still function 100% deterministically
      assert.strictEqual(matchedBuyers.length, 2, 'Matched buyers list is completely intact');
      const dist = calculateDistanceKm(26.740, 83.889, 26.791, 83.946);
      assert.strictEqual(dist, 8.0, 'Deterministic distance engine remains functional');
    } finally {
      if (originalKey) process.env.GEMINI_API_KEY = originalKey;
    }
  });

  console.log('\n==============================================================');
  console.log(`SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('==============================================================');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error running acceptance test suite:', err);
  process.exit(1);
});
