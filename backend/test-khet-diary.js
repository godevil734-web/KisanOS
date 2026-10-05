const http = require('http');
const { getHyperlocalWeather } = require('./services/weatherService');
const { db } = require('./db');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 5001,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resBody) });
        } catch {
          resolve({ status: res.statusCode, data: resBody });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runDiaryTests() {
  console.log('--- STARTING KHET DIARY & AUTOMATED WEATHER TEST SUITE ---');
  let passed = 0;
  let total = 0;

  function assert(condition, desc) {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
    }
  }

  try {
    // 1. Weather Service test
    const weather = await getHyperlocalWeather(27.1767, 78.0081);
    assert(typeof weather.temperature === 'number', 'Weather service returns numeric temperature');
    assert(typeof weather.humidity === 'number', 'Weather service returns numeric humidity');
    assert(typeof weather.soilMoisture === 'number', 'Weather service returns soil moisture benchmark');

    // 2. Log in as Admin to test authenticated activity creation
    const loginRes = await request('POST', '/auth/login', {
      identifier: 'godevil344@gmail.com',
      password: 'Aryan@123',
      expectedRole: 'admin'
    });
    assert(loginRes.status === 200, 'Admin login succeeds');
    const token = loginRes.data.token;

    // 3. Test 1-Tap Field Diary Logging (Zero manual weather or BBCH required)
    const logRes = await request('POST', '/activities', {
      typeUri: 'irrigation',
      notes: '2 घंटे ड्रिप से पानी दिया'
    }, token);

    assert(logRes.status === 201, '1-Tap Khet Diary entry created (HTTP 201)');
    assert(logRes.data.bbchStage && logRes.data.bbchStage.includes('BBCH 40'), 'BBCH stage automatically mapped to BBCH 40');
    assert(logRes.data.conditions && typeof logRes.data.conditions.temperature === 'number', 'Weather conditions automatically populated');
    assert(logRes.data.name.includes('सिंचाई'), 'Default Hindi designation auto-assigned');

    // 4. Test 1-Tap Harvesting Logging
    const harvestRes = await request('POST', '/activities', {
      typeUri: 'harvesting',
      notes: 'आलू की खुदाई पूरी हुई'
    }, token);
    assert(harvestRes.status === 201, '1-Tap Harvest entry created (HTTP 201)');
    assert(harvestRes.data.bbchStage && harvestRes.data.bbchStage.includes('BBCH 99'), 'Harvest mapped to BBCH 99');

    // 5. Test Standard Manifest
    const manifestRes = await request('GET', '/activities/standards/nalamki-manifest');
    assert(manifestRes.status === 200 && manifestRes.data.status === 'ACTIVE_CONFORMANT', 'NaLamKI ITU-T standard manifest compliant');

    // 6. Test Listing Traceability Passport compiler
    const listings = await db.find('farmerListings');
    if (listings.length > 0) {
      const traceRes = await request('GET', `/listings/${listings[0].id}/traceability`);
      assert(traceRes.status === 200, 'Digital Traceability Passport generated successfully');
      assert(typeof traceRes.data.complianceMetrics === 'object', 'Traceability passport includes compliance metrics');
    }

    console.log(`\n========================================`);
    console.log(`KHET DIARY TESTS: ${passed}/${total} PASSED`);
    console.log(`========================================`);

    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

runDiaryTests();
