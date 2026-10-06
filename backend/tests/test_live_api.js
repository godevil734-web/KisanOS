// backend/tests/test_live_api.js
const assert = require('assert');

async function testLiveApi() {
  console.log('Testing Live Backend API on http://localhost:5001...\n');

  // 1. Health
  const healthRes = await fetch('http://localhost:5001/api/health');
  assert.strictEqual(healthRes.status, 200, 'Health check must return 200');
  console.log('✅ 1. GET /api/health returned 200 OK');

  // 2. Nearby Buyers within 25 km of Kushinagar (26.740, 83.889)
  const nearbyRes = await fetch('http://localhost:5001/api/buyers/nearby?latitude=26.740&longitude=83.889&radiusKm=25');
  const nearbyList = await nearbyRes.json();
  const requirements = Array.isArray(nearbyList) ? nearbyList : (nearbyList.requirements || []);
  console.log(`✅ 2. GET /api/buyers/nearby (radius 25km): Found ${requirements.length} requirements.`);
  // Verify Buyer A (8 km) is in the list and Buyer B (32 km) / Buyer C (87 km) are excluded
  const hasBuyerA = requirements.some(r => r.buyerName?.includes('Local Potato Trader'));
  const hasBuyerB = requirements.some(r => r.buyerName?.includes('Deoria Agro Traders'));
  const hasBuyerC = requirements.some(r => r.buyerName?.includes('Basti Wholesale Terminal'));
  assert(hasBuyerA, 'Buyer A (~8 km) must be included within 25 km');
  assert(!hasBuyerB, 'Buyer B (~32 km) must be excluded within 25 km');
  assert(!hasBuyerC, 'Buyer C (~87 km) must be excluded within 25 km');
  console.log('   -> Distance filter accurately included Buyer A and excluded Buyers B & C.');

  // 3. Farmer A (8T) Matches
  const matchARes = await fetch('http://localhost:5001/api/matches/listing/list-farmer-a');
  const matchAData = await matchARes.json();
  const matchesA = matchAData.matches || [];
  assert(matchesA.length > 0, 'Listing A matches must return results');
  console.log(`✅ 3. GET /api/matches/listing/list-farmer-a: Found ${matchesA.length} matches.`);
  
  const localMatchA = matchesA.find(m => m.requirement.buyerType === 'local');
  assert(localMatchA, 'Farmer A must have local buyer match');
  assert.strictEqual(localMatchA.eligibility.routeType, 'direct_local', 'Local match routeType must be direct_local');

  const bulkMatchA = matchesA.find(m => m.requirement.buyerName?.includes('FreshBites'));
  assert(bulkMatchA, 'Farmer A must see FreshBites');
  assert.strictEqual(bulkMatchA.eligibility.routeType, 'aggregator_pooled', 'Farmer A 8T vs FreshBites 20T min lot must require aggregator_pooled route');
  console.log('   -> Farmer A correctly routed: direct to Local Buyer, aggregator pooled for FreshBites bulk.');

  // 4. Farmer D (20T) Matches
  const matchDRes = await fetch('http://localhost:5001/api/matches/listing/list-farmer-d');
  const matchDData = await matchDRes.json();
  const matchesD = matchDData.matches || [];
  assert(matchesD.length > 0, 'Listing D matches must return results');
  const bulkMatchD = matchesD.find(m => m.requirement.buyerName?.includes('FreshBites'));
  assert(bulkMatchD, 'Farmer D must see FreshBites');
  assert.strictEqual(bulkMatchD.eligibility.routeType, 'direct_bulk', 'Farmer D 20T matches FreshBites 20T min lot directly');
  console.log('✅ 4. GET /api/matches/listing/list-farmer-d: Farmer D (20T) qualified for direct_bulk with FreshBites.');

  // 5. Aggregator Login and Demand & Supply (Role Protected)
  const loginRes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'aggregator@kisanconnect.in',
      password: 'password123'
    })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  assert(token, 'Aggregator login must return valid JWT token');
  console.log('✅ 5. POST /api/auth/login: Authenticated demo aggregator (Kushinagar Hub).');

  const authHeaders = { 'Authorization': `Bearer ${token}` };

  const demandRes = await fetch('http://localhost:5001/api/aggregator/demand', { headers: authHeaders });
  const demandData = await demandRes.json();
  const demands = Array.isArray(demandData) ? demandData : (demandData.demands || []);
  assert(demands.length > 0, 'Aggregator demand must return results');
  console.log(`✅ 6. GET /api/aggregator/demand: Found ${demands.length} buyer demands near aggregator.`);

  const supplyRes = await fetch('http://localhost:5001/api/aggregator/supply', { headers: authHeaders });
  const supplyData = await supplyRes.json();
  const supplyLots = Array.isArray(supplyData) ? supplyData : (supplyData.supply || []);
  assert(supplyLots.length > 0, 'Aggregator supply must return results');
  const totalSupplyTons = supplyLots.reduce((sum, s) => sum + Number(s.quantityTons || 0), 0);
  console.log(`✅ 7. GET /api/aggregator/supply: Found ${supplyLots.length} farmer supply lots (${totalSupplyTons} Tons total).`);

  // 8. AI Buyer Recommendation endpoint with fallback (Auth Protected)
  const aiRes = await fetch('http://localhost:5001/api/ai/buyer-recommendation', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      listingId: 'list-farmer-a',
      cropName: 'Potato',
      quantityTons: 8.0,
      grade: 'Grade A',
      location: 'Kushinagar, UP',
      latitude: 26.820,
      longitude: 83.959,
      expectedPricePerKg: 18.5
    })
  });
  const aiData = await aiRes.json();
  assert(aiData.available !== undefined, 'AI endpoint must return available flag');
  assert(aiData.available === true || (aiData.available === false && Boolean(aiData.fallbackMessage)), 'Graceful fallback must be returned');
  console.log(`✅ 8. POST /api/ai/buyer-recommendation: Handled gracefully (AI available: ${aiData.available}).`);
  if (!aiData.available) {
    console.log(`   -> Fallback message: "${aiData.fallbackMessage}"`);
  } else {
    console.log(`   -> AI Explanation: "${aiData.explanation?.slice(0, 80)}..."`);
  }

  console.log('\n==============================================================');
  console.log('ALL LIVE API TESTS PASSED SUCCESSFULLY! 🚀');
  console.log('==============================================================');
}

testLiveApi().catch(err => {
  console.error('Live API test failed:', err);
  process.exit(1);
});
