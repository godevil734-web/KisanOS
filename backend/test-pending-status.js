const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (process.env.DB_ENV !== 'dev') {
  console.error(`Tests can only run in DEV environment (DB_ENV=dev). Current: ${process.env.DB_ENV || 'undefined'}. Aborting.`);
  process.exit(1);
}

let dbHost = 'unknown';
try {
  if (process.env.DATABASE_URL) {
    dbHost = new URL(process.env.DATABASE_URL).host;
  }
} catch (e) {}
console.log(`[TEST SUITE] Target Database Host: ${dbHost}`);

const http = require('http');

function post(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 5001,
      path: `/api${path}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(resBody) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: resBody });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5001,
      path: `/api${path}`,
      method: 'GET',
      headers
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(resBody) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: resBody });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function parseCookies(setCookieHeader) {
  if (!setCookieHeader) return '';
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return cookies.map(c => c.split(';')[0]).join('; ');
}

async function runPendingStatusTests() {
  console.log('--- STARTING ITEM 6 PENDING STATUS VERIFICATION TESTS ---');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
    }
  }

  try {
    // 1. Login with pending aggregator
    console.log('\n[1] Pending Aggregator Tests:');
    const pendingAggLogin = await post('/auth/login', {
      identifier: 'pending.agg@demo.in',
      password: 'password123',
      expectedRole: 'aggregator'
    });
    assert(pendingAggLogin.status === 200, 'Pending aggregator can log in');
    assert(pendingAggLogin.data.user.status === 'pending', 'User status is pending');
    const pendingAggCookie = parseCookies(pendingAggLogin.headers['set-cookie']);

    // Attempt to create batch as pending aggregator
    const batchAttempt = await post('/batches', {
      buyerRequirementId: 'req-1',
      buyerName: 'Demo Buyer',
      cropName: 'Potato',
      variety: 'Chipsona',
      targetQuantityTons: 10,
      buyerSalePricePerKg: 25
    }, { Cookie: pendingAggCookie });

    assert(batchAttempt.status === 403, 'Pending aggregator receives 403 when creating batch');
    assert(batchAttempt.data.error === 'ACCOUNT_PENDING_APPROVAL', 'Error code is ACCOUNT_PENDING_APPROVAL');
    assert(batchAttempt.data.message.includes('pending admin approval'), 'Error message informs user of pending status');

    // 2. Active/Approved Aggregator Tests
    console.log('\n[2] Approved Aggregator Tests:');
    const activeAggLogin = await post('/auth/login', {
      identifier: 'vikram@aggregator.in',
      password: 'password123',
      expectedRole: 'aggregator'
    });
    assert(activeAggLogin.status === 200, 'Approved aggregator logs in successfully');
    assert(activeAggLogin.data.user.status === 'active', 'User status is active');
    const activeAggCookie = parseCookies(activeAggLogin.headers['set-cookie']);

    const activeBatchAttempt = await post('/batches', {
      buyerRequirementId: 'req-active-test',
      buyerName: 'Test Buyer Ltd',
      cropName: 'Wheat',
      variety: 'Sharbati',
      targetQuantityTons: 20,
      buyerSalePricePerKg: 30
    }, { Cookie: activeAggCookie });

    assert(activeBatchAttempt.status === 201, 'Approved aggregator is permitted to create batch (201)');

    // 3. Pending Dealer Tests
    console.log('\n[3] Pending Dealer Tests:');
    const pendingDealerLogin = await post('/auth/login', {
      identifier: 'pending.dealer@demo.in',
      password: 'password123',
      expectedRole: 'dealer'
    });
    assert(pendingDealerLogin.status === 200, 'Pending dealer logs in successfully');
    assert(pendingDealerLogin.data.user.status === 'pending', 'Dealer user status is pending');
    const pendingDealerCookie = parseCookies(pendingDealerLogin.headers['set-cookie']);

    // Attempt to create requirement as pending dealer
    const reqAttempt = await post('/requirements', {
      cropName: 'Tomato',
      variety: 'Hybrid',
      quantityTons: 5,
      offeredPricePerKg: 18,
      deliveryType: 'DIRECT_FARM',
      gradeRequired: 'A',
      sizeMinMm: 30,
      sizeMaxMm: 60,
      requiredDate: '2026-10-20',
      location: 'Nashik Hub'
    }, { Cookie: pendingDealerCookie });

    assert(reqAttempt.status === 403, 'Pending dealer receives 403 when creating requirement');
    assert(reqAttempt.data.error === 'ACCOUNT_PENDING_APPROVAL', 'Error code is ACCOUNT_PENDING_APPROVAL');

    // Attempt to create offer as pending dealer
    const offerAttempt = await post('/offers', {
      requirementId: 'req-1',
      listingId: 'list-1',
      sellerId: 'farmer-1',
      sellerName: 'Ramesh',
      cropName: 'Potato',
      variety: 'Chipsona',
      quantityTons: 2,
      offeredPricePerKg: 20
    }, { Cookie: pendingDealerCookie });

    assert(offerAttempt.status === 403, 'Pending dealer receives 403 when creating offer');
    assert(offerAttempt.data.error === 'ACCOUNT_PENDING_APPROVAL', 'Offer error code is ACCOUNT_PENDING_APPROVAL');

    // 4. Approved Dealer Tests
    console.log('\n[4] Approved Dealer Tests:');
    const activeDealerLogin = await post('/auth/login', {
      identifier: 'dealer@freshbites.in',
      password: 'password123',
      expectedRole: 'dealer'
    });
    assert(activeDealerLogin.status === 200, 'Approved dealer logs in successfully');
    assert(activeDealerLogin.data.user.status === 'active', 'Dealer status is active');
    const activeDealerCookie = parseCookies(activeDealerLogin.headers['set-cookie']);

    const activeReqAttempt = await post('/requirements', {
      cropName: 'Potato',
      variety: 'Chipsona',
      quantityTons: 15,
      offeredPricePerKg: 22,
      deliveryType: 'DIRECT_FARM',
      gradeRequired: 'A',
      sizeMinMm: 45,
      sizeMaxMm: 65,
      requiredDate: '2026-10-30',
      location: 'Agra Cold Belt'
    }, { Cookie: activeDealerCookie });

    assert(activeReqAttempt.status === 201, 'Approved dealer is permitted to create requirement (201)');

    console.log(`\n========================================`);
    console.log(`TEST RESULTS: ${passed}/${total} assertions passed`);
    console.log(`========================================\n`);

    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test run failed with error:', err);
    process.exit(1);
  }
}

runPendingStatusTests();
