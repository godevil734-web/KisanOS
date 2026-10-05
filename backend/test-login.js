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

async function runLoginTests() {
  console.log('--- STARTING ITEM 3 LOGIN PAGE VERIFICATION TESTS ---');
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

  // 1. Farmer OTP Login Tests
  const sendRes = await post('/auth/otp/send', { phone: '9876543210' });
  assert('Farmer tab: Send OTP returns demoOtp chip', sendRes.status === 200 && sendRes.data.demoOtp === '123456');

  // Verify with wrong OTP
  const wrongOtp = await post('/auth/otp/verify', { phone: '9876543210', code: '999999', expectedRole: 'farmer' });
  assert('Farmer tab: Wrong OTP code is rejected', wrongOtp.status === 400 && wrongOtp.data.error.includes('Incorrect OTP'));

  // Re-send OTP and verify with valid OTP
  await post('/auth/otp/send', { phone: '9876543210' });
  const validOtp = await post('/auth/otp/verify', { phone: '9876543210', code: '123456', expectedRole: 'farmer' });
  assert('Farmer tab: Valid 6-digit OTP logs in successfully', validOtp.status === 200 && validOtp.data.user.role === 'farmer');

  // 2. Aggregator Tab Login Tests
  const aggEmailLogin = await post('/auth/login', {
    identifier: 'vikram@aggregator.in',
    password: 'password123',
    expectedRole: 'aggregator'
  });
  assert('Aggregator tab: Email + password login succeeds', aggEmailLogin.status === 200 && aggEmailLogin.data.user.role === 'aggregator');

  const aggPhoneLogin = await post('/auth/login', {
    identifier: '9811122334',
    password: 'password123',
    expectedRole: 'aggregator'
  });
  assert('Aggregator tab: Mobile number + password login succeeds', aggPhoneLogin.status === 200 && aggPhoneLogin.data.user.role === 'aggregator');

  const aggWrongPwd = await post('/auth/login', {
    identifier: 'vikram@aggregator.in',
    password: 'wrongpassword',
    expectedRole: 'aggregator'
  });
  assert('Aggregator tab: Wrong password is rejected', aggWrongPwd.status === 401 && aggWrongPwd.data.error.includes('Invalid password'));

  // 3. Dealer Tab Login Tests
  const dealerEmailLogin = await post('/auth/login', {
    identifier: 'dealer@freshbites.in',
    password: 'password123',
    expectedRole: 'dealer'
  });
  assert('Dealer tab: Email + password login succeeds', dealerEmailLogin.status === 200 && dealerEmailLogin.data.user.role === 'dealer');

  // 4. Role Mismatch Enforcement (Critical Security Check)
  // Attempting to log in as farmer on Aggregator tab
  const farmerOnAggTab = await post('/auth/login', {
    identifier: '9876543210',
    password: 'password123',
    expectedRole: 'aggregator'
  });
  assert('Server rejects farmer logging in under Aggregator tab with ROLE_MISMATCH', 
    farmerOnAggTab.status === 400 && 
    farmerOnAggTab.data.error === 'ROLE_MISMATCH' &&
    farmerOnAggTab.data.message.includes('switch to the Farmer tab')
  );

  // Attempting to log in as farmer on Dealer tab
  const farmerOnDealerTab = await post('/auth/login', {
    identifier: '9876543210',
    password: 'password123',
    expectedRole: 'dealer'
  });
  assert('Server rejects farmer logging in under Dealer tab with ROLE_MISMATCH', 
    farmerOnDealerTab.status === 400 && 
    farmerOnDealerTab.data.error === 'ROLE_MISMATCH' &&
    farmerOnDealerTab.data.message.includes('switch to the Farmer tab')
  );

  // Attempting to log in as Aggregator on Dealer tab
  const aggOnDealerTab = await post('/auth/login', {
    identifier: 'vikram@aggregator.in',
    password: 'password123',
    expectedRole: 'dealer'
  });
  assert('Server rejects aggregator logging in under Dealer tab with ROLE_MISMATCH', 
    aggOnDealerTab.status === 400 && 
    aggOnDealerTab.data.error === 'ROLE_MISMATCH' &&
    aggOnDealerTab.data.message.includes('switch to the Aggregator tab')
  );

  // Attempting to log in as Dealer on Aggregator tab
  const dealerOnAggTab = await post('/auth/login', {
    identifier: 'dealer@freshbites.in',
    password: 'password123',
    expectedRole: 'aggregator'
  });
  assert('Server rejects dealer logging in under Aggregator tab with ROLE_MISMATCH', 
    dealerOnAggTab.status === 400 && 
    dealerOnAggTab.data.error === 'ROLE_MISMATCH' &&
    dealerOnAggTab.data.message.includes('switch to the Big Dealer tab')
  );

  // 5. Admin Tab Login Tests (Separate Admin Section)
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@kisanconnect.in';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe@Admin2026';
  const adminLogin = await post('/auth/login', {
    identifier: adminEmail,
    password: adminPassword,
    expectedRole: 'admin'
  });
  assert('Admin tab: Email + password login succeeds', adminLogin.status === 200 && adminLogin.data.user.role === 'admin');

  // Attempting to log in as farmer on Admin tab
  const farmerOnAdminTab = await post('/auth/login', {
    identifier: '9876543210',
    password: 'password123',
    expectedRole: 'admin'
  });
  assert('Server rejects farmer logging in under Admin tab with ROLE_MISMATCH',
    farmerOnAdminTab.status === 400 &&
    farmerOnAdminTab.data.error === 'ROLE_MISMATCH' &&
    farmerOnAdminTab.data.message.includes('switch to the Farmer tab')
  );

  // Attempting to log in as Admin on Farmer/Aggregator tab
  const adminOnAggTab = await post('/auth/login', {
    identifier: adminEmail,
    password: adminPassword,
    expectedRole: 'aggregator'
  });
  assert('Server rejects admin logging in under Aggregator tab with ROLE_MISMATCH',
    adminOnAggTab.status === 400 &&
    adminOnAggTab.data.error === 'ROLE_MISMATCH' &&
    adminOnAggTab.data.message.includes('switch to the Admin tab')
  );

  console.log(`\nResults: ${passed}/${total} Login Page tests passed.`);
  process.exit(passed === total ? 0 : 1);
}

runLoginTests().catch(err => {
  console.error(err);
  process.exit(1);
});
