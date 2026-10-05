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

async function runTests() {
  console.log('--- STARTING PART C VERIFICATION TESTS ---');
  let passed = 0;
  let total = 0;

  function assert(desc, condition) {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
    }
  }

  // Test 1: Send OTP to farmer
  const otpRes = await post('/auth/otp/send', { phone: '9876543210' });
  assert('Farmer Send OTP succeeds and returns demoOtp in dev mode', otpRes.status === 200 && otpRes.data.demoOtp === '123456');

  // Test 2: Verify OTP with expectedRole 'farmer'
  const verifyRes = await post('/auth/otp/verify', { phone: '9876543210', code: '123456', expectedRole: 'farmer' });
  assert('Farmer OTP verify returns valid token and user role', verifyRes.status === 200 && verifyRes.data.token && verifyRes.data.user.role === 'farmer');
  const farmerCookie = (verifyRes.headers['set-cookie'] || []).join('; ');
  assert('Farmer OTP verify sets httpOnly kc_session cookie', farmerCookie.includes('kc_session=') && farmerCookie.includes('HttpOnly'));

  // Test 3: Role mismatch rejection when farmer phone is used on aggregator tab
  const mismatchOtpRes = await post('/auth/login', { identifier: '9876543210', password: 'password123', expectedRole: 'aggregator' });
  assert('Server rejects farmer logging in under aggregator tab with ROLE_MISMATCH', mismatchOtpRes.status === 400 && mismatchOtpRes.data.error === 'ROLE_MISMATCH');

  // Test 4: Business login for Aggregator
  const aggLogin = await post('/auth/login', { identifier: 'vikram@aggregator.in', password: 'password123', expectedRole: 'aggregator' });
  assert('Aggregator password login succeeds', aggLogin.status === 200 && aggLogin.data.user.role === 'aggregator');

  // Test 5: Business login for Dealer
  const dealerLogin = await post('/auth/login', { identifier: 'dealer@freshbites.in', password: 'password123', expectedRole: 'dealer' });
  assert('Dealer password login succeeds', dealerLogin.status === 200 && dealerLogin.data.user.role === 'dealer');

  // Test 6: Business login wrong role rejection
  const wrongRoleBusiness = await post('/auth/login', { identifier: 'vikram@aggregator.in', password: 'password123', expectedRole: 'dealer' });
  assert('Server rejects aggregator logging in under dealer tab with ROLE_MISMATCH', wrongRoleBusiness.status === 400 && wrongRoleBusiness.data.error === 'ROLE_MISMATCH');

  // Test 7: Verify pending account status
  const pendingLogin = await post('/auth/login', { identifier: 'pending.agg@demo.in', password: 'password123', expectedRole: 'aggregator' });
  assert('Pending account status is preserved as pending', pendingLogin.status === 200 && pendingLogin.data.user.status === 'pending');

  // Test 8: Auth session check via /auth/me with cookie
  const tokenMatch = farmerCookie.match(/kc_session=([^;]+)/);
  const clientCookieHeader = tokenMatch ? `kc_session=${tokenMatch[1]}` : farmerCookie;
  const meRes = await get('/auth/me', { Cookie: clientCookieHeader });
  assert('/auth/me returns authenticated farmer user from cookie', meRes.status === 200 && meRes.data.user.name.includes('Ramesh Kumar'));

  // Test 9: Logout clears cookie
  const logoutRes = await post('/auth/logout', {});
  const clearCookie = (logoutRes.headers['set-cookie'] || []).join('; ');
  assert('/auth/logout clears kc_session cookie', clearCookie.includes('kc_session=;'));

  console.log(`\nResults: ${passed}/${total} tests passed.`);
  process.exit(passed === total ? 0 : 1);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
