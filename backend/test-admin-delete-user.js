const http = require('http');
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

async function runTests() {
  console.log('--- STARTING ADMIN REMOVE / DELETE USER TEST SUITE ---');
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
    // 1. Admin login
    const adminLogin = await request('POST', '/auth/login', {
      identifier: 'godevil344@gmail.com',
      password: 'Aryan@123',
      expectedRole: 'admin'
    });
    assert(adminLogin.status === 200, 'Admin login succeeds');
    const token = adminLogin.data.token;
    const adminUser = adminLogin.data.user;

    // 2. Self-deletion prevention
    const selfDelete = await request('DELETE', `/admin/users/${adminUser.id}`, null, token);
    assert(selfDelete.status === 400, 'Admin cannot delete their own account (400 Bad Request)');

    // 3. Create a test farmer with phone = null (like Google signup)
    const testFarmerId = `usr-test-farmer-${Date.now()}`;
    await db.insert('users', {
      id: testFarmerId,
      name: 'Ramesh Test Farmer',
      email: `test_farmer_${Date.now()}@example.com`,
      phone: null,
      role: 'farmer',
      status: 'active',
      location: 'Agra, UP'
    });

    // 4. Create a test buyer
    const testBuyerId = `usr-test-buyer-${Date.now()}`;
    await db.insert('users', {
      id: testBuyerId,
      name: 'Agro Foods Buyer Ltd',
      email: `test_buyer_${Date.now()}@example.com`,
      phone: `+91 99${Date.now().toString().slice(-8)}`,
      role: 'buyer',
      status: 'active',
      location: 'Delhi NCR'
    });

    // 5. Verify both appear in Admin Users Directory without throwing
    const usersRes = await request('GET', '/admin/users', null, token);
    assert(usersRes.status === 200, 'GET /api/admin/users succeeds');
    const foundFarmer = usersRes.data.find(u => u.id === testFarmerId);
    const foundBuyer = usersRes.data.find(u => u.id === testBuyerId);
    assert(foundFarmer && foundFarmer.phone === null, 'Farmer with phone: null handles masking safely without crash');
    assert(foundBuyer && typeof foundBuyer.phoneMasked === 'string', 'Buyer with phone is properly masked');

    // 6. Delete the test farmer
    const deleteFarmerRes = await request('DELETE', `/admin/users/${testFarmerId}`, null, token);
    assert(deleteFarmerRes.status === 200 && deleteFarmerRes.data.success === true, 'Admin successfully deletes test farmer');

    // 7. Delete the test buyer
    const deleteBuyerRes = await request('DELETE', `/admin/users/${testBuyerId}`, null, token);
    assert(deleteBuyerRes.status === 200 && deleteBuyerRes.data.success === true, 'Admin successfully deletes test buyer');

    // 8. Verify users no longer exist
    const usersAfterRes = await request('GET', '/admin/users', null, token);
    const stillFarmer = usersAfterRes.data.some(u => u.id === testFarmerId);
    const stillBuyer = usersAfterRes.data.some(u => u.id === testBuyerId);
    assert(!stillFarmer && !stillBuyer, 'Deleted users are completely removed from directory');

    // 9. Verify audit log entry was generated
    const auditRes = await request('GET', '/admin/audit-logs?action=USER_DELETE', null, token);
    assert(auditRes.status === 200, 'GET /api/admin/audit-logs succeeds');
    const deleteLogs = auditRes.data.filter(l => l.action === 'USER_DELETE');
    assert(deleteLogs.length >= 2, 'Audit log accurately recorded USER_DELETE actions');
    const farmerLog = deleteLogs.find(l => l.targetUserId === testFarmerId);
    assert(farmerLog && farmerLog.details.role === 'farmer', 'Audit log records target user role and details');

    console.log(`\n========================================`);
    console.log(`ADMIN DELETE USER TESTS: ${passed}/${total} PASSED`);
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

runTests();
