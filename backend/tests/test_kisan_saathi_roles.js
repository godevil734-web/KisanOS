/**
 * Integration test for Aggregator and Buyer Kisan Saathi AI Assistant
 */
const http = require('http');

function post(path, body, token = null) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: 5001,
      path,
      method: 'POST',
      headers
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(resBody) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resBody });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runRoleTests() {
  console.log('🧪 Starting Aggregator & Buyer Kisan Saathi Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(desc, condition) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  try {
    // 1. Aggregator Authentication
    const aggLogin = await post('/api/auth/login', {
      identifier: 'aggregator@kisanconnect.in',
      password: 'password123',
      expectedRole: 'aggregator'
    });
    assert('Aggregator authenticates successfully', aggLogin.status === 200 && aggLogin.body?.token);
    const aggToken = aggLogin.body?.token;

    // 2. Aggregator Greeting / General Query
    const aggGreet = await post('/api/ai/kisan-saathi/chat', { message: 'नमस्ते' }, aggToken);
    assert('Aggregator receives 200 response with available: true', aggGreet.status === 200 && aggGreet.body?.available === true);
    assert('Aggregator receives aggregator-specific action buttons', 
      aggGreet.body?.actions?.some(a => a.tab === 'demand') &&
      aggGreet.body?.actions?.some(a => a.tab === 'supply') &&
      aggGreet.body?.actions?.some(a => a.tab === 'aggregation')
    );

    // 3. Aggregator: "Buyer Demand देखें"
    const aggDemand = await post('/api/ai/kisan-saathi/chat', { message: 'Buyer Demand देखें' }, aggToken);
    assert('Aggregator gets Buyer Demand cards with Create Procurement Plan actions',
      aggDemand.status === 200 &&
      aggDemand.body?.cards?.length > 0 &&
      aggDemand.body?.cards[0]?.actions?.some(a => a.tab === 'procurement')
    );

    // 4. Aggregator: "Farmer Supply देखें"
    const aggSupply = await post('/api/ai/kisan-saathi/chat', { message: 'Farmer Supply देखें' }, aggToken);
    assert('Aggregator gets Farmer Supply cards with Add to Batch and Create Plan actions',
      aggSupply.status === 200 &&
      aggSupply.body?.cards?.length > 0 &&
      aggSupply.body?.cards[0]?.actions?.some(a => a.tab === 'supply' || a.tab === 'procurement')
    );

    // 5. Buyer Authentication
    const buyerLogin = await post('/api/auth/login', {
      identifier: 'procurement@freshbites.com',
      password: 'password123',
      expectedRole: 'buyer'
    });
    assert('Buyer authenticates successfully', buyerLogin.status === 200 && buyerLogin.body?.token);
    const buyerToken = buyerLogin.body?.token;

    // 6. Buyer Greeting / Default Actions
    const buyerGreet = await post('/api/ai/kisan-saathi/chat', { message: 'Hello' }, buyerToken);
    assert('Buyer receives 200 with available: true and buyer actions',
      buyerGreet.status === 200 &&
      buyerGreet.body?.available === true &&
      buyerGreet.body?.actions?.some(a => a.tab === 'requirements') &&
      buyerGreet.body?.actions?.some(a => a.tab === 'supply_discovery')
    );

    // 7. Buyer Query: "मुझे 20 ton potato चाहिए"
    const buyerSearch = await post('/api/ai/kisan-saathi/chat', { message: 'मुझे 20 ton potato चाहिए' }, buyerToken);
    assert('Buyer receives supply matching cards with percentage match and Make Direct Farm Offer action',
      buyerSearch.status === 200 &&
      buyerSearch.body?.cards?.length > 0 &&
      buyerSearch.body?.cards[0]?.badge?.includes('Match') &&
      buyerSearch.body?.cards[0]?.actions?.some(a => a.label.includes('Offer'))
    );

    // 8. Buyer Query: "Procurement Status"
    const buyerStatus = await post('/api/ai/kisan-saathi/chat', { message: 'Procurement Status' }, buyerToken);
    assert('Buyer Procurement Status emphasizes that only accepted deals count toward confirmed procurement',
      buyerStatus.status === 200 &&
      (buyerStatus.body?.reply?.includes('अंतिम सौदा') || buyerStatus.body?.reply?.includes('accepted final deals'))
    );

    console.log(`\n========================================`);
    console.log(`Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runRoleTests();
