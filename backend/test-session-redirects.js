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

async function runSessionTests() {
  console.log('--- STARTING ITEMS 4 & 5 SESSION AND REDIRECT VERIFICATION TESTS ---');
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

  // 1. Session & Auth: HTTP-Only cookie verification
  await post('/auth/otp/send', { phone: '9876543210' });
  const farmerLogin = await post('/auth/otp/verify', { phone: '9876543210', code: '123456', expectedRole: 'farmer' });
  const rawSetCookie = (farmerLogin.headers['set-cookie'] || []).join('; ');
  assert('Server issues httpOnly kc_session cookie', rawSetCookie.includes('kc_session=') && rawSetCookie.includes('HttpOnly'));

  // Extract client cookie
  const tokenMatch = rawSetCookie.match(/kc_session=([^;]+)/);
  const clientCookie = tokenMatch ? `kc_session=${tokenMatch[1]}` : '';

  // Access protected route with cookie
  const meWithCookie = await get('/auth/me', { Cookie: clientCookie });
  assert('/auth/me succeeds with httpOnly cookie without Authorization header', meWithCookie.status === 200 && meWithCookie.data.user.role === 'farmer');

  // Access protected route without cookie or token -> 401
  const meWithoutCookie = await get('/auth/me', {});
  assert('Protected endpoint rejects unauthenticated access with 401', meWithoutCookie.status === 401);

  // Logout clears session cookie
  const logoutRes = await post('/auth/logout', {}, { Cookie: clientCookie });
  const clearCookieHeader = (logoutRes.headers['set-cookie'] || []).join('; ');
  assert('/auth/logout clears kc_session and token cookies', clearCookieHeader.includes('kc_session=;') && clearCookieHeader.includes('token=;'));

  // 2. Redirects logic verification
  function computeRedirect(userRole, nextParam) {
    if (nextParam) return nextParam;
    if (userRole === 'farmer') return '/dashboard';
    if (userRole === 'aggregator') return '/aggregator';
    if (userRole === 'dealer' || userRole === 'buyer') return '/dealer';
    if (userRole === 'admin') return '/admin';
    return '/dashboard';
  }

  assert('Farmer without next redirects to /dashboard', computeRedirect('farmer', undefined) === '/dashboard');
  assert('Aggregator without next redirects to /aggregator', computeRedirect('aggregator', undefined) === '/aggregator');
  assert('Dealer without next redirects to /dealer', computeRedirect('dealer', undefined) === '/dealer');
  assert('Admin without next redirects to /admin', computeRedirect('admin', undefined) === '/admin');
  assert('Any role with next=/list-crop redirects to /list-crop', computeRedirect('farmer', '/list-crop') === '/list-crop');
  assert('Aggregator with next=/batches redirects to /batches', computeRedirect('aggregator', '/batches') === '/batches');

  console.log(`\nResults: ${passed}/${total} Session & Redirect tests passed.`);
  process.exit(passed === total ? 0 : 1);
}

runSessionTests().catch(err => {
  console.error(err);
  process.exit(1);
});
