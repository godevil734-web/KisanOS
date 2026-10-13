/**
 * Test Suite for Real Government Mandi Prices API
 */
const assert = require('assert');
const { getMandiLocations, getMandiPrices } = require('../services/mandiService');

async function runMandiTests() {
  console.log('--- STARTING MANDI PRICES TEST SUITE ---');

  // Test 1: Fetch Mandi Locations
  console.log('\n[Test 1] Fetching official Mandi Locations (States & Districts)...');
  const locations = await getMandiLocations();
  assert(Array.isArray(locations), 'Locations must be an array');
  assert(locations.length >= 10, 'Should return all major Indian states');
  const up = locations.find(s => s.state_name.toLowerCase().includes('uttar pradesh'));
  assert(up, 'Uttar Pradesh must exist in locations');
  assert(up.districts.length > 20, 'UP should have all districts listed');
  console.log('✅ Test 1 Passed: Loaded', locations.length, 'states and all districts.');

  // Test 2: Fetch Live Mandi Prices for Uttar Pradesh
  console.log('\n[Test 2] Fetching real government mandi prices for Uttar Pradesh...');
  const upPrices = await getMandiPrices({ state: 'Uttar Pradesh', district: 'all' });
  assert.strictEqual(upPrices.success, true, 'API response must indicate success');
  assert(upPrices.source, 'Response must attribute official government source');
  assert(upPrices.totalRecords > 0, 'Must contain real trading records');
  assert(upPrices.commoditySummaries.length > 0, 'Must contain commodity summaries');
  console.log('✅ Test 2 Passed: Fetched', upPrices.totalRecords, 'real records from', upPrices.source);

  // Test 3: Fetch Mandi Prices for specific District (Agra)
  console.log('\n[Test 3] Fetching real government mandi prices for Agra district...');
  const agraPrices = await getMandiPrices({ state: 'Uttar Pradesh', district: 'Agra' });
  assert.strictEqual(agraPrices.success, true);
  assert(agraPrices.records.length > 0, 'Agra must have mandi records');
  assert(agraPrices.records.every(r => r.state && r.market && r.commodity), 'Every record must have state, market, commodity');
  assert(agraPrices.records.every(r => typeof r.modalPrice === 'number'), 'Modal price must be numeric');
  console.log('✅ Test 3 Passed: Successfully filtered Agra with', agraPrices.records.length, 'records across', agraPrices.distinctCommoditiesCount, 'commodities.');

  // Test 4: Filter by Commodity (Potato)
  console.log('\n[Test 4] Filtering by Commodity (Potato)...');
  const potatoPrices = await getMandiPrices({ state: 'Uttar Pradesh', district: 'Agra', commodity: 'Potato' });
  assert.strictEqual(potatoPrices.success, true);
  assert(potatoPrices.records.every(r => r.commodity.toLowerCase().includes('potato')), 'All records must match commodity filter');
  console.log('✅ Test 4 Passed: Potato filter returned', potatoPrices.records.length, 'matching records.');

  // Test 5: Cache hit vs Cache refresh bypass
  console.log('\n[Test 5] Testing cache hit and force refresh bypass...');
  const cachedCall = await getMandiPrices({ state: 'Uttar Pradesh', district: 'Agra', commodity: 'Potato' });
  assert.strictEqual(cachedCall.cacheStatus, 'HIT', 'Second call should be cache HIT');
  assert(cachedCall.cacheAgeSeconds >= 0, 'Cache age should be reported');

  const refreshedCall = await getMandiPrices({ state: 'Uttar Pradesh', district: 'Agra', commodity: 'Potato', refresh: true });
  assert.strictEqual(refreshedCall.cacheStatus, 'BYPASS', 'Refresh call should BYPASS cache');
  console.log('✅ Test 5 Passed: Verified cache HIT and force refresh BYPASS.');

  // Test 6: Error handling when invalid state is supplied
  console.log('\n[Test 6] Testing error handling for invalid input...');
  let caughtError = false;
  try {
    await getMandiPrices({ state: '' });
  } catch (err) {
    caughtError = true;
    assert(err.message.includes('State is required'), 'Should throw state required error');
  }
  assert.strictEqual(caughtError, true, 'Invalid input must throw validation error');
  console.log('✅ Test 6 Passed: Error handling verified.');

  console.log('\n🎉 ALL MANDI PRICES BACKEND TESTS PASSED SUCCESSFULLY!');
}

runMandiTests().catch(err => {
  console.error('❌ Mandi Prices Test Suite FAILED:', err);
  process.exit(1);
});
