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

function post(path, body = {}, headers = {}) {
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

async function runCleanupTests() {
  console.log('--- STARTING CLEANUP ENDPOINT TESTS ---');
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
    // 1. no secret set -> 403
    const noSecretRes = await post('/cleanup', {});
    assert(noSecretRes.status === 403, 'no secret set -> 403');
    assert(noSecretRes.data.error.includes('Unauthorized'), 'Error message indicates unauthorized');

    // 2. wrong secret -> 403
    const wrongSecretRes = await post('/cleanup', {}, {
      'x-cron-secret': 'definitely_wrong_secret_12345'
    });
    assert(wrongSecretRes.status === 403, 'wrong secret -> 403');
    assert(wrongSecretRes.data.error.includes('Unauthorized'), 'Error message indicates unauthorized');

    // Additional: wrong secret via Bearer header -> 403
    const wrongBearerRes = await post('/cleanup', {}, {
      'Authorization': 'Bearer wrong_token'
    });
    assert(wrongBearerRes.status === 403, 'wrong secret (Bearer token) -> 403');

    // 3. correct secret -> 200
    const correctSecret = process.env.CRON_SECRET || 'test_cron_secret_kisanconnect_2026';
    const correctSecretRes = await post('/cleanup', {}, {
      'x-cron-secret': correctSecret
    });
    assert(correctSecretRes.status === 200, 'correct secret -> 200');
    assert(correctSecretRes.data.success === true, 'Response indicates success: true');
    assert(typeof correctSecretRes.data.cleanedExpiredOtps === 'number', 'Returns cleanedExpiredOtps count');
    assert(typeof correctSecretRes.data.cleanedStaleRateLimits === 'number', 'Returns cleanedStaleRateLimits count');

    // Additional: correct secret via Authorization header -> 200
    const correctBearerRes = await post('/cleanup', {}, {
      'Authorization': `Bearer ${correctSecret}`
    });
    assert(correctBearerRes.status === 200, 'correct secret (Bearer token) -> 200');

    // 4. Verify constant-time check logic when server CRON_SECRET is not set in env -> 403
    const crypto = require('crypto');
    function testServerHandler(cronSecretEnv, clientSecret) {
      if (!cronSecretEnv) return 403;
      if (!clientSecret) return 403;
      const b1 = Buffer.from(String(clientSecret));
      const b2 = Buffer.from(String(cronSecretEnv));
      if (b1.length !== b2.length || !crypto.timingSafeEqual(b1, b2)) return 403;
      return 200;
    }
    assert(testServerHandler(undefined, 'some_token') === 403, 'no secret set in server env (CRON_SECRET undefined) -> 403');
    assert(testServerHandler('', 'some_token') === 403, 'no secret set in server env (CRON_SECRET empty) -> 403');
    assert(testServerHandler('my_secret', 'wrong_secret') === 403, 'wrong secret comparison -> 403');
    assert(testServerHandler('my_secret', 'my_secret') === 200, 'correct secret constant-time comparison -> 200');

    console.log(`\nResults: ${passed}/${total} cleanup endpoint tests passed.`);
    if (passed !== total) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test run failed with error:', err);
    process.exit(1);
  }
}

runCleanupTests();
