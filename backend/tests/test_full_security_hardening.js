// backend/tests/test_full_security_hardening.js
// Comprehensive Security Test Suite for KisanConnect
// Tests:
// 1. Helmet & Content Security Policy (CSP) Headers
// 2. Request Input Sanitization (XSS, Script Tags, Event Handlers, Null Bytes)
// 3. Password Complexity Enforcement
// 4. Brute Force Protection & Account Lockout
// 5. Insecure Direct Object Reference (IDOR) & Role Authorization
// 6. Data Privacy & Sensitive PII Redaction
// 7. Production Error Handling & Information Leakage Prevention

const http = require('http');
const assert = require('assert');
const app = require('../server');
const { resetLockoutStore } = require('../middleware/security');

let server;
let baseUrl;

function post(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`${baseUrl}${path}`, {
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

function put(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`${baseUrl}${path}`, {
      method: 'PUT',
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
    const req = http.request(`${baseUrl}${path}`, {
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

async function runAllSecurityTests() {
  console.log('===============================================================');
  console.log('  STARTING KISANCONNECT FULL-STACK SECURITY HARDENING TEST SUITE');
  console.log('===============================================================\n');

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let total = 0;

  function testAssert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
    }
  }

  try {
    resetLockoutStore();

    // =========================================================================
    // PILLAR 1: HELMET SECURITY HEADERS & CSP
    // =========================================================================
    console.log('[PILLAR 1] Testing Helmet Security Headers & CSP...');
    const healthRes = await get('/api/health');
    testAssert(healthRes.status === 200, 'GET /api/health responds with 200');
    
    const h = healthRes.headers;
    testAssert(h['x-content-type-options'] === 'nosniff', 'Header X-Content-Type-Options: nosniff is set');
    testAssert(h['x-frame-options'] === 'DENY', 'Header X-Frame-Options: DENY is set');
    testAssert(h['x-dns-prefetch-control'] === 'off', 'Header X-DNS-Prefetch-Control: off is set');
    testAssert(h['x-download-options'] === 'noopen', 'Header X-Download-Options: noopen is set');
    testAssert(typeof h['content-security-policy'] === 'string' && h['content-security-policy'].includes("default-src 'self'"), 'Content Security Policy (CSP) header is strictly configured');
    testAssert(typeof h['strict-transport-security'] === 'string', 'Strict-Transport-Security (HSTS) header is set');

    // =========================================================================
    // PILLAR 2: INPUT SANITIZATION (XSS & SCRIPT INJECTION)
    // =========================================================================
    console.log('\n[PILLAR 2] Testing Input Sanitization (XSS, Script Injections & Null Bytes)...');
    
    // Log in as farmer using verified demo phone
    const farmerPhone = '9876543212';
    await post('/api/auth/otp/send', { phone: farmerPhone });
    const farmerLogin = await post('/api/auth/otp/verify', { phone: farmerPhone, code: '123456' });
    testAssert(farmerLogin.status === 200, 'Farmer authenticated successfully for test');
    const farmerCookie = parseCookies(farmerLogin.headers['set-cookie']);

    // Attempt to post listing with XSS script and inline event handler
    const xssListing = await post('/api/listings', {
      cropName: 'Potato<script>alert("xss")</script>',
      variety: 'Kufri<img src="x" onerror="alert(1)">',
      quantityTons: 5,
      expectedPricePerKg: 20,
      notes: 'Safe notes\0with null byte'
    }, { Cookie: farmerCookie });

    testAssert(xssListing.status === 201, 'POST /api/listings accepts request with sanitized fields');
    if (xssListing.status === 201 && xssListing.data) {
      testAssert(!xssListing.data.cropName.includes('<script>'), 'Script tag stripped from cropName');
      testAssert(!xssListing.data.variety.includes('onerror'), 'onerror event handler stripped from variety');
    }

    // =========================================================================
    // PILLAR 3: PASSWORD COMPLEXITY ENFORCEMENT
    // =========================================================================
    console.log('\n[PILLAR 3] Testing Password Complexity Policy...');
    
    // Test 3.1: Password too short (<8 chars)
    const shortPassRes = await post('/api/auth/signup/business', {
      role: 'dealer',
      businessName: 'Agro Test Trade',
      contactPerson: 'Suresh Kumar',
      mobile: '9811122233',
      email: 'suresh.short@testagro.com',
      password: 'short'
    });
    testAssert(shortPassRes.status === 400, 'Signup with short password (<8 chars) is rejected (400)');
    testAssert(shortPassRes.data.error.includes('8 characters'), 'Error specifies minimum 8 characters requirement');

    // Test 3.2: Password without numbers or symbols
    const weakLettersOnlyRes = await post('/api/auth/signup/business', {
      role: 'dealer',
      businessName: 'Agro Test Trade',
      contactPerson: 'Suresh Kumar',
      mobile: '9811122233',
      email: 'suresh.weak@testagro.com',
      password: 'onlylettersnopass'
    });
    testAssert(weakLettersOnlyRes.status === 400, 'Signup with password missing numbers/symbols is rejected (400)');

    // Test 3.3: Common dictionary password
    const commonPassRes = await post('/api/auth/signup/business', {
      role: 'dealer',
      businessName: 'Agro Test Trade',
      contactPerson: 'Suresh Kumar',
      mobile: '9811122233',
      email: 'suresh.common@testagro.com',
      password: 'password123'
    });
    testAssert(commonPassRes.status === 400, 'Signup with common dictionary password is rejected (400)');

    // =========================================================================
    // PILLAR 4: BRUTE FORCE MITIGATION & ACCOUNT LOCKOUT
    // =========================================================================
    console.log('\n[PILLAR 4] Testing Brute Force Mitigation & Account Lockout...');
    resetLockoutStore();

    const targetAccount = 'procurement@freshbites.com';
    let lockoutTriggered = false;

    // Send 5 consecutive wrong password attempts
    for (let i = 1; i <= 5; i++) {
      const failRes = await post('/api/auth/login', {
        identifier: targetAccount,
        password: `WrongPassAttempt#${i}`,
        expectedRole: 'dealer'
      });
      if (failRes.status === 423) {
        lockoutTriggered = true;
        testAssert(failRes.data.error === 'ACCOUNT_TEMPORARILY_LOCKED', `Account lockout activated on attempt #${i}`);
        testAssert(failRes.headers['retry-after'] !== undefined, 'Retry-After response header is provided');
        break;
      }
    }

    testAssert(lockoutTriggered, 'Account is locked after 5 consecutive failed login attempts');

    // Subsequent attempt during lockout window must immediately return 423
    const blockedRes = await post('/api/auth/login', {
      identifier: targetAccount,
      password: 'password123', // even with correct password, locked out!
      expectedRole: 'dealer'
    });
    testAssert(blockedRes.status === 423, 'Subsequent login attempt while locked returns HTTP 423 Locked');

    // Reset lockout for clean slate
    resetLockoutStore();

    // =========================================================================
    // PILLAR 5: IDOR & ROLE-BASED ACCESS CONTROL (RBAC)
    // =========================================================================
    console.log('\n[PILLAR 5] Testing IDOR & Role-Based Access Control...');

    // 5.1: Non-admin trying to update a field belonging to another user ID
    const fakeFieldId = 'fld-someone-elses-field';
    const idorFieldUpdate = await put(`/api/farmer/fields/${fakeFieldId}`, {
      name: 'Hacked Field Name'
    }, { Cookie: farmerCookie });
    testAssert(idorFieldUpdate.status === 400 || idorFieldUpdate.status === 403 || idorFieldUpdate.status === 404, 'Unauthorized field update across users is blocked');

    // 5.2: Role enforcement: Farmer cannot create buyer requirements
    const farmerAsDealer = await post('/api/requirements', {
      cropName: 'Potato',
      quantityTons: 10,
      offeredPricePerKg: 20
    }, { Cookie: farmerCookie });
    testAssert(farmerAsDealer.status === 403, 'Farmer role cannot invoke buyer requirements endpoint (403 Forbidden)');

    // =========================================================================
    // PILLAR 6: SENSITIVE DATA REDACTION & PII PRIVACY
    // =========================================================================
    console.log('\n[PILLAR 6] Testing Data Privacy & Sensitive PII Redaction...');

    // 6.1: Public listings endpoint must never expose farmer phone numbers
    const publicListingsRes = await get('/api/listings');
    testAssert(publicListingsRes.status === 200, 'Public GET /api/listings succeeds');
    if (Array.isArray(publicListingsRes.data) && publicListingsRes.data.length > 0) {
      const exposedPhone = publicListingsRes.data.some(l => l.farmerPhone !== undefined);
      testAssert(!exposedPhone, 'Farmer phone numbers are completely redacted from public listings');
    }

    // 6.2: User profile view must never return password hash or internal auth tokens
    const profileRes = await get('/api/farmer/profile', { Cookie: farmerCookie });
    testAssert(profileRes.status === 200, 'GET /api/farmer/profile succeeds');
    if (profileRes.status === 200 && profileRes.data) {
      const userObj = profileRes.data.user || profileRes.data.profile || profileRes.data;
      testAssert(userObj.password === undefined, 'Password hash is completely excluded from profile response');
      testAssert(userObj.password_hash === undefined, 'password_hash is completely excluded');
    }

    // =========================================================================
    // PILLAR 7: PRODUCTION ERROR HANDLING & STACK LEAKAGE
    // =========================================================================
    console.log('\n[PILLAR 7] Testing Centralized Safe Error Handling...');

    // Invalid JSON body triggers safe JSON error without server stack dump
    await new Promise((resolve) => {
      const payload = '{ "malformed": ';
      const rawReq = http.request(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          testAssert(res.statusCode === 400 || res.statusCode === 500, 'Malformed JSON handled gracefully with safe error status');
          testAssert(!body.includes('at Module._compile') && !body.includes('node:internal'), 'Internal stack trace is not leaked in response body');
          resolve();
        });
      });
      rawReq.on('error', resolve);
      rawReq.write(payload);
      rawReq.end();
    });

    // Summary
    console.log('\n===============================================================');
    console.log(`  SECURITY TEST SUITE RESULTS: ${passed}/${total} assertions passed`);
    console.log('===============================================================\n');

    server.close();
    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Security test runner encountered unexpected error:', err);
    if (server) server.close();
    process.exit(1);
  }
}

runAllSecurityTests();
