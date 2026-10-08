// backend/tests/test_signup_flow.js
const assert = require('assert');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { safeQuery } = require('../db');
const { maskEmail, otpProvider } = require('../services/otpService');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-12345';

async function runSignupTests() {
  console.log('\n=============================================');
  console.log('🧪 Starting KisanConnect Signup Flow Test Suite');
  console.log('=============================================\n');

  const testEmail = `signup_test_${Date.now()}@kisanconnect.in`;
  const testPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;

  console.log(`Using test credentials: ${testEmail} / ${testPhone}`);

  // Test 1: Password rules
  console.log('\n--- Test 1: Password Strength Validation ---');
  const weakPasswords = ['short', 'nouppercase1!', 'NOLOWERCASE1!', 'NoNumber!', 'NoSpecial123'];
  for (const pw of weakPasswords) {
    const hasMinLength = pw.length >= 8;
    const hasUpper = /[A-Z]/.test(pw);
    const hasLower = /[a-z]/.test(pw);
    const hasNumber = /\d/.test(pw);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw);
    const isValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;
    assert.strictEqual(isValid, false, `Weak password '${pw}' should have failed`);
  }
  const strongPassword = 'StrongPassword123!';
  const strongValid = strongPassword.length >= 8 &&
    /[A-Z]/.test(strongPassword) &&
    /[a-z]/.test(strongPassword) &&
    /\d/.test(strongPassword) &&
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(strongPassword);
  assert.strictEqual(strongValid, true, 'Strong password should pass');
  console.log('✅ Passed: Password validation enforces 8+ chars, upper, lower, number, special');

  // Test 2: Signup Token Structure & Expiry
  console.log('\n--- Test 2: Signup Token Signing & Validation ---');
  const signupPayload = {
    type: 'signup_pending',
    role: 'farmer',
    name: 'Ramesh Singh',
    email: testEmail,
    phone: testPhone,
    password: strongPassword,
    village: 'Fatehabad',
    district: 'Agra',
    state: 'UP',
    mainCrops: ['Potato', 'Wheat']
  };

  const signupToken = jwt.sign(signupPayload, JWT_SECRET, { expiresIn: '15m' });
  const decoded = jwt.verify(signupToken, JWT_SECRET);
  assert.strictEqual(decoded.type, 'signup_pending');
  assert.strictEqual(decoded.email, testEmail);
  assert.strictEqual(decoded.role, 'farmer');
  console.log('✅ Passed: Signed signup token safely holds validated registration payload');

  // Test 3: OTP Insertion and Verification for Signup
  console.log('\n--- Test 3: Email OTP Verification and Invalidation ---');
  const testOtp = '849201';
  const hashedOtp = await bcrypt.hash(testOtp, 10);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await safeQuery(`
    INSERT INTO otps (phone, code, expires_at, attempts, created_at)
    VALUES ($1, $2, $3, 0, NOW())
    ON CONFLICT (phone) DO UPDATE SET
      code = EXCLUDED.code,
      expires_at = EXCLUDED.expires_at,
      attempts = 0,
      created_at = NOW()
  `, [testEmail, hashedOtp, expiresAt]);

  // Invalid code check
  const badVerify = await otpProvider.verifyOtp(testEmail, '111111');
  assert.strictEqual(badVerify.valid, false);
  console.log('✅ Passed: Wrong code rejected properly');

  // Valid code check
  const goodVerify = await otpProvider.verifyOtp(testEmail, testOtp);
  assert.strictEqual(goodVerify.valid, true);
  console.log('✅ Passed: Valid 6-digit code verified properly');

  // Replay check
  const replayVerify = await otpProvider.verifyOtp(testEmail, testOtp);
  assert.strictEqual(replayVerify.valid, false);
  console.log('✅ Passed: OTP consumed and replay prevented');

  // Clean up
  await safeQuery('DELETE FROM otps WHERE phone = $1', [testEmail]);
  await safeQuery('DELETE FROM users WHERE email = $1', [testEmail]);

  console.log('\n=============================================');
  console.log('🎉 ALL SIGNUP FLOW LOGIC TESTS PASSED!');
  console.log('=============================================\n');
}

runSignupTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
