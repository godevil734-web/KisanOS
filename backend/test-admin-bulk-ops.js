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

async function run() {
  console.log('--- TESTING ADMIN BULK APPROVE & BULK DELETE ---');
  let passed = 0;
  let total = 0;

  function assert(cond, desc) {
    total++;
    if (cond) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
    }
  }

  // 1. Admin login
  const adminLogin = await request('POST', '/auth/login', {
    identifier: 'godevil344@gmail.com',
    password: 'Aryan@123',
    expectedRole: 'admin'
  });
  assert(adminLogin.status === 200 && adminLogin.data.token, 'Admin login succeeds');
  const token = adminLogin.data.token;

  // 2. Create 2 test pending users via db helper
  const id1 = `usr-bulk-farmer-${Date.now()}`;
  const id2 = `usr-bulk-dealer-${Date.now()}`;

  await db.insert('users', {
    id: id1,
    name: 'Bulk Test Farmer 1',
    email: `bulk1_${Date.now()}@test.com`,
    phone: `+91 9911${Date.now().toString().slice(-6)}`,
    role: 'farmer',
    status: 'pending',
    verified: false,
    location: 'Mathura'
  });

  await db.insert('users', {
    id: id2,
    name: 'Bulk Test Dealer 2',
    email: `bulk2_${Date.now()}@test.com`,
    phone: `+91 9922${Date.now().toString().slice(-6)}`,
    role: 'buyer',
    status: 'pending',
    verified: false,
    location: 'Agra'
  });

  // 3. Test Bulk Approve
  const approveRes = await request('POST', '/admin/users/bulk-approve', {
    userIds: [id1, id2]
  }, token);
  assert(approveRes.status === 200 && approveRes.data.success, 'POST /api/admin/users/bulk-approve succeeds');
  assert(approveRes.data.approvedCount === 2, 'Approved exactly 2 users');

  // Verify they are now active and verified in db
  const u1 = await db.findById('users', id1);
  const u2 = await db.findById('users', id2);
  assert(u1.status === 'active' && u1.verified === true, 'User 1 is active and verified');
  assert(u2.status === 'active' && u2.verified === true, 'User 2 is active and verified');

  // 4. Test Bulk Delete
  const deleteRes = await request('POST', '/admin/users/bulk-delete', {
    userIds: [id1, id2]
  }, token);
  assert(deleteRes.status === 200 && deleteRes.data.success, 'POST /api/admin/users/bulk-delete succeeds');
  assert(deleteRes.data.deletedCount === 2, 'Deleted exactly 2 users');

  // Verify they are completely removed
  const deletedU1 = await db.findById('users', id1);
  const deletedU2 = await db.findById('users', id2);
  assert(!deletedU1 && !deletedU2, 'Both users permanently removed from database');

  console.log(`========================================`);
  console.log(`ADMIN BULK TESTS: ${passed}/${total} PASSED`);
  console.log(`========================================`);
  process.exit(passed === total ? 0 : 1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
