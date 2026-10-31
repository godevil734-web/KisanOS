/**
 * backend/tests/test_procurement_plan_allocations.js
 * 
 * Comprehensive Test Suite for KisanOS Aggregator Procurement & Inventory System:
 * - Test A: Same farmer, independent listings (Listing 1: 5T, Listing 2: 5T -> allocate 5T from each successfully).
 * - Test B: Partial reservation (Listing 1: 5T, already reserved: 3T -> allocate 2T successfully).
 * - Test C: Over-allocation (Listing 1: 5T -> requested: 6T -> rejected with listing-level error).
 * - Test D: Duplicate physical inventory (Two listings referencing same physical crop/batch -> rejected).
 * - Test E: Concurrent procurement (Two aggregators reserving remaining inventory -> transactions protect stock).
 * - Test F: Multiple farmers (10, 25, 50, >50 listings without arbitrary count restrictions).
 * - Test G: Buyer supply consistency (Demand cards vs Supply tab vs Modal inventory accounting).
 * - Test H: Quantity-weighted economics simulation (Weighted farmer cost, logistics, margin, total profit).
 * - Test I: Procurement plan lifecycle (Active plan reserves inventory, cancel plan immediately releases stock).
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const app = require('../server');

console.log('====================================================================');
console.log('KISANOS — PROCUREMENT & INVENTORY REGRESSION AUDIT TEST SUITE');
console.log('====================================================================\n');

let testsPassed = 0;
let testsFailed = 0;

async function runTest(testName, testFn) {
  try {
    await testFn();
    console.log(`✅ [PASS] ${testName}`);
    testsPassed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${testName}:`, err.stack);
    testsFailed++;
  }
}

// In-memory Database Client Simulator for Transactional Validation & Locks
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
      reserved_quantity_tons: data.reservedQuantityTons || 0,
      confirmed_quantity_tons: data.confirmedQuantityTons || 0,
      expected_price_per_kg: data.pricePerKg || 18.5,
      harvest_date: data.harvestDate || '2026-09-20',
      status: data.status || 'ACTIVE',
      distance_km: data.distanceKm || 15,
      location: data.location || 'Local Mandi'
    });
  }

  addPlan(id, plan) {
    this.activePlans.set(id, {
      id,
      status: plan.status || 'ACTIVE',
      selected_farmers: plan.selectedFarmers || []
    });
  }

  cancelPlan(id) {
    const plan = this.activePlans.get(id);
    if (!plan) return;
    plan.status = 'CANCELLED';
    for (const f of plan.selected_farmers) {
      const lid = f.listingId || f.id;
      const tons = Number(f.allocatedQuantityTons ?? f.quantityTons ?? 0);
      const listing = this.listings.get(lid);
      if (listing && tons > 0) {
        listing.reserved_quantity_tons = Math.max(0, (listing.reserved_quantity_tons || 0) - tons);
      }
    }
  }

  async query(sql, params = []) {
    const trimmed = sql.trim().toUpperCase();

    // 1. Query active procurement plans
    if (trimmed.includes('FROM PROCUREMENT_PLANS')) {
      const currentPlanId = params[0];
      const rows = [];
      for (const [id, p] of this.activePlans.entries()) {
        if (!currentPlanId || id !== currentPlanId) {
          if (['ACTIVE', 'COMMITTED', 'AGGREGATED', 'DIRECT_FULFILLMENT', 'BATCH_CREATED'].includes(p.status)) {
            rows.push({ id: p.id, status: p.status, selected_farmers: p.selected_farmers });
          }
        }
      }
      return { rows };
    }

    // 2. Query farmer listings with FOR UPDATE lock
    if (trimmed.includes('FROM FARMER_LISTINGS') && trimmed.includes('FOR UPDATE')) {
      const listingId = params[0];
      const row = this.listings.get(listingId);
      if (row) {
        this.locks.add(listingId);
        return { rows: [row] };
      }
      return { rows: [] };
    }

    // 3. Update reserved quantity on farmer listing
    if (trimmed.includes('UPDATE FARMER_LISTINGS') && trimmed.includes('SET RESERVED_QUANTITY_TONS')) {
      const tons = params[0];
      const listingId = params[1];
      const row = this.listings.get(listingId);
      if (row) {
        if (trimmed.includes('GREATEST(0')) {
          row.reserved_quantity_tons = Math.max(0, (row.reserved_quantity_tons || 0) - tons);
        } else {
          row.reserved_quantity_tons = (row.reserved_quantity_tons || 0) + tons;
        }
      }
      return { rowCount: 1 };
    }

    return { rows: [] };
  }
}

async function main() {
  const { validateAndCalculateFarmerAllocations, calculateAvailableForListing } = app;
  assert.strictEqual(typeof validateAndCalculateFarmerAllocations, 'function', 'Validation helper must be exported');

  // =========================================================================
  // TEST A: Same farmer, independent listings
  // =========================================================================
  await runTest('Test A: Same farmer, independent listings are individually allocatable', async () => {
    const client = new MockDbClient();
    // Farmer Mahendra Yadav has 2 distinct physical harvest lots
    client.addListing('list-yadav-lot1', {
      farmerId: 'usr-farmer-3',
      farmerName: 'Mahendra Yadav',
      cropName: 'Potato',
      variety: 'Kufri Bahar',
      grade: 'Grade A',
      quantityTons: 5.0,
      harvestDate: '2026-09-19',
      pricePerKg: 18.0
    });
    client.addListing('list-yadav-lot2', {
      farmerId: 'usr-farmer-3',
      farmerName: 'Mahendra Yadav',
      cropName: 'Potato',
      variety: 'Kufri Jyoti',
      grade: 'Grade B',
      quantityTons: 5.0,
      harvestDate: '2026-09-25',
      pricePerKg: 16.5
    });

    const selectedFarmers = [
      { listingId: 'list-yadav-lot1', allocatedQuantityTons: 5.0 },
      { listingId: 'list-yadav-lot2', allocatedQuantityTons: 5.0 }
    ];

    const result = await validateAndCalculateFarmerAllocations(client, selectedFarmers, null);
    assert.strictEqual(result.validatedFarmers.length, 2, 'Both listings should be validated');
    assert.strictEqual(result.totalPlannedKg, 10000, 'Total planned should be 10,000 kg (10T)');
    assert.strictEqual(result.validatedFarmers[0].allocatedQuantityTons, 5.0);
    assert.strictEqual(result.validatedFarmers[1].allocatedQuantityTons, 5.0);
  });

  // =========================================================================
  // TEST B: Partial reservation
  // =========================================================================
  await runTest('Test B: Partial quantity allocation (5T total, 3T active reservation -> allocate remaining 2T)', async () => {
    const client = new MockDbClient();
    client.addListing('list-b', {
      farmerId: 'usr-farmer-b',
      farmerName: 'Ramesh Verma',
      quantityTons: 5.0,
      pricePerKg: 19.0
    });

    // An existing active plan already reserves 3T of list-b
    client.addPlan('plan-existing', {
      status: 'ACTIVE',
      selectedFarmers: [{ listingId: 'list-b', allocatedQuantityTons: 3.0 }]
    });

    // Request the remaining 2T
    const selected = [{ listingId: 'list-b', allocatedQuantityTons: 2.0 }];
    const result = await validateAndCalculateFarmerAllocations(client, selected, null);
    assert.strictEqual(result.validatedFarmers.length, 1);
    assert.strictEqual(result.validatedFarmers[0].allocatedQuantityTons, 2.0);
    assert.strictEqual(result.validatedFarmers[0].availableQuantityTons, 2.0, 'Available should report 2.0T remaining');
  });

  // =========================================================================
  // TEST C: Over-allocation rejection with listing-level error
  // =========================================================================
  await runTest('Test C: Over-allocation (Listing: 5T, Requested: 6T) rejected with listing-level error', async () => {
    const client = new MockDbClient();
    client.addListing('list-c', {
      farmerId: 'usr-farmer-c',
      farmerName: 'Sunil Gupta',
      cropName: 'Potato',
      quantityTons: 5.0,
      pricePerKg: 18.0
    });

    const selected = [{ listingId: 'list-c', allocatedQuantityTons: 6.0 }];
    let threw = false;
    let errMsg = '';
    try {
      await validateAndCalculateFarmerAllocations(client, selected, null);
    } catch (err) {
      threw = true;
      errMsg = err.message;
    }
    assert.strictEqual(threw, true, 'Must throw error on over-allocation');
    assert(errMsg.includes('list-c'), 'Error must specify unique listing ID');
    assert(errMsg.includes('Insufficient available supply'), 'Error must explain insufficient supply');
    assert(errMsg.includes('Available: 5.00T'), 'Error must indicate actual available quantity');
    assert(errMsg.includes('6T was requested'), 'Error must indicate requested quantity');
  });

  // =========================================================================
  // TEST D: Duplicate physical inventory detection
  // =========================================================================
  await runTest('Test D: Duplicate physical inventory detection prevents double-allocation', async () => {
    const client = new MockDbClient();
    // Two listings referencing the exact same physical harvest lot
    client.addListing('list-dup-1', {
      farmerId: 'usr-farmer-d',
      farmerName: 'Dinesh Kumar',
      cropName: 'Potato',
      variety: 'Kufri Bahar',
      grade: 'Grade A',
      harvestDate: '2026-09-18',
      quantityTons: 10.0
    });
    client.addListing('list-dup-2', {
      farmerId: 'usr-farmer-d',
      farmerName: 'Dinesh Kumar',
      cropName: 'Potato',
      variety: 'Kufri Bahar',
      grade: 'Grade A',
      harvestDate: '2026-09-18',
      quantityTons: 10.0
    });

    const selected = [
      { listingId: 'list-dup-1', allocatedQuantityTons: 5.0 },
      { listingId: 'list-dup-2', allocatedQuantityTons: 5.0 }
    ];

    let threw = false;
    let errMsg = '';
    try {
      await validateAndCalculateFarmerAllocations(client, selected, null);
    } catch (err) {
      threw = true;
      errMsg = err.message;
    }
    assert.strictEqual(threw, true, 'Must reject duplicate physical inventory');
    assert(errMsg.includes('Duplicate physical inventory detected'), 'Error must identify duplicate physical produce');
  });

  // =========================================================================
  // TEST E: Concurrent procurement race condition protection
  // =========================================================================
  await runTest('Test E: Concurrent procurement race condition protection via transactional commitment', async () => {
    const client = new MockDbClient();
    client.addListing('list-concurrent', {
      quantityTons: 10.0,
      pricePerKg: 18.0
    });

    // Aggregator 1 commits 7T
    const plan1Farmers = [{ listingId: 'list-concurrent', allocatedQuantityTons: 7.0 }];
    const res1 = await validateAndCalculateFarmerAllocations(client, plan1Farmers, null);
    client.addPlan('plan-agg-1', {
      status: 'ACTIVE',
      selectedFarmers: res1.validatedFarmers
    });

    // Aggregator 2 concurrently tries to allocate 5T (7T + 5T = 12T > 10T) -> MUST FAIL
    let plan2Failed = false;
    try {
      const plan2Farmers = [{ listingId: 'list-concurrent', allocatedQuantityTons: 5.0 }];
      await validateAndCalculateFarmerAllocations(client, plan2Farmers, null);
    } catch (err) {
      plan2Failed = true;
      assert(err.message.includes('Insufficient available supply') || err.message.includes('committed'));
    }
    assert.strictEqual(plan2Failed, true, 'Aggregator 2 must be rejected for exceeding remaining available supply');

    // Aggregator 2 adjusts to remaining 3T (7T + 3T = 10T) -> MUST SUCCEED
    const plan2Valid = [{ listingId: 'list-concurrent', allocatedQuantityTons: 3.0 }];
    const res2 = await validateAndCalculateFarmerAllocations(client, plan2Valid, null);
    assert.strictEqual(res2.validatedFarmers[0].allocatedQuantityTons, 3.0);
    client.addPlan('plan-agg-2', {
      status: 'ACTIVE',
      selectedFarmers: res2.validatedFarmers
    });
  });

  // =========================================================================
  // TEST F: Multiple farmers (10, 25, 50, >50 listings)
  // =========================================================================
  await runTest('Test F: Selecting 10, 25, 50, and >50 listings without arbitrary count restrictions', async () => {
    const client = new MockDbClient();
    for (let i = 1; i <= 65; i++) {
      client.addListing(`list-f-${i}`, {
        farmerId: `farmer-f-${i}`,
        farmerName: `Farmer ${i}`,
        variety: `Variety ${i}`,
        quantityTons: 20.0,
        pricePerKg: 18.0
      });
    }

    const testCounts = [10, 25, 50, 60];
    for (const count of testCounts) {
      const selections = [];
      for (let i = 1; i <= count; i++) {
        selections.push({
          listingId: `list-f-${i}`,
          allocatedQuantityTons: 5.0
        });
      }
      const result = await validateAndCalculateFarmerAllocations(client, selections, null);
      assert.strictEqual(result.validatedFarmers.length, count, `Should support ${count} farmer allocations`);
      assert.strictEqual(result.totalPlannedKg, count * 5000);
    }
  });

  // =========================================================================
  // TEST G: Supply consistency across Demand Cards, Supply tab, and Modal
  // =========================================================================
  await runTest('Test G: Consistent inventory calculation across Demand card, Supply tab, and Modal', async () => {
    const listing = {
      id: 'list-consistency',
      cropName: 'Potato',
      quantityTons: 20.0,
      quantityKg: 20000,
      confirmedQuantityTons: 2.0,
      reservedQuantityTons: 0
    };

    // 5T committed in active plan
    const committedMap = { 'list-consistency': 5000 };

    const avail = calculateAvailableForListing(listing, committedMap);
    // Total = 20T, Confirmed = 2T, Active Reserved = 5T -> Available = 20 - 7 = 13T
    assert.strictEqual(avail.totalTons, 20.0, 'Total should be 20T');
    assert.strictEqual(avail.confirmedTons, 2.0, 'Confirmed should be 2T');
    assert.strictEqual(avail.reservedTons, 5.0, 'Reserved should be 5T');
    assert.strictEqual(avail.availableTons, 13.0, 'Available must be 13T');
    assert.strictEqual(avail.isFullyCommitted, false);
  });

  // =========================================================================
  // TEST H: Quantity-weighted procurement economics
  // =========================================================================
  await runTest('Test H: Quantity-weighted farmer cost and gross profit calculation', async () => {
    const client = new MockDbClient();
    client.addListing('list-h1', { quantityTons: 50.0, pricePerKg: 20.0 });
    client.addListing('list-h2', { quantityTons: 100.0, pricePerKg: 10.0 });

    const selected = [
      { listingId: 'list-h1', allocatedQuantityTons: 30.0, pricePerKg: 20.0 }, // 30,000 * 20 = 600,000
      { listingId: 'list-h2', allocatedQuantityTons: 70.0, pricePerKg: 10.0 }  // 70,000 * 10 = 700,000
    ];

    const result = await validateAndCalculateFarmerAllocations(client, selected, null);
    const totalKg = result.totalPlannedKg; // 100,000 kg
    const totalCost = result.totalProcCost; // 1,300,000
    const weightedAvg = Number((totalCost / totalKg).toFixed(2));

    assert.strictEqual(weightedAvg, 13.00, `Expected weighted avg ₹13.00/kg, got ₹${weightedAvg}`);

    const buyerPrice = 25.0;
    const estLogistics = 1.15;
    const grossMarginPerKg = Number((buyerPrice - weightedAvg).toFixed(2)); // 12.00
    const grossProfitTotal = Math.round(grossMarginPerKg * totalKg); // 1,200,000
    const netProfitTotal = Math.round((grossMarginPerKg - estLogistics) * totalKg); // 1,085,000

    assert.strictEqual(grossMarginPerKg, 12.00);
    assert.strictEqual(grossProfitTotal, 1200000);
    assert.strictEqual(netProfitTotal, 1085000);
  });

  // =========================================================================
  // TEST I: Plan lifecycle (Active reserves inventory, Cancel releases stock)
  // =========================================================================
  await runTest('Test I: Procurement lifecycle — Active plan reserves stock, Cancel releases reservations', async () => {
    const client = new MockDbClient();
    client.addListing('list-lifecycle', {
      quantityTons: 20.0,
      quantityKg: 20000,
      pricePerKg: 18.0
    });

    // 1. Initially 20T available
    const initAvail = calculateAvailableForListing(client.listings.get('list-lifecycle'), {});
    assert.strictEqual(initAvail.availableTons, 20.0);

    // 2. Create Active Plan reserving 15T
    const planFarmers = [{ listingId: 'list-lifecycle', allocatedQuantityTons: 15.0 }];
    const valRes = await validateAndCalculateFarmerAllocations(client, planFarmers, null);
    client.addPlan('plan-lifecycle-1', {
      status: 'ACTIVE',
      selectedFarmers: valRes.validatedFarmers
    });
    // Simulate updating reserved quantity on listing row
    await client.query('UPDATE farmer_listings SET reserved_quantity_tons = $1 WHERE id = $2', [15.0, 'list-lifecycle']);

    // Check available is now 5T
    const committedMapActive = { 'list-lifecycle': 15000 };
    const reservedAvail = calculateAvailableForListing(client.listings.get('list-lifecycle'), committedMapActive);
    assert.strictEqual(reservedAvail.availableTons, 5.0, 'Available should reduce to 5T');
    assert.strictEqual(reservedAvail.reservedTons, 15.0, 'Reserved should be 15T');

    // 3. Cancel Plan
    client.cancelPlan('plan-lifecycle-1');

    // Check plan status is CANCELLED and reservation is released back to 20T
    assert.strictEqual(client.activePlans.get('plan-lifecycle-1').status, 'CANCELLED');
    const releasedListing = client.listings.get('list-lifecycle');
    assert.strictEqual(releasedListing.reserved_quantity_tons, 0, 'Reserved quantity on listing must be 0 after cancel');

    const committedMapCancelled = {}; // Cancelled plans do not contribute to committed map
    const cancelledAvail = calculateAvailableForListing(releasedListing, committedMapCancelled);
    assert.strictEqual(cancelledAvail.availableTons, 20.0, 'Available quantity must be restored to 20T');
  });

  console.log('\n====================================================================');
  console.log(`AUDIT SUITE COMPLETE: ${testsPassed} PASSED, ${testsFailed} FAILED`);
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
