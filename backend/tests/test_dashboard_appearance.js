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

async function runTests() {
  console.log('=== TEST SUITE: FARMER DASHBOARD APPEARANCE MANAGER ===');
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
    // 1. Initial State: Classic is active by default
    const initialSetting = await get('/settings/farmer-dashboard-appearance');
    assert(initialSetting.status === 200, 'GET /api/settings/farmer-dashboard-appearance returns 200');
    assert(initialSetting.data.activeDesignId === 'classic_standard', 'Classic — Original Dashboard is active by default');
    assert(initialSetting.data.theme === 'classic', 'Default theme is "classic"');
    assert(initialSetting.data.layout === 'standard', 'Default layout is "standard"');

    // 2. Security: Unauthenticated caller cannot update appearance
    const unauthUpdate = await put('/admin/dashboard-appearance', {
      activeDesignId: 'harvest_standard'
    });
    assert(unauthUpdate.status === 401, 'Unauthenticated PUT /admin/dashboard-appearance is rejected with 401');

    // 3. Security: Farmer (non-admin) cannot update appearance
    const farmerLogin = await post('/auth/login', {
      identifier: '9876543210',
      password: 'password123',
      expectedRole: 'farmer'
    });
    assert(farmerLogin.status === 200, 'Farmer login succeeds');
    const farmerCookie = parseCookies(farmerLogin.headers['set-cookie']);
    const farmerToken = farmerLogin.data?.token;

    const farmerHeaders = { Cookie: farmerCookie };
    if (farmerToken) farmerHeaders['Authorization'] = `Bearer ${farmerToken}`;

    const farmerUpdate = await put('/admin/dashboard-appearance', {
      activeDesignId: 'harvest_standard'
    }, farmerHeaders);
    assert(farmerUpdate.status === 403, 'Non-admin farmer PUT /admin/dashboard-appearance is rejected with 403 Forbidden');

    // 4. Authenticate as Admin
    const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe@Admin2026';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@kisanconnect.in';
    const adminLogin = await post('/auth/login', {
      identifier: adminEmail,
      password: adminPassword,
      expectedRole: 'admin'
    });
    assert(adminLogin.status === 200 && adminLogin.data.user?.role === 'admin', 'Admin login succeeds');
    const adminCookie = parseCookies(adminLogin.headers['set-cookie']);
    const adminToken = adminLogin.data?.token;
    const adminHeaders = { Cookie: adminCookie };
    if (adminToken) adminHeaders['Authorization'] = `Bearer ${adminToken}`;

    // 5. Admin lists registered designs
    const adminDesigns = await get('/admin/dashboard-appearance', adminHeaders);
    assert(adminDesigns.status === 200, 'Admin GET /admin/dashboard-appearance returns 200');
    assert(Array.isArray(adminDesigns.data.designs) && adminDesigns.data.designs.length >= 2, 'Returns registered designs array');
    const hasClassic = adminDesigns.data.designs.some(d => d.id === 'classic_standard');
    const hasHarvest = adminDesigns.data.designs.some(d => d.id === 'harvest_standard');
    assert(hasClassic && hasHarvest, 'Designs include both Classic and Harvest Premium');

    // 6. Admin validation: rejecting invalid design ID
    const invalidUpdate = await put('/admin/dashboard-appearance', {
      activeDesignId: 'non_existent_design'
    }, adminHeaders);
    assert(invalidUpdate.status === 400, 'Reject activation of unregistered design with 400');

    // 7. Admin activates Harvest Premium
    const harvestActivation = await put('/admin/dashboard-appearance', {
      activeDesignId: 'harvest_standard',
      theme: 'harvest_premium',
      layout: 'standard'
    }, adminHeaders);
    assert(harvestActivation.status === 200, 'Admin PUT /admin/dashboard-appearance activates Harvest Premium');
    assert(harvestActivation.data.setting.activeDesignId === 'harvest_standard', 'Active design is now harvest_standard');

    // 8. Public settings check: Harvest is now active globally
    const publicAfterHarvest = await get('/settings/farmer-dashboard-appearance');
    assert(publicAfterHarvest.status === 200, 'Public GET returns 200 after Harvest activation');
    assert(publicAfterHarvest.data.activeDesignId === 'harvest_standard', 'Public appearance reflects harvest_standard persistently');
    assert(publicAfterHarvest.data.theme === 'harvest_premium', 'Theme is harvest_premium');

    // 9. Admin restores Classic Original Dashboard
    const restoreRes = await post('/admin/dashboard-appearance/restore', {}, adminHeaders);
    assert(restoreRes.status === 200, 'Admin POST /admin/dashboard-appearance/restore returns 200');
    assert(restoreRes.data.setting.activeDesignId === 'classic_standard', 'Restored activeDesignId is classic_standard');
    assert(restoreRes.data.setting.theme === 'classic', 'Restored theme is classic');

    // 10. Verify persistent restoration
    const publicAfterRestore = await get('/settings/farmer-dashboard-appearance');
    assert(publicAfterRestore.data.activeDesignId === 'classic_standard', 'Public appearance persistently restored to classic_standard');

    // 11. Check audit log records
    const auditRes = await get('/admin/audit-logs?limit=5', adminHeaders);
    assert(auditRes.status === 200, 'Admin audit logs accessible');
    const logs = auditRes.data || [];
    const hasUpdateLog = logs.some(l => l.action === 'update_farmer_dashboard_appearance');
    const hasRestoreLog = logs.some(l => l.action === 'restore_farmer_dashboard_appearance');
    assert(hasUpdateLog && hasRestoreLog, 'Audit log accurately records both theme update and restore operations');

  } catch (err) {
    console.error('Test execution error:', err.message);
  }

  console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===`);
  if (passed === total) {
    console.log('✅ ALL TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runTests();
