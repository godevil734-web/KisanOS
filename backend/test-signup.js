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

async function runSignUpTests() {
  console.log('--- STARTING ITEM 2 SIGN UP VERIFICATION TESTS ---');
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

  const uniqueSuffix = Date.now().toString().slice(-6);

  // 1. Farmer Registration (No password, mobile + OTP)
  const farmerPhone = `91${uniqueSuffix}01`.slice(0, 10);
  const farmerRes = await post('/auth/signup/farmer', {
    name: 'Balram Singh',
    phone: farmerPhone,
    villageDistrict: 'Fatehabad, Agra (UP)',
    mainCrops: ['potato', 'mustard']
  });
  assert('Farmer signup accepts name, phone, villageDistrict, mainCrops and returns OTP', farmerRes.status === 200 && farmerRes.data.success && farmerRes.data.demoOtp === '123456');

  // Verify farmer OTP and ensure farmer is logged in
  const farmerVerify = await post('/auth/otp/verify', {
    phone: farmerPhone,
    code: '123456',
    expectedRole: 'farmer'
  });
  assert('Farmer logs in via OTP without password', farmerVerify.status === 200 && farmerVerify.data.user.role === 'farmer' && farmerVerify.data.user.status === 'active');
  assert('Farmer user record in DB has no password field exposed', !farmerVerify.data.user.password);

  // Farmer cannot log in via password endpoint
  const farmerPwdLogin = await post('/auth/login', {
    identifier: farmerPhone,
    password: 'anypassword',
    expectedRole: 'farmer'
  });
  assert('Farmer cannot login with password (requires mobile OTP)', farmerPwdLogin.status === 401 && farmerPwdLogin.data.error.includes('mobile OTP'));

  // 2. Aggregator Registration (Status = pending)
  const aggMobile = `92${uniqueSuffix}02`.slice(0, 10);
  const aggEmail = `agg.${uniqueSuffix}@fpo.in`;
  const aggRes = await post('/auth/signup/business', {
    role: 'aggregator',
    businessName: 'Braj Farmers Producer Company Ltd',
    contactPerson: 'Harish Chandra',
    mobile: aggMobile,
    email: aggEmail,
    city: 'Mathura, UP',
    password: 'securePassword123'
  });
  assert('Aggregator signup returns 200 and status pending', aggRes.status === 200 && aggRes.data.status === 'pending');
  assert('Aggregator user object returned has status pending and role aggregator', aggRes.data.user.status === 'pending' && aggRes.data.user.role === 'aggregator');

  // 3. Big Dealer Registration (Status = pending)
  const dealerMobile = `93${uniqueSuffix}03`.slice(0, 10);
  const dealerEmail = `dealer.${uniqueSuffix}@wholesale.in`;
  const dealerRes = await post('/auth/signup/business', {
    role: 'dealer',
    businessName: 'Royal Agro Commodities Private Ltd',
    contactPerson: 'Sunita Sharma',
    mobile: dealerMobile,
    email: dealerEmail,
    city: 'Azadpur Mandi, Delhi',
    password: 'dealerPassword456'
  });
  assert('Big Dealer signup returns 200 and status pending', dealerRes.status === 200 && dealerRes.data.status === 'pending');
  assert('Big Dealer user object returned has status pending and role dealer', dealerRes.data.user.status === 'pending' && dealerRes.data.user.role === 'dealer');

  // 4. Validation: reject duplicate mobile/email
  const dupFarmer = await post('/auth/signup/farmer', {
    name: 'Another Name',
    phone: farmerPhone,
    villageDistrict: 'Agra',
    mainCrops: ['potato']
  });
  assert('Duplicate farmer phone is rejected with error', dupFarmer.status === 400 && dupFarmer.data.error.includes('already exists'));

  const dupBusiness = await post('/auth/signup/business', {
    role: 'dealer',
    businessName: 'Another Business',
    contactPerson: 'Another Person',
    mobile: dealerMobile,
    email: dealerEmail,
    city: 'Delhi',
    password: 'password123'
  });
  assert('Duplicate business mobile/email is rejected with error', dupBusiness.status === 400 && dupBusiness.data.error.includes('already exists'));

  // 5. Validation: password length < 6
  const shortPwd = await post('/auth/signup/business', {
    role: 'dealer',
    businessName: 'Short Pwd Business',
    contactPerson: 'Tester',
    mobile: `94${uniqueSuffix}04`.slice(0, 10),
    email: `short.${uniqueSuffix}@demo.in`,
    city: 'Agra',
    password: '123'
  });
  assert('Password shorter than 6 characters is rejected', shortPwd.status === 400 && shortPwd.data.error.includes('6 characters'));

  console.log(`\nResults: ${passed}/${total} Sign Up tests passed.`);
  process.exit(passed === total ? 0 : 1);
}

runSignUpTests().catch(err => {
  console.error(err);
  process.exit(1);
});
