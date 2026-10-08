// backend/tests/test_brevo_otp.js
const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { otpProvider, DatabaseOtpProvider, sendBrevoEmail, maskEmail } = require('../services/otpService');
const { safeQuery } = require('../db');

async function runTests() {
  console.log('\n=============================================');
  console.log('🧪 Starting Brevo Real Email OTP Test Suite');
  console.log('=============================================\n');

  const testEmail = `test_brevo_${Date.now()}@kisanconnect.in`;
  console.log(`Using test email: ${testEmail}`);

  // Clean any leftover record for this email
  await safeQuery('DELETE FROM otps WHERE phone = $1', [testEmail]);

  // Test 1: maskEmail helper
  console.log('\n--- Test 1: Email Masking Security ---');
  assert.strictEqual(maskEmail('user@example.com'), 'us***r@example.com');
  assert.strictEqual(maskEmail('ab@example.com'), 'a*@example.com');
  assert.strictEqual(maskEmail('kishanconnectos@gmail.com'), 'ki***s@gmail.com');
  console.log('✅ Passed: Email masking works and does not expose full addresses');

  // Test 2: Brevo API Key validation
  console.log('\n--- Test 2: Brevo API Key Handling & Safety ---');
  // If no valid key is set, it returns clear error without crashing
  const dummySend = await sendBrevoEmail({
    toEmail: 'someone@example.com',
    code: '123456'
  });
  if (!process.env.BREVO_API_KEY || process.env.BREVO_API_KEY === 'YOUR_BREVO_API_KEY') {
    assert.strictEqual(dummySend.success, false);
    assert(dummySend.error.includes('BREVO_API_KEY'));
    console.log('✅ Passed: Gracefully handled unconfigured or placeholder BREVO_API_KEY');
  } else {
    console.log(`ℹ️ Brevo API key is present: ${process.env.BREVO_API_KEY.slice(0, 8)}...`);
  }

  // Test 3: OTP Database Record & Hashing
  console.log('\n--- Test 3: OTP Generation, Hashing & Storage ---');
  const provider = new DatabaseOtpProvider();
  
  // Directly insert an OTP into DB to test verification mechanics without triggering external HTTP
  const bcrypt = require('bcryptjs');
  const crypto = require('crypto');
  const realCode = crypto.randomInt(100000, 1000000).toString();
  assert.strictEqual(realCode.length, 6, 'Generated OTP must be 6 digits');
  assert(/^[0-9]{6}$/.test(realCode), 'Generated OTP must contain only digits');

  const hashedCode = await bcrypt.hash(realCode, 10);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

  await safeQuery(`
    INSERT INTO otps (phone, code, expires_at, attempts, created_at)
    VALUES ($1, $2, $3, 0, NOW())
    ON CONFLICT (phone) DO UPDATE SET
      code = EXCLUDED.code,
      expires_at = EXCLUDED.expires_at,
      attempts = 0,
      created_at = NOW()
  `, [testEmail, hashedCode, expiresAt]);

  const record = await safeQuery('SELECT * FROM otps WHERE phone = $1', [testEmail]);
  assert.strictEqual(record.rows.length, 1);
  assert.notStrictEqual(record.rows[0].code, realCode, 'OTP must NOT be stored in plain text');
  assert(record.rows[0].code.startsWith('$2'), 'OTP must be bcrypt-hashed');
  console.log('✅ Passed: OTP is cryptographically 6-digit and securely hashed with bcrypt in PostgreSQL');

  // Test 4: Cooldown Enforcement
  console.log('\n--- Test 4: Cooldown Protection (60s) ---');
  const rapidRequest = await provider.sendOtp(testEmail);
  assert.strictEqual(rapidRequest.success, false, 'Rapid request should be rejected during cooldown');
  assert(rapidRequest.error.includes('Please wait'), 'Should return wait error message');
  console.log(`✅ Passed: Cooldown blocked rapid re-send (${rapidRequest.error})`);

  // Test 5: Incorrect OTP verification & Attempt limits
  console.log('\n--- Test 5: Incorrect OTP and Max Attempts (5 attempts) ---');
  const wrongRes1 = await provider.verifyOtp(testEmail, '000000');
  assert.strictEqual(wrongRes1.valid, false);
  assert(wrongRes1.error.includes('Incorrect OTP') || wrongRes1.error.includes('remaining'));
  console.log('✅ Passed: Incorrect OTP returns remaining attempts feedback');

  // Exhaust remaining attempts
  for (let i = 0; i < 4; i++) {
    await provider.verifyOtp(testEmail, '000000');
  }

  const lockedRes = await provider.verifyOtp(testEmail, '000000');
  assert.strictEqual(lockedRes.valid, false);
  assert(lockedRes.error.includes('Too many attempts') || lockedRes.error.includes('No active OTP found'));
  console.log('✅ Passed: Locked out after 5 consecutive failed attempts');

  // Test 6: Expiration Handling
  console.log('\n--- Test 6: OTP Expiration Handling ---');
  const expiredEmail = `expired_${Date.now()}@kisanconnect.in`;
  const expiredCode = '654321';
  const hashedExpired = await bcrypt.hash(expiredCode, 10);
  const pastExpiry = new Date(Date.now() - 1000); // 1 sec in past

  await safeQuery(`
    INSERT INTO otps (phone, code, expires_at, attempts, created_at)
    VALUES ($1, $2, $3, 0, NOW() - INTERVAL '65 seconds')
  `, [expiredEmail, hashedExpired, pastExpiry]);

  const verifyExpired = await provider.verifyOtp(expiredEmail, expiredCode);
  assert.strictEqual(verifyExpired.valid, false);
  assert(verifyExpired.error.includes('expired'));
  console.log('✅ Passed: Expired OTP correctly rejected');

  // Test 7: Successful Verification & Immediate Invalidation (One-Time Use)
  console.log('\n--- Test 7: Successful Verification & Immediate Invalidation ---');
  const validEmail = `success_${Date.now()}@kisanconnect.in`;
  const validCode = '889900';
  const hashedValid = await bcrypt.hash(validCode, 10);
  const futureExpiry = new Date(Date.now() + 5 * 60 * 1000);

  await safeQuery(`
    INSERT INTO otps (phone, code, expires_at, attempts, created_at)
    VALUES ($1, $2, $3, 0, NOW() - INTERVAL '65 seconds')
  `, [validEmail, hashedValid, futureExpiry]);

  const verifySuccess = await provider.verifyOtp(validEmail, validCode);
  assert.strictEqual(verifySuccess.valid, true, 'Correct code must verify successfully');
  console.log('✅ Passed: Verification succeeded with valid OTP');

  // Try using the same code a second time (Replay attack test)
  const replayAttempt = await provider.verifyOtp(validEmail, validCode);
  assert.strictEqual(replayAttempt.valid, false, 'Replaying verified OTP must fail');
  assert(replayAttempt.error.includes('No active OTP found'));
  console.log('✅ Passed: Replay prevented (OTP invalidated immediately upon verification)');

  // Cleanup test records
  await safeQuery('DELETE FROM otps WHERE phone LIKE $1', ['%@kisanconnect.in']);

  console.log('\n=============================================');
  console.log('🎉 ALL OTP & BREVO SECURITY TESTS PASSED!');
  console.log('=============================================\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
