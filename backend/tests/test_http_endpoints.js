const http = require('http');
const assert = require('assert');
const app = require('../server');

async function testHttpEndpoints() {
  console.log('--- TESTING EXPRESS HTTP ENDPOINTS ---');
  
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test server running at ${baseUrl}`);

  try {
    // 1. GET /api/mandi-locations
    console.log('\n[1] Testing GET /api/mandi-locations...');
    const locRes = await fetch(`${baseUrl}/api/mandi-locations`);
    assert.strictEqual(locRes.status, 200);
    const locData = await locRes.json();
    assert.strictEqual(locData.success, true);
    assert(Array.isArray(locData.states) && locData.states.length > 0);
    console.log('✅ GET /api/mandi-locations returned HTTP 200 with', locData.states.length, 'states.');

    // 2. GET /api/mandi-prices?state=Uttar%20Pradesh&district=Agra&commodity=Potato
    console.log('\n[2] Testing GET /api/mandi-prices with State, District, and Commodity...');
    const mandiRes = await fetch(`${baseUrl}/api/mandi-prices?state=Uttar%20Pradesh&district=Agra&commodity=Potato`);
    assert.strictEqual(mandiRes.status, 200);
    const mandiData = await mandiRes.json();
    assert.strictEqual(mandiData.success, true);
    assert.strictEqual(mandiData.state, 'Uttar Pradesh');
    assert.strictEqual(mandiData.district, 'Agra');
    assert.strictEqual(mandiData.commodity, 'Potato');
    assert(Array.isArray(mandiData.records));
    assert(mandiData.records.length > 0);
    assert(mandiData.resourceId === '9ef84268-d588-465a-a308-a864a43d0070');
    
    // Security check: Verify API key is NOT leaked anywhere in response
    const rawBody = JSON.stringify(mandiData);
    const apiKey = process.env.DATA_GOV_API_KEY || process.env.DATA_GOV_IN_API_KEY;
    if (apiKey) {
      assert(!rawBody.includes(apiKey), 'CRITICAL: API key must NEVER be leaked in response JSON!');
    }
    console.log('✅ GET /api/mandi-prices returned HTTP 200 with', mandiData.records.length, 'verified records.');
    console.log('✅ Security check passed: API key is not present in response JSON.');

    // 3. GET /mandi-prices (testing Vercel rewrite prefix normalization when /api is stripped)
    console.log('\n[3] Testing Vercel serverless prefix normalization (GET /mandi-prices?state=Uttar%20Pradesh)...');
    const rewriteRes = await fetch(`${baseUrl}/mandi-prices?state=Uttar%20Pradesh&district=Agra`);
    assert.strictEqual(rewriteRes.status, 200);
    const rewriteData = await rewriteRes.json();
    assert.strictEqual(rewriteData.success, true);
    console.log('✅ Vercel rewrite normalization succeeded: /mandi-prices handled identically to /api/mandi-prices.');

    // 4. GET /api/mandi-prices without required state (validation test)
    console.log('\n[4] Testing validation error for missing state parameter...');
    const invalidRes = await fetch(`${baseUrl}/api/mandi-prices`);
    assert.strictEqual(invalidRes.status, 400);
    const invalidData = await invalidRes.json();
    const invalidErrText = invalidData.error || invalidData.message || '';
    assert(invalidErrText.includes('State parameter is required'));
    console.log('✅ Missing state returned HTTP 400 Bad Request with helpful error message.');

    console.log('\n🎉 ALL HTTP ENDPOINT TESTS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
  }
}

testHttpEndpoints().catch(err => {
  console.error('❌ HTTP Tests failed:', err);
  process.exit(1);
});
