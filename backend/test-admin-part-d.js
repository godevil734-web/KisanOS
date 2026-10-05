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
console.log(`[TEST SUITE: PART D ADMIN UPGRADES] Target Database Host: ${dbHost}`);

const http = require('http');

function parseCookies(setCookieHeader) {
  if (!setCookieHeader) return '';
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return cookies.map(c => c.split(';')[0]).join('; ');
}

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (data) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request({
      hostname: 'localhost',
      port: 5001,
      path: `/api${path}`,
      method,
      headers: reqHeaders
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
    if (data) req.write(data);
    req.end();
  });
}

const get = (path, headers) => request('GET', path, null, headers);
const post = (path, body, headers) => request('POST', path, body, headers);
const put = (path, body, headers) => request('PUT', path, body, headers);

async function runTests() {
  console.log('--- STARTING PART D ADMIN UPGRADES TEST SUITE ---');
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
    // 0. Setup: Log in as Admin and as Non-Admin (Farmer / Dealer)
    const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe@Admin2026';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@kisanconnect.in';
    const adminLogin = await post('/auth/login', {
      identifier: adminEmail,
      password: adminPassword,
      expectedRole: 'admin'
    });
    assert(adminLogin.status === 200 && adminLogin.data.user.role === 'admin', 'Admin login succeeds');
    const adminCookie = parseCookies(adminLogin.headers['set-cookie']);

    // Log in as standard Farmer (non-admin)
    const farmerLogin = await post('/auth/login', {
      identifier: '9876543210',
      password: 'password123',
      expectedRole: 'farmer'
    });
    assert(farmerLogin.status === 200, 'Non-admin farmer login succeeds');
    const farmerCookie = parseCookies(farmerLogin.headers['set-cookie']);

    // =========================================================================
    // 1. NON-ADMINS GET 403 ON EVERY ADMIN ROUTE
    // =========================================================================
    console.log('\n--- Section 1: Non-Admin 403 Guards ---');
    const adminEndpoints = [
      { method: 'GET', path: '/admin/users' },
      { method: 'GET', path: '/admin/pending-approvals' },
      { method: 'GET', path: '/admin/audit-logs' },
      { method: 'GET', path: '/admin/stats' },
      { method: 'GET', path: '/admin/plans' },
      { method: 'POST', path: '/admin/users/dummy-id/approve', body: {} },
      { method: 'POST', path: '/admin/users/dummy-id/reject', body: { reason: 'Test' } },
      { method: 'POST', path: '/admin/users/dummy-id/block', body: {} },
      { method: 'POST', path: '/admin/users/dummy-id/unblock', body: {} },
      { method: 'POST', path: '/admin/users/dummy-id/reveal-phone', body: {} },
      { method: 'POST', path: '/admin/reset-demo', body: { confirm: 'RESET_DEMO' } }
    ];

    for (const ep of adminEndpoints) {
      const res = await request(ep.method, ep.path, ep.body || null, { Cookie: farmerCookie });
      assert(res.status === 403, `Non-admin receives 403 on ${ep.method} ${ep.path}`);
    }

    // =========================================================================
    // 2. APPROVING PENDING DEALER LETS THEM POST A REQUIREMENT
    // =========================================================================
    console.log('\n--- Section 2: Dealer Approval & Requirements Gating ---');
    const testPhone = `99${Date.now().toString().slice(-8)}`;
    const regRes = await post('/auth/signup/business', {
      role: 'dealer',
      businessName: 'Agra Agro Traders Pvt Ltd',
      contactPerson: 'Agra Agro Traders',
      mobile: testPhone,
      email: `dealer_${Date.now()}@example.com`,
      city: 'Agra, UP',
      password: 'dealerPassword123'
    });
    assert((regRes.status === 200 || regRes.status === 201) && regRes.data.user.status === 'pending', 'Dealer registers with status: pending');
    const dealerId = regRes.data.user.id;

    // Log in as pending dealer
    const dealerLogin = await post('/auth/login', {
      identifier: testPhone,
      password: 'dealerPassword123',
      expectedRole: 'dealer'
    });
    assert(dealerLogin.status === 200, 'Pending dealer can log in to view status');
    const dealerCookie = parseCookies(dealerLogin.headers['set-cookie']);

    // Attempt to post requirement before approval -> Must be rejected with 403 (ACCOUNT_PENDING)
    const postReqBefore = await post('/requirements', {
      cropId: 'potato-agra',
      cropName: 'Potato',
      quantityTons: 10,
      offeredPricePerKg: 12,
      location: 'Agra',
      validityDays: 14
    }, { Cookie: dealerCookie });
    assert(
      postReqBefore.status === 403 && (postReqBefore.data.error === 'ACCOUNT_PENDING' || postReqBefore.data.error === 'ACCOUNT_PENDING_APPROVAL'),
      'Pending dealer cannot post requirement (403 ACCOUNT_PENDING)'
    );

    // Pending approvals list includes this dealer
    const pendingList = await get('/admin/pending-approvals', { Cookie: adminCookie });
    assert(pendingList.status === 200 && Array.isArray(pendingList.data), 'Admin can fetch pending approvals');
    const foundPending = pendingList.data.find(u => u.id === dealerId);
    assert(!!foundPending, 'Pending dealer appears in /api/admin/pending-approvals list');

    // Admin approves dealer
    const approveRes = await post(`/admin/users/${dealerId}/approve`, {}, { Cookie: adminCookie });
    assert(approveRes.status === 200 && approveRes.data.user.status === 'active', 'Admin approves dealer; status becomes active');

    // After approval, dealer can now post requirement -> Succeeds with 201
    const postReqAfter = await post('/requirements', {
      cropId: 'potato-agra',
      cropName: 'Potato',
      quantityTons: 10,
      offeredPricePerKg: 12,
      location: 'Agra',
      validityDays: 14
    }, { Cookie: dealerCookie });
    assert(postReqAfter.status === 201 && postReqAfter.data.id, 'Approved dealer successfully posts requirement (201 Created)');

    // =========================================================================
    // 3. REJECTED AND BLOCKED USERS CANNOT LOG IN
    // =========================================================================
    console.log('\n--- Section 3: Rejected & Blocked User Restrictions ---');
    // Register another user to reject
    const rejectPhone = `98${Date.now().toString().slice(-8)}`;
    const regReject = await post('/auth/signup/business', {
      role: 'aggregator',
      businessName: 'Unverified Aggregator Hub',
      contactPerson: 'Unverified Aggregator',
      mobile: rejectPhone,
      email: `aggregator_${Date.now()}@example.com`,
      city: 'Mathura, UP',
      password: 'testPassword123'
    });
    const rejectUserId = regReject.data.user.id;

    // Admin rejects user with specific reason
    const rejectRes = await post(`/admin/users/${rejectUserId}/reject`, {
      reason: 'Incomplete business license documentation'
    }, { Cookie: adminCookie });
    assert(rejectRes.status === 200 && rejectRes.data.user.status === 'rejected', 'Admin rejects user; status becomes rejected');

    // Rejected user tries to log in -> 403 ACCOUNT_REJECTED with clear message
    const loginRejectAttempt = await post('/auth/login', {
      identifier: rejectPhone,
      password: 'testPassword123',
      expectedRole: 'aggregator'
    });
    assert(
      loginRejectAttempt.status === 403 && 
      loginRejectAttempt.data.error === 'ACCOUNT_REJECTED' &&
      loginRejectAttempt.data.message.includes('Incomplete business license documentation'),
      'Rejected user cannot log in and sees simple rejection message'
    );

    // Admin blocks the first dealer
    const blockRes = await post(`/admin/users/${dealerId}/block`, {}, { Cookie: adminCookie });
    assert(blockRes.status === 200 && blockRes.data.user.status === 'blocked', 'Admin blocks user; status becomes blocked');

    // Blocked user tries to log in -> 403 ACCOUNT_BLOCKED
    const loginBlockAttempt = await post('/auth/login', {
      identifier: testPhone,
      password: 'dealerPassword123',
      expectedRole: 'dealer'
    });
    assert(
      loginBlockAttempt.status === 403 && loginBlockAttempt.data.error === 'ACCOUNT_BLOCKED',
      'Blocked user cannot log in (403 ACCOUNT_BLOCKED)'
    );

    // Blocked user's active session is also rejected by authMiddleware
    const blockedSessionAttempt = await get('/auth/me', { Cookie: dealerCookie });
    assert(
      blockedSessionAttempt.status === 403 && blockedSessionAttempt.data.error === 'ACCOUNT_BLOCKED',
      'Blocked user session rejected by authMiddleware on protected endpoints'
    );

    // Admin unblocks user -> user status active and can log in again
    const unblockRes = await post(`/admin/users/${dealerId}/unblock`, {}, { Cookie: adminCookie });
    assert(unblockRes.status === 200 && unblockRes.data.user.status === 'active', 'Admin unblocks user; status restored to active');

    const loginAfterUnblock = await post('/auth/login', {
      identifier: testPhone,
      password: 'dealerPassword123',
      expectedRole: 'dealer'
    });
    assert(loginAfterUnblock.status === 200, 'Unblocked user can log in successfully');

    // =========================================================================
    // 4. EVERY ADMIN ACTION CREATES AN AUDIT_LOG ROW
    // =========================================================================
    console.log('\n--- Section 4: Audit Log Verification ---');
    // Perform verify toggle
    const verifyRes = await put(`/admin/users/${dealerId}/verify`, {}, { Cookie: adminCookie });
    assert(verifyRes.status === 200, 'Admin toggles verify');

    // Perform plan update
    const planRes = await put('/admin/plans/plan-basic', {
      name: 'Starter Agro Hub',
      monthlyPrice: 1299
    }, { Cookie: adminCookie });
    assert(planRes.status === 200, 'Admin updates subscription plan');

    // Perform reveal phone
    const revealRes = await post(`/admin/users/${dealerId}/reveal-phone`, {}, { Cookie: adminCookie });
    assert(revealRes.status === 200 && revealRes.data.phone === testPhone, 'Admin reveals masked phone number');

    // Fetch audit logs
    const auditLogsRes = await get('/admin/audit-logs?limit=50', { Cookie: adminCookie });
    assert(auditLogsRes.status === 200 && Array.isArray(auditLogsRes.data), 'Admin can fetch audit logs');
    const logs = auditLogsRes.data;

    const actionsRecorded = new Set(logs.map(l => l.action));
    console.log('[AUDIT LOGS] Distinct actions recorded:', Array.from(actionsRecorded).join(', '));

    assert(actionsRecorded.has('approve'), 'audit_log recorded action: approve');
    assert(actionsRecorded.has('reject'), 'audit_log recorded action: reject');
    assert(actionsRecorded.has('block'), 'audit_log recorded action: block');
    assert(actionsRecorded.has('unblock'), 'audit_log recorded action: unblock');
    assert(actionsRecorded.has('verify'), 'audit_log recorded action: verify');
    assert(actionsRecorded.has('plan_edit'), 'audit_log recorded action: plan_edit');
    assert(actionsRecorded.has('reveal_phone'), 'audit_log recorded action: reveal_phone');

    // Verify row structure
    const sampleLog = logs.find(l => l.action === 'approve');
    assert(sampleLog && sampleLog.id && (sampleLog.adminId || sampleLog.admin_id) && (sampleLog.targetUserId || sampleLog.target_user_id), 'audit_log entry contains id, adminId, and targetUserId');

    // Verify phone masking in directory
    const usersListRes = await get('/admin/users', { Cookie: adminCookie });
    const maskedUser = usersListRes.data.find(u => u.id === dealerId);
    assert(maskedUser && maskedUser.phone.includes('•'), 'Admin user directory masks phone numbers (e.g. •••••• 3210)');

    // Verify stats aggregates
    const statsRes = await get('/admin/stats', { Cookie: adminCookie });
    assert(
      statsRes.status === 200 &&
      Array.isArray(statsRes.data.signupTrend) &&
      statsRes.data.signupTrend.length === 30 &&
      typeof statsRes.data.pendingCount === 'number' &&
      statsRes.data.roleCounts &&
      statsRes.data.statusCounts,
      'Admin stats returns 30-day signup series, role counts, status counts, and pending count'
    );

    console.log(`\n========================================`);
    console.log(`PART D TESTS: ${passed}/${total} PASSED`);
    console.log(`========================================`);

    if (passed < total) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

runTests();
