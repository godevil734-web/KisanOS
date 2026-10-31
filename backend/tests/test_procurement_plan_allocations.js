/**
 * backend/tests/test_procurement_plan_allocations.js
 * 
 * Comprehensive Test Suite for Aggregator Procurement Plan:
 * 1. Selecting 1, 3, 5, 10, 25, and 50 farmer listings.
 * 2. Selecting > 50 farmer listings with no arbitrary count limit.
 * 3. Partial quantity allocation per farmer (e.g. 30T out of 70T).
 * 4. Preventing over-allocation (> available quantity, <= 0).
 * 5. Preventing duplicate listing allocations in a single plan.
 * 6. Correct quantity-weighted average price and gross profit calculation.
 * 7. Saving, retrieving, and updating procurement plans with all allocations intact.
 * 8. Cross-plan concurrent over-allocation prevention and database transaction locks.
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const app = require('../server');

console.log('====================================================================');
console.log('KISANOS — PROCUREMENT PLAN DYNAMIC ALLOCATIONS & ECONOMICS SUITE');
console.log('====================================================================\n');

let testsPassed = 0;
let testsFailed = 0;

async function runTest(testName, testFn) {
  try {
    await testFn();
    console.log(`✅ [PASS] ${testName}`);
    testsPassed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${testName}:`, err.message);
    testsFailed++;
  }
}

// In-memory Database Client Simulator for Transactional Validation
class MockDbClient {
  constructor() {
    this.listings = new Map();
    this.activePlans = new Map();
    this.locks = new Set();
  }

  addListing(id, data) {
    this.listings.set(id, {
      id,
      farmer_id: data.farmerId || `farmer-${id}`,
      farmer_name: data.farmerName || `Farmer ${id}`,
      crop_name: data.cropName || 'Potato',
      variety: data.variety || 'Kufri Jyoti',
      grade: data.grade || 'Grade A',
      quantity_tons: data.quantityTons,
      quantity_kg: data.quantityKg || data.quantityTons * 1000,
      expected_price_per_kg: data.pricePerKg || 18.5,
      status: data.status || 'ACTIVE',
      distance_km: data.distanceKm || 15,
      location: data.location || 'Local Mandi'
    });
  }

  addPlan(id, plan) {
    this.activePlans.set(id, {
      id,
      status: plan.status || 'DRAFT',
      selected_farmers: plan.selectedFarmers || []
    });
  }

  async query(sql, params = []) {
    const trimmed = sql.trim().toUpperCase();

    // Query active procurement plans
    if (trimmed.includes('FROM PROCUREMENT_PLANS')) {
      const currentPlanId = params[0];
      const rows = [];
      for (const [id, p] of this.activePlans.entries()) {
        if (!currentPlanId || id !== currentPlanId) {
          if (['DRAFT', 'COMMITTED', 'ACTIVE', 'CONFIRMED', 'AGGREGATED'].includes(p.status)) {
            rows.push({ id: p.id, selected_farmers: p.selected_farmers });
          }
        }
      }
      return { rows };
    }

    // Query farmer listings with FOR UPDATE lock
    if (trimmed.includes('FROM FARMER_LISTINGS') && trimmed.includes('FOR UPDATE')) {
      const listingId = params[0];
      const row = this.listings.get(listingId);
      if (row) {
        this.locks.add(listingId);
        return { rows: [row] };
      }
      return { rows: [] };
    }

    return { rows: [] };
  }
}

async function main() {
  const { validateAndCalculateFarmerAllocations } = app;
  assert.strictEqual(typeof validateAndCalculateFarmerAllocations, 'function', 'Validation helper must be exported');

  // Setup mock client with 60 listings
  const dbClient = new MockDbClient();
  for (let i = 1; i <= 60; i++) {
    const listId = `list-${i}`;
    const qtyTons = 20.0 + (i % 5) * 20.0; // 20, 40, 60, 80, 100
    const price = 16.0 + (i % 6) * 1.5;
    dbClient.addListing(listId, {
      farmerId: `farmer-${i}`,
      farmerName: `Farmer Lot ${i}`,
      quantityTons: qtyTons,
      quantityKg: qtyTons * 1000,
      pricePerKg: price
    });
  }

  // -------------------------------------------------------------
  // TEST 1: Selecting 1, 3, 5, 10, 25, and 50 farmer listings
  // -------------------------------------------------------------
  const countsToTest = [1, 3, 5, 10, 25, 50];
  for (const count of countsToTest) {
    await runTest(`1. Selecting exactly ${count} farmer listing(s) in Procurement Plan`, async () => {
      const selectedFarmers = [];
      for (let i = 1; i <= count; i++) {
        selectedFarmers.push({
          listingId: `list-${i}`,
          allocatedQuantityTons: 10.0,
          pricePerKg: 18.0
        });
      }

      const result = await validateAndCalculateFarmerAllocations(dbClient, selectedFarmers, null);
      assert.strictEqual(result.validatedFarmers.length, count, `Should validate ${count} farmers`);
      assert.strictEqual(result.totalPlannedKg, count * 10000, `Total planned kg should be ${count * 10000}`);
      assert.strictEqual(result.totalProcCost, count * 10000 * 18.0, `Total proc cost should match`);
    });
  }

  // -------------------------------------------------------------
  // TEST 2: Selecting MORE THAN 50 listings (55 listings)
  // -------------------------------------------------------------
  await runTest('2. Selecting > 50 farmer listings (55 listings) without arbitrary limit', async () => {
    const selectedFarmers = [];
    for (let i = 1; i <= 55; i++) {
      selectedFarmers.push({
        listingId: `list-${i}`,
        allocatedQuantityTons: 5.0,
        pricePerKg: 19.0
      });
    }

    const result = await validateAndCalculateFarmerAllocations(dbClient, selectedFarmers, null);
    assert.strictEqual(result.validatedFarmers.length, 55, 'Should accept all 55 farmers without arbitrary limit');
    assert.strictEqual(result.totalPlannedKg, 55 * 5000);
  });

  // -------------------------------------------------------------
  // TEST 3: Partial Quantity Allocation (e.g. 30T out of 70T)
  // -------------------------------------------------------------
  await runTest('3. Partial quantity allocation per farmer (30T out of 70T available)', async () => {
    dbClient.addListing('list-partial', {
      quantityTons: 70.0,
      quantityKg: 70000,
      pricePerKg: 19.5
    });

    const selectedFarmers = [{
      listingId: 'list-partial',
      allocatedQuantityTons: 30.0,
      availableQuantityTons: 70.0,
      pricePerKg: 19.5
    }];

    const result = await validateAndCalculateFarmerAllocations(dbClient, selectedFarmers, null);
    assert.strictEqual(result.validatedFarmers.length, 1);
    assert.strictEqual(result.validatedFarmers[0].allocatedQuantityTons, 30.0, 'Allocated should be 30T');
    assert.strictEqual(result.validatedFarmers[0].availableQuantityTons, 70.0, 'Available should be 70T');
    assert.strictEqual(result.totalPlannedKg, 30000, 'Total planned kg should be 30,000');
  });

  // -------------------------------------------------------------
  // TEST 4: Prevent Over-Allocation (> available or <= 0)
  // -------------------------------------------------------------
  await runTest('4. Reject over-allocation (> available quantity) with error', async () => {
    const selectedFarmers = [{
      listingId: 'list-partial', // Available is 70T
      allocatedQuantityTons: 85.0 // Requests 85T
    }];

    let threw = false;
    try {
      await validateAndCalculateFarmerAllocations(dbClient, selectedFarmers, null);
    } catch (err) {
      threw = true;
      assert(err.message.includes('Insufficient available supply') || err.message.includes('committed'), 
        `Error message was: ${err.message}`);
    }
    assert.strictEqual(threw, true, 'Should throw on over-allocation');
  });

  await runTest('4b. Reject invalid zero or negative allocation with error', async () => {
    const selectedFarmers = [{
      listingId: 'list-partial',
      allocatedQuantityTons: 0.0 // Zero invalid
    }];

    let threw = false;
    try {
      await validateAndCalculateFarmerAllocations(dbClient, selectedFarmers, null);
    } catch (err) {
      threw = true;
      assert(err.message.includes('greater than zero'), `Error message was: ${err.message}`);
    }
    assert.strictEqual(threw, true, 'Should throw on zero allocation');
  });

  // -------------------------------------------------------------
  // TEST 5: Prevent Duplicate Listing Allocations
  // -------------------------------------------------------------
  await runTest('5. Reject duplicate listing allocations in same plan with error', async () => {
    const selectedFarmers = [
      { listingId: 'list-1', allocatedQuantityTons: 5.0 },
      { listingId: 'list-1', allocatedQuantityTons: 5.0 } // Duplicate listing
    ];

    let threw = false;
    try {
      await validateAndCalculateFarmerAllocations(dbClient, selectedFarmers, null);
    } catch (err) {
      threw = true;
      assert(err.message.toLowerCase().includes('duplicate'), `Error message was: ${err.message}`);
    }
    assert.strictEqual(threw, true, 'Should throw on duplicate listing');
  });

  // -------------------------------------------------------------
  // TEST 6: Quantity-Weighted Economics Simulation
  // -------------------------------------------------------------
  await runTest('6. Correct quantity-weighted average procurement cost and profit calculation', async () => {
    // Farmer A: 30T @ 20.0/kg = 30,000 * 20 = 600,000
    // Farmer B: 70T @ 10.0/kg = 70,000 * 10 = 700,000
    // Total: 100T (100,000 kg), Total cost: 1,300,000
    // Quantity-weighted average cost: 1,300,000 / 100,000 = 13.00/kg
    // Simple average would be (20 + 10) / 2 = 15.00/kg
    dbClient.addListing('list-w1', { quantityTons: 50.0, pricePerKg: 20.0 });
    dbClient.addListing('list-w2', { quantityTons: 100.0, pricePerKg: 10.0 });

    const selectedFarmers = [
      { listingId: 'list-w1', allocatedQuantityTons: 30.0, pricePerKg: 20.0 },
      { listingId: 'list-w2', allocatedQuantityTons: 70.0, pricePerKg: 10.0 }
    ];

    const result = await validateAndCalculateFarmerAllocations(dbClient, selectedFarmers, null);
    const totalKg = result.totalPlannedKg;
    const totalCost = result.totalProcCost;
    const weightedAvg = Number((totalCost / totalKg).toFixed(2));

    // Verify quantity-weighted average
    assert.strictEqual(weightedAvg, 13.00, `Expected weighted average ₹13.00/kg, got ₹${weightedAvg}`);
    assert.notStrictEqual(weightedAvg, 15.00, 'Must NOT be simple unweighted average of ₹15.00/kg');

    // Economics simulation:
    const buyerPrice = 25.0;
    const estLogisticsPerKg = 1.15;
    const grossMarginPerKg = Number((buyerPrice - weightedAvg).toFixed(2));
    const grossProfitTotal = Math.round(grossMarginPerKg * totalKg);
    const netMarginTotal = Math.round((grossMarginPerKg - estLogisticsPerKg) * totalKg);

    assert.strictEqual(grossMarginPerKg, 12.00, 'Gross margin should be ₹12.00/kg');
    assert.strictEqual(grossProfitTotal, 1200000, 'Gross profit should be ₹1,200,000');
    assert.strictEqual(netMarginTotal, 1085000, 'Net margin should be ₹1,085,000');
  });

  // -------------------------------------------------------------
  // TEST 7: Saving, Reopening, and Updating a Procurement Plan
  // -------------------------------------------------------------
  await runTest('7. Saving, retrieving, and updating plan with allocations intact', async () => {
    // Save Plan 1
    const initialFarmers = [
      { listingId: 'list-10', allocatedQuantityTons: 15.0 },
      { listingId: 'list-11', allocatedQuantityTons: 20.0 }
    ];
    const initialResult = await validateAndCalculateFarmerAllocations(dbClient, initialFarmers, null);
    dbClient.addPlan('plan-101', {
      status: 'DRAFT',
      selectedFarmers: initialResult.validatedFarmers
    });

    // Reopen and retrieve Plan 1
    const stored = dbClient.activePlans.get('plan-101');
    assert(stored, 'Plan 101 must exist');
    assert.strictEqual(stored.selected_farmers.length, 2);
    assert.strictEqual(stored.selected_farmers[0].allocatedQuantityTons, 15.0);
    assert.strictEqual(stored.selected_farmers[1].allocatedQuantityTons, 20.0);

    // Update Plan 1 with an additional farmer and adjusted quantity
    const updatedFarmers = [
      { listingId: 'list-10', allocatedQuantityTons: 10.0 }, // Adjusted
      { listingId: 'list-11', allocatedQuantityTons: 20.0 },
      { listingId: 'list-12', allocatedQuantityTons: 15.0 }  // Added 3rd
    ];
    const updatedResult = await validateAndCalculateFarmerAllocations(dbClient, updatedFarmers, 'plan-101');
    dbClient.addPlan('plan-101', {
      status: 'DRAFT',
      selectedFarmers: updatedResult.validatedFarmers
    });

    const updatedStored = dbClient.activePlans.get('plan-101');
    assert.strictEqual(updatedStored.selected_farmers.length, 3);
    assert.strictEqual(updatedStored.selected_farmers[0].allocatedQuantityTons, 10.0);
    assert.strictEqual(updatedStored.selected_farmers[2].allocatedQuantityTons, 15.0);
  });

  // -------------------------------------------------------------
  // TEST 8: Concurrent / Cross-Plan Over-Allocation Prevention
  // -------------------------------------------------------------
  await runTest('8. Cross-plan over-allocation prevention via transactional checks', async () => {
    // Dedicated listing with 50T total
    dbClient.addListing('list-shared', {
      quantityTons: 50.0,
      quantityKg: 50000,
      pricePerKg: 20.0
    });

    // Plan A commits 40T of the 50T
    const planAFarmers = [{ listingId: 'list-shared', allocatedQuantityTons: 40.0 }];
    const planAResult = await validateAndCalculateFarmerAllocations(dbClient, planAFarmers, null);
    dbClient.addPlan('plan-A', {
      status: 'COMMITTED',
      selectedFarmers: planAResult.validatedFarmers
    });

    // Plan B attempts to commit 20T on list-shared (40 + 20 = 60 > 50 available) -> MUST FAIL
    let planBFail = false;
    try {
      const planBFarmers = [{ listingId: 'list-shared', allocatedQuantityTons: 20.0 }];
      await validateAndCalculateFarmerAllocations(dbClient, planBFarmers, null);
    } catch (err) {
      planBFail = true;
      assert(err.message.includes('Insufficient available supply') || err.message.includes('committed'));
    }
    assert.strictEqual(planBFail, true, 'Plan B with 20T must fail because only 10T is uncommitted');

    // Plan B attempts to commit remaining 10T (40 + 10 = 50 <= 50 available) -> MUST SUCCEED
    const planBValidFarmers = [{ listingId: 'list-shared', allocatedQuantityTons: 10.0 }];
    const planBResult = await validateAndCalculateFarmerAllocations(dbClient, planBValidFarmers, null);
    assert.strictEqual(planBResult.validatedFarmers[0].allocatedQuantityTons, 10.0);
    dbClient.addPlan('plan-B', {
      status: 'COMMITTED',
      selectedFarmers: planBResult.validatedFarmers
    });

    // Check row locking simulation was recorded
    assert(dbClient.locks.has('list-shared'), 'Row lock must be applied to listing');
  });

  console.log('\n====================================================================');
  console.log(`TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('====================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
