// backend/tests/test_farmer_profile_points.js
// Integration test suite for Farmer Profile, Fields, Crop Records & Kisan Points Ledger
const assert = require('assert');
const { pool } = require('../db');
const farmerProfileService = require('../services/farmerProfileService');
const kisanPointsService = require('../services/kisanPointsService');

async function runTests() {
  console.log('--- STARTING FARMER PROFILE & KISAN POINTS TEST SUITE ---');

  const testFarmerId = `usr-test-farmer-${Date.now()}`;
  const testFarmer2Id = `usr-test-farmer2-${Date.now()}`;

  try {
    // 1. Create test farmer users
    await pool.query(`
      INSERT INTO users (id, name, phone, email, role, status, verified, village, district, state)
      VALUES 
        ($1, 'Ram Kumar', '9811122334', 'ram.kumar@test.in', 'farmer', 'approved', true, 'Kishanpur', 'Agra', 'Uttar Pradesh'),
        ($2, 'Sita Devi', '9822233445', 'sita.devi@test.in', 'farmer', 'approved', true, 'Fatehpur', 'Agra', 'Uttar Pradesh')
    `, [testFarmerId, testFarmer2Id]);

    console.log('[Test 1] Initial Profile & Points Balance');
    const profile = await farmerProfileService.getFarmerProfile(testFarmerId);
    assert.strictEqual(profile.name, 'Ram Kumar');
    assert.strictEqual(profile.metrics.registeredFieldsCount, 0);
    assert.strictEqual(profile.metrics.kisanPointsBalance, 0);
    console.log('✅ Test 1 Passed: Initial profile and 0 points balance verified.');

    console.log('[Test 2] Adding Field & 20 Points Award');
    const field1 = await farmerProfileService.addFarmerField(testFarmerId, {
      name: 'North Khet #1',
      areaAcres: 3.5,
      village: 'Kishanpur',
      district: 'Agra',
      state: 'Uttar Pradesh',
      ownershipStatus: 'owned',
      irrigationSource: 'borewell',
      soilType: 'alluvial'
    });
    assert.strictEqual(field1.name, 'North Khet #1');
    assert.strictEqual(field1.areaAcres, 3.5);
    assert.strictEqual(field1.verificationStatus, 'self_declared');

    const balAfterField = await kisanPointsService.getPointsBalance(testFarmerId);
    assert.strictEqual(balAfterField, 20);
    console.log('✅ Test 2 Passed: Field added and 20 points awarded.');

    console.log('[Test 3] Points Idempotency Check');
    // Try re-awarding FIELD_ADDED with the exact same referenceId
    const retryAward = await kisanPointsService.awardPoints(
      testFarmerId,
      'FIELD_ADDED',
      field1.id,
      'Duplicate attempt'
    );
    assert.strictEqual(retryAward.awarded, false);
    assert.strictEqual(retryAward.alreadyAwarded, true);
    const balAfterRetry = await kisanPointsService.getPointsBalance(testFarmerId);
    assert.strictEqual(balAfterRetry, 20);
    console.log('✅ Test 3 Passed: Idempotency enforced, duplicate points rejected.');

    console.log('[Test 4] Adding Second Field & Total Acreage Calculation');
    const field2 = await farmerProfileService.addFarmerField(testFarmerId, {
      name: 'South Bagicha',
      areaAcres: 2.0,
      village: 'Kishanpur',
      district: 'Agra',
      state: 'Uttar Pradesh',
      ownershipStatus: 'leased',
      irrigationSource: 'canal',
      soilType: 'loamy'
    });
    const profileAfterFields = await farmerProfileService.getFarmerProfile(testFarmerId);
    assert.strictEqual(profileAfterFields.metrics.registeredFieldsCount, 2);
    assert.strictEqual(profileAfterFields.metrics.totalCultivatedAcres, 5.5);
    const balAfterField2 = await kisanPointsService.getPointsBalance(testFarmerId);
    assert.strictEqual(balAfterField2, 40); // 20 + 20
    console.log('✅ Test 4 Passed: Total acreage correctly computed as 5.5 acres (40 points).');

    console.log('[Test 5] Duplicate Field Name Prevention');
    let duplicateCaught = false;
    try {
      await farmerProfileService.addFarmerField(testFarmerId, {
        name: 'North Khet #1', // duplicate
        areaAcres: 1.0,
        village: 'Kishanpur',
        district: 'Agra',
        state: 'Uttar Pradesh'
      });
    } catch (e) {
      duplicateCaught = true;
    }
    assert.strictEqual(duplicateCaught, true);
    console.log('✅ Test 5 Passed: Duplicate field name prevented.');

    console.log('[Test 6] Logging Crop Record Associated with Field & 10 Points Award');
    const crop1 = await farmerProfileService.addFarmerCropRecord(testFarmerId, {
      fieldId: field1.id,
      cropName: 'Potato',
      variety: 'Kufri Jyoti',
      season: 'Rabi',
      sowingDate: '2026-10-15',
      expectedHarvestDate: '2027-01-20',
      estimatedYield: 150,
      yieldUnit: 'Quintals',
      actualHarvestedQuantity: 0,
      quantityForSale: 120,
      status: 'Growing'
    });
    assert.strictEqual(crop1.cropName, 'Potato');
    assert.strictEqual(crop1.fieldId, field1.id);
    assert.strictEqual(crop1.estimatedYield, 150);
    assert.strictEqual(crop1.quantityForSale, 120);

    const balAfterCrop = await kisanPointsService.getPointsBalance(testFarmerId);
    assert.strictEqual(balAfterCrop, 50); // 40 + 10
    console.log('✅ Test 6 Passed: Crop record linked to field and 10 points awarded (50 points total).');

    console.log('[Test 7] Farmer-to-Farmer Data Isolation');
    let unauthorizedEditCaught = false;
    try {
      // Farmer 2 attempts to update Farmer 1's field
      await farmerProfileService.updateFarmerField(testFarmer2Id, field1.id, {
        name: 'Hijacked Field'
      });
    } catch (e) {
      unauthorizedEditCaught = true;
    }
    assert.strictEqual(unauthorizedEditCaught, true);

    let unauthorizedDeleteCaught = false;
    try {
      // Farmer 2 attempts to delete Farmer 1's crop record
      await farmerProfileService.deleteFarmerCropRecord(testFarmer2Id, crop1.id);
    } catch (e) {
      unauthorizedDeleteCaught = true;
    }
    assert.strictEqual(unauthorizedDeleteCaught, true);
    console.log('✅ Test 7 Passed: Farmer-to-farmer data isolation strictly enforced.');

    console.log('[Test 8] Ledger Statement & Transaction History');
    const ledger = await kisanPointsService.getPointsLedger(testFarmerId);
    assert.strictEqual(ledger.length, 3); // FIELD_ADDED, FIELD_ADDED, CROP_RECORD_ADDED
    assert.strictEqual(ledger[0].points, 10);
    assert.strictEqual(ledger[1].points, 20);
    assert.strictEqual(ledger[2].points, 20);
    console.log('✅ Test 8 Passed: Ledger statement contains complete audit trail.');

    console.log('[Test 9] Completed Sale Points Integration');
    // Simulate order completion for this farmer
    const orderId = `ord-test-${Date.now()}`;
    await pool.query(`
      INSERT INTO orders (
        id, order_number, buyer_id, buyer_name, seller_id, seller_name, 
        crop_name, quantity_tons, produce_total, total_amount, status, payment_status, 
        estimated_delivery_date, created_at
      ) VALUES (
        $1, 'ORD-TEST-99', $3, 'FreshBites', $2, 'Ram Kumar',
        'Potato', 5.0, 100000, 100000, 'COMPLETED', 'RELEASED_TO_SELLER',
        '2026-10-20', NOW()
      )
    `, [orderId, testFarmerId, testFarmer2Id]);

    const salePointsRes = await kisanPointsService.checkAndAwardSalePoints(orderId);
    assert.strictEqual(salePointsRes.mainSaleAward.awarded, true);
    assert.strictEqual(salePointsRes.mainSaleAward.pointsAwarded, 50); // First sale = 50 pts

    const balAfterSale = await kisanPointsService.getPointsBalance(testFarmerId);
    // 50 (previous) + 50 (first sale) + 10 (on-time bonus) = 110
    assert.strictEqual(balAfterSale >= 100, true);
    console.log(`✅ Test 9 Passed: Verified sale completion awarded 50 first-sale points (New Balance: ${balAfterSale}).`);

    console.log('[Test 10] Trust Metrics vs Kisan Points Separation');
    const trust = await kisanPointsService.calculateFarmerTrust(testFarmerId);
    assert.strictEqual(trust.completedOrders, 1);
    assert.strictEqual(trust.totalQuantitySoldTons, 5.0);
    assert.strictEqual(trust.trustTier, 'VERIFIED_FARMER');
    assert.strictEqual(trust.trustScore > 0, true);
    console.log(`✅ Test 10 Passed: Evidence-backed trust metrics verified (Trust Score: ${trust.trustScore}, Tier: ${trust.trustTier}).`);

    console.log('🎉 ALL FARMER PROFILE & KISAN POINTS TESTS PASSED SUCCESSFULLY!');
  } finally {
    // Cleanup test data
    await pool.query(`DELETE FROM kisan_points_ledger WHERE user_id IN ($1, $2)`, [testFarmerId, testFarmer2Id]);
    await pool.query(`DELETE FROM farmer_crop_records WHERE farmer_id IN ($1, $2)`, [testFarmerId, testFarmer2Id]);
    await pool.query(`DELETE FROM farmer_fields WHERE farmer_id IN ($1, $2)`, [testFarmerId, testFarmer2Id]);
    await pool.query(`DELETE FROM orders WHERE seller_id IN ($1, $2)`, [testFarmerId, testFarmer2Id]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [testFarmerId, testFarmer2Id]);
    pool.end();
  }
}

runTests().catch(err => {
  console.error('❌ Test Suite Failed:', err);
  process.exit(1);
});
