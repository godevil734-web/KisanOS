// backend/test-google-auth.js
// Verification suite for Google Authentication, Mobile OTP 2FA, and Password Login

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const http = require('http');

const PORT = process.env.PORT || 5001;

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function post(endpoint, body, cookie = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  return request({
    hostname: '127.0.0.1',
    port: PORT,
    path: `/api${endpoint}`,
    method: 'POST',
    headers
  }, body);
}

function get(endpoint, cookie = null) {
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;
  return request({
    hostname: '127.0.0.1',
    port: PORT,
    path: `/api${endpoint}`,
    method: 'GET',
    headers
  });
}

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`[PASS] ${description}`);
    passed++;
  } else {
    console.error(`[FAIL] ${description}`);
    failed++;
  }
}

async function runTests() {
  console.log('--- STARTING GOOGLE AUTH & PASSWORD LOGIN TESTS ---');
  const unique = Date.now().toString().slice(-6);
  const testGoogleEmail = `kisan.test.${unique}@gmail.com`;
  const testGoogleId = `goog-id-${unique}`;
  const testPhone = `91${unique}11`.slice(0, 10);
  const testPassword = `FarmerSecret${unique}!`;

  try {
    // 1. Google Init for New User -> should require registration and send Email OTP
    const initNew = await post('/auth/google/init', {
      googleUser: {
        email: testGoogleEmail,
        name: 'Sunil Kisan',
        googleId: testGoogleId
      }
    });
    assert('Google Init for new user returns status REGISTER_REQUIRED', initNew.status === 200 && initNew.data.status === 'REGISTER_REQUIRED');
    assert('Google Init specifies verificationType email and sends Email OTP', initNew.data.verificationType === 'email' && Boolean(initNew.data.demoOtp));
    assert('Google Init returns maskedEmail', Boolean(initNew.data.maskedEmail) && initNew.data.maskedEmail.includes('@'));
    assert('Google Init returns googleProfile with email and name', initNew.data.googleProfile?.email === testGoogleEmail);

    const emailDemoOtp = initNew.data.demoOtp || '123456';

    // 2. Google Register with wrong Email OTP -> rejected
    const regWrongOtp = await post('/auth/google/register', {
      googleId: testGoogleId,
      email: testGoogleEmail,
      name: 'Sunil Kisan',
      phone: testPhone,
      code: '000000',
      password: testPassword,
      role: 'farmer'
    });
    assert('Google register with wrong Email OTP is rejected with 400', regWrongOtp.status === 400);

    // 3. Google Register with valid Email OTP -> succeeds and returns token
    const regRes = await post('/auth/google/register', {
      googleId: testGoogleId,
      email: testGoogleEmail,
      name: 'Sunil Kisan',
      phone: testPhone,
      code: emailDemoOtp,
      password: testPassword,
      role: 'farmer',
      villageDistrict: 'Khandauli, Agra, UP',
      mainCrops: ['Potato', 'Mustard']
    });
    assert('Google register with valid Email OTP succeeds with 200', regRes.status === 200);
    assert('Google register returns user with active status and verified email', regRes.data.user?.status === 'active' && regRes.data.user?.emailVerified === true);
    assert('Google register sets session cookies', regRes.headers['set-cookie'] && regRes.headers['set-cookie'].some(c => c.includes('kc_session')));
    
    const sessionCookie = (regRes.headers['set-cookie'] || []).find(c => c.startsWith('kc_session='));

    // 4. Protected route /auth/me returns authenticated user from Google register
    const meRes = await get('/auth/me', sessionCookie);
    assert('Protected /api/auth/me succeeds with session cookie', meRes.status === 200 && meRes.data.user?.email === testGoogleEmail);

    // 5. Direct Password Login using email and password created at signup
    const pwdLoginEmail = await post('/auth/login', {
      identifier: testGoogleEmail,
      password: testPassword,
      expectedRole: 'farmer'
    });
    assert('User can log in using email & password created at signup', pwdLoginEmail.status === 200 && pwdLoginEmail.data.user?.id === regRes.data.user?.id);

    // 6. Direct Password Login using phone and password created at signup
    const pwdLoginPhone = await post('/auth/login', {
      identifier: testPhone,
      password: testPassword,
      expectedRole: 'farmer'
    });
    assert('User can also log in using phone & password created at signup', pwdLoginPhone.status === 200 && pwdLoginPhone.data.user?.id === regRes.data.user?.id);

    // 7. Direct Password Login with wrong password is rejected
    const wrongPwd = await post('/auth/login', {
      identifier: testGoogleEmail,
      password: 'wrongPassword!',
      expectedRole: 'farmer'
    });
    assert('Login with wrong password is rejected with 401', wrongPwd.status === 401);

    // 8. Google Init for Existing User -> requires Email OTP 2FA before entering
    const initExisting = await post('/auth/google/init', {
      googleUser: {
        email: testGoogleEmail,
        name: 'Sunil Kisan',
        googleId: testGoogleId
      }
    });
    assert('Google Init for existing user returns status OTP_REQUIRED', initExisting.status === 200 && initExisting.data.status === 'OTP_REQUIRED');
    assert('Google Init returns tempToken and maskedEmail', Boolean(initExisting.data.tempToken) && Boolean(initExisting.data.maskedEmail));
    assert('Google Init confirms email verificationType', initExisting.data.verificationType === 'email');

    const tempToken = initExisting.data.tempToken;
    const loginDemoOtp = initExisting.data.demoOtp || '123456';

    // 9. Resend Google Email OTP endpoint
    const resendRes = await post('/auth/google/resend-otp', { email: testGoogleEmail });
    assert('Resend Google Email OTP endpoint succeeds (200)', resendRes.status === 200 && resendRes.data.success);

    // 10. Google Verify OTP with wrong code -> rejected
    const verifyWrong = await post('/auth/google/verify-otp', {
      tempToken,
      code: '999999'
    });
    assert('Google verify OTP with invalid code is rejected with 400', verifyWrong.status === 400);

    // 11. Google Verify OTP with valid code -> logs in and sets session cookie
    const activeOtp = resendRes.data.demoOtp || loginDemoOtp;
    const verifyValid = await post('/auth/google/verify-otp', {
      tempToken,
      code: activeOtp
    });
    assert('Google verify Email OTP with valid code succeeds (200)', verifyValid.status === 200);
    assert('Google verify OTP returns valid token and user', Boolean(verifyValid.data.token) && verifyValid.data.user?.id === regRes.data.user?.id);
    assert('Google verify OTP issues kc_session cookie', verifyValid.headers['set-cookie'] && verifyValid.headers['set-cookie'].some(c => c.includes('kc_session')));

    // 12. Farmer standard signup with password support
    const farmerPhone2 = `91${unique}22`.slice(0, 10);
    const farmerPwd2 = `KisanPass${unique}!`;
    const signupFarmerRes = await post('/auth/signup/farmer', {
      name: 'Rameshwar Dayal',
      phone: farmerPhone2,
      villageDistrict: 'Fatehabad, Agra, UP',
      mainCrops: ['Wheat'],
      password: farmerPwd2
    });
    assert('Farmer signup accepts password and sends OTP', signupFarmerRes.status === 200 && signupFarmerRes.data.success);
    
    // Verify OTP to activate
    const farmerVerify = await post('/auth/otp/verify', {
      phone: farmerPhone2,
      code: signupFarmerRes.data.demoOtp || '123456',
      expectedRole: 'farmer'
    });
    assert('Farmer verifies OTP and account is active', farmerVerify.status === 200 && farmerVerify.data.user?.role === 'farmer');

    // 13. Farmer can now log in via password directly!
    const farmerLoginViaPwd = await post('/auth/login', {
      identifier: farmerPhone2,
      password: farmerPwd2,
      expectedRole: 'farmer'
    });
    assert('Farmer who set password during signup can log in directly with password', farmerLoginViaPwd.status === 200 && farmerLoginViaPwd.data.user?.phone === farmerPhone2);

    console.log(`\nResults: ${passed}/${passed + failed} Google Auth & Password Login tests passed.`);
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
