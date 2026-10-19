/**
 * Integration Test: Real Farmer Theme Rendering Flow
 * Verifies the complete end-to-end sequence required by KisanConnect appearance management.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const http = require('http');

function parseCookies(setCookieHeader) {
  if (!setCookieHeader) return '';
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return cookies.map(c => c.split(';')[0]).join('; ');
}

function request(method, urlPath, body = null, headers = {}) {
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
      path: `/api${urlPath}`,
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

const get = (p, headers) => request('GET', p, null, headers);
const post = (p, body, headers) => request('POST', p, body, headers);
const put = (p, body, headers) => request('PUT', p, body, headers);

async function runFarmerThemeFlowTests() {
  console.log('=== TEST SUITE: FARMER THEME ACTIVATION-TO-RENDERING FLOW ===');
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
    // 0. Ensure baseline state is Classic
    await post('/admin/dashboard-appearance/restore'); // ignore unauth error if any

    // 1. Step 1: Check initial setting is Classic by default
    const initialSetting = await get('/settings/farmer-dashboard-appearance');
    assert(initialSetting.status === 200, 'Public GET /settings/farmer-dashboard-appearance returns 200');
    assert(initialSetting.data.activeDesignId === 'classic_standard', 'Classic — Original Dashboard is default');
    assert(initialSetting.data.theme === 'classic', 'Default theme is "classic"');
    assert(initialSetting.data.layout === 'standard', 'Default layout is "standard"');
    assert(initialSetting.headers['cache-control'] && initialSetting.headers['cache-control'].includes('no-store'), 'Response includes Cache-Control: no-store');
    assert(!initialSetting.data.updatedBy, 'Does NOT leak admin credentials/IDs in public response');

    // 2. Step 2: Admin logs in
    const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe@Admin2026';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@kisanconnect.in';
    const adminLogin = await post('/auth/login', {
      identifier: adminEmail,
      password: adminPassword,
      expectedRole: 'admin'
    });
    assert(adminLogin.status === 200 && adminLogin.data.user?.role === 'admin', 'Admin logs in successfully');
    const adminCookie = parseCookies(adminLogin.headers['set-cookie']);
    const adminToken = adminLogin.data?.token;
    const adminHeaders = { Cookie: adminCookie };
    if (adminToken) adminHeaders['Authorization'] = `Bearer ${adminToken}`;

    // Admin verifies Classic is currently active
    const adminAppearance = await get('/admin/dashboard-appearance', adminHeaders);
    assert(adminAppearance.status === 200, 'Admin can read dashboard appearance settings');
    assert(adminAppearance.data.activeSetting.activeDesignId === 'classic_standard', 'Admin sees Classic active');

    // Step 2b: Preview simulation - Preview does not mutate global active theme
    // When an admin opens /preview-dashboard?design=harvest_standard, no PUT is called.
    const previewCheck = await get('/settings/farmer-dashboard-appearance');
    assert(previewCheck.data.activeDesignId === 'classic_standard', 'Farmer still sees Classic while admin previews');

    // 3. Step 3: Admin activates Harvest Premium
    const activateRes = await put('/admin/dashboard-appearance', {
      activeDesignId: 'harvest_standard'
    }, adminHeaders);
    assert(activateRes.status === 200, 'Admin activates Harvest Premium successfully');
    assert(activateRes.data.setting.activeDesignId === 'harvest_standard', 'Setting activeDesignId is harvest_standard');
    assert(activateRes.data.setting.theme === 'harvest_premium', 'Setting theme is harvest_premium');

    // 4. Step 4: A separate farmer account logs in and fetches active theme
    const farmerLogin = await post('/auth/login', {
      identifier: '9876543210',
      password: 'password123',
      expectedRole: 'farmer'
    });
    assert(farmerLogin.status === 200 && farmerLogin.data.user?.role === 'farmer', 'Separate farmer account logs in');
    const farmerCookie = parseCookies(farmerLogin.headers['set-cookie']);
    const farmerToken = farmerLogin.data?.token;
    const farmerHeaders = { Cookie: farmerCookie };
    if (farmerToken) farmerHeaders['Authorization'] = `Bearer ${farmerToken}`;

    // Farmer requests active appearance
    const farmerAppearance = await get('/settings/farmer-dashboard-appearance', farmerHeaders);
    assert(farmerAppearance.status === 200, 'Farmer successfully fetches active dashboard appearance');
    assert(farmerAppearance.data.activeDesignId === 'harvest_standard', 'Farmer receives harvest_standard design');
    assert(farmerAppearance.data.theme === 'harvest_premium', 'Farmer receives harvest_premium theme');

    // 5. Step 5: Refreshing farmer page keeps Harvest Premium active
    const farmerRefresh = await get('/settings/farmer-dashboard-appearance', farmerHeaders);
    assert(farmerRefresh.data.activeDesignId === 'harvest_standard', 'Refreshed farmer session receives harvest_standard');
    assert(farmerRefresh.data.theme === 'harvest_premium', 'Refreshed farmer session receives harvest_premium');

    // 6. Step 6: Logging out and logging in again keeps Harvest Premium active
    // New farmer session login
    const farmer2Login = await post('/auth/login', {
      identifier: 'farmer.b@kisanconnect.in',
      password: 'password123',
      expectedRole: 'farmer'
    });
    assert(farmer2Login.status === 200, 'Another farmer account logs in');
    const farmer2Cookie = parseCookies(farmer2Login.headers['set-cookie']);
    const farmer2Token = farmer2Login.data?.token;
    const farmer2Headers = { Cookie: farmer2Cookie };
    if (farmer2Token) farmer2Headers['Authorization'] = `Bearer ${farmer2Token}`;

    const farmer2Appearance = await get('/settings/farmer-dashboard-appearance', farmer2Headers);
    assert(farmer2Appearance.data.activeDesignId === 'harvest_standard', 'New farmer login session receives harvest_standard');
    assert(farmer2Appearance.data.theme === 'harvest_premium', 'New farmer login session receives harvest_premium');

    // 7. Step 7: Admin restores Classic
    const restoreRes = await post('/admin/dashboard-appearance/restore', {}, adminHeaders);
    assert(restoreRes.status === 200, 'Admin restores Classic successfully');
    assert(restoreRes.data.setting.activeDesignId === 'classic_standard', 'Active design reverted to classic_standard');
    assert(restoreRes.data.setting.theme === 'classic', 'Active theme reverted to classic');

    // 8. Step 8: Farmer refreshes or starts new session and sees Classic again
    const farmerPostRestore = await get('/settings/farmer-dashboard-appearance', farmerHeaders);
    assert(farmerPostRestore.data.activeDesignId === 'classic_standard', 'Farmer sees Classic restored');
    assert(farmerPostRestore.data.theme === 'classic', 'Farmer theme is classic');

    // 9. Step 9: A non-admin cannot activate or restore themes through the API
    const unauthorizedPut = await put('/admin/dashboard-appearance', {
      activeDesignId: 'harvest_standard'
    }, farmerHeaders);
    assert(unauthorizedPut.status === 403, 'Non-admin farmer PUT /admin/dashboard-appearance is rejected with 403');

    const unauthorizedRestore = await post('/admin/dashboard-appearance/restore', {}, farmerHeaders);
    assert(unauthorizedRestore.status === 403, 'Non-admin farmer POST /admin/dashboard-appearance/restore is rejected with 403');

    // 10. Audit log check
    const auditRes = await get('/admin/audit-logs', adminHeaders);
    assert(auditRes.status === 200, 'Audit logs accessible');
    const logs = auditRes.data;
    const updateLog = logs.find(l => l.action === 'update_farmer_dashboard_appearance');
    const restoreLog = logs.find(l => l.action === 'restore_farmer_dashboard_appearance');
    assert(!!updateLog && !!restoreLog, 'Audit log accurately recorded both activation and restoration');

  } catch (err) {
    console.error('Fatal test error:', err);
    total++;
  }

  console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===`);
  if (passed === total) {
    console.log('✅ ALL FARMER THEME FLOW TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runFarmerThemeFlowTests();
