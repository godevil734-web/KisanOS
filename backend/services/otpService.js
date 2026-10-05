// backend/services/otpService.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool, safeQuery } = require('../db');

function isAllowedDemoPhone(phone) {
  if (process.env.DEMO_MODE !== 'true') return false;
  const rawList = process.env.DEMO_PHONES;
  if (!rawList) return false;

  const normalized = (phone || '').replace(/\D/g, '').slice(-10);
  const items = rawList.split(',').map(s => s.trim()).filter(Boolean);

  return items.some(item => {
    if (item.endsWith('*')) {
      const prefix = item.slice(0, -1).replace(/\D/g, '');
      return normalized.startsWith(prefix);
    }
    const cleanItem = item.replace(/\D/g, '').slice(-10);
    return cleanItem === normalized;
  });
}

class DatabaseOtpProvider {
  constructor() {
    this.OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
    this.MAX_ATTEMPTS = 5;
  }

  async sendOtp(phoneOrEmail) {
    const raw = (phoneOrEmail || '').trim().toLowerCase();
    const isEmail = raw.includes('@');
    let normalized = isEmail ? raw : raw.replace(/\D/g, '').slice(-10);

    if (isEmail) {
      if (!raw || !raw.includes('.') || raw.length < 5) {
        return { success: false, error: 'Please enter a valid email address' };
      }
    } else {
      if (!normalized || normalized.length !== 10) {
        return { success: false, error: 'Please enter a valid 10-digit mobile number' };
      }
    }

    const isDemoMode = process.env.DEMO_MODE === 'true';
    const isDemo = isEmail ? isDemoMode : (isDemoMode && isAllowedDemoPhone(normalized));

    // Cryptographically secure generation (never Math.random)
    const code = isDemo
      ? '123456'
      : crypto.randomInt(100000, 1000000).toString();

    // Store OTP hashed (never plain text)
    const hashedCode = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MS);

    // Upsert into otps table (single database write with automatic reconnect)
    await safeQuery(`
      INSERT INTO otps (phone, code, expires_at, attempts, created_at)
      VALUES ($1, $2, $3, 0, NOW())
      ON CONFLICT (phone) DO UPDATE SET
        code = EXCLUDED.code,
        expires_at = EXCLUDED.expires_at,
        attempts = 0,
        created_at = NOW()
    `, [normalized, hashedCode, expiresAt]);

    // Inline cleanup of expired OTP rows
    try {
      await safeQuery('DELETE FROM otps WHERE expires_at < NOW()');
    } catch (cleanupErr) {}

    console.log(`[OTP] Generated OTP for ${normalized}: ${code}`);

    const hasExternalSms = Boolean(process.env.SMS_GATEWAY_URL);
    return {
      success: true,
      demoCode: (isDemo || !hasExternalSms) ? code : undefined,
      expiresInSeconds: Math.floor(this.OTP_EXPIRY_MS / 1000),
      isDemo
    };
  }

  async verifyOtp(phoneOrEmail, inputCode) {
    const raw = (phoneOrEmail || '').trim().toLowerCase();
    const isEmail = raw.includes('@');
    const normalized = isEmail ? raw : raw.replace(/\D/g, '').slice(-10);

    if (!normalized || !inputCode) {
      return { valid: false, error: isEmail ? 'Email and OTP code are required.' : 'Phone number and OTP code are required.' };
    }

    const res = await safeQuery(
      'SELECT code, expires_at, attempts FROM otps WHERE phone = $1',
      [normalized]
    );

    if (res.rows.length === 0) {
      return { valid: false, error: 'No active OTP found. Please request a new OTP.' };
    }

    const record = res.rows[0];

    // Check expiration
    if (new Date() > new Date(record.expires_at)) {
      safeQuery('DELETE FROM otps WHERE phone = $1', [normalized]).catch(() => {});
      return { valid: false, error: 'OTP has expired (valid for 5 minutes). Please request a new OTP.' };
    }

    // Check max attempts
    if (record.attempts >= this.MAX_ATTEMPTS) {
      safeQuery('DELETE FROM otps WHERE phone = $1', [normalized]).catch(() => {});
      return { valid: false, error: 'Too many incorrect attempts (max 5). Please request a new OTP.' };
    }

    // Verify hashed code
    const isMatch = await bcrypt.compare(inputCode.trim(), record.code);
    if (!isMatch) {
      const newAttempts = record.attempts + 1;
      if (newAttempts >= this.MAX_ATTEMPTS) {
        await safeQuery('DELETE FROM otps WHERE phone = $1', [normalized]);
        return { valid: false, error: 'Too many incorrect attempts (max 5). Please request a new OTP.' };
      }

      await safeQuery('UPDATE otps SET attempts = $1 WHERE phone = $2', [newAttempts, normalized]);
      const remaining = this.MAX_ATTEMPTS - newAttempts;
      return { 
        valid: false, 
        error: `Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` 
      };
    }

    // Valid OTP: consume and delete row
    await safeQuery('DELETE FROM otps WHERE phone = $1', [normalized]);
    return { valid: true };
  }
}

const otpProvider = new DatabaseOtpProvider();

module.exports = { otpProvider, DatabaseOtpProvider, isAllowedDemoPhone };
