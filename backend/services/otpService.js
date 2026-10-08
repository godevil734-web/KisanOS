// backend/services/otpService.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { safeQuery } = require('../db');

function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

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

/**
 * Send Transactional Verification OTP Email via Brevo REST API
 */
async function sendBrevoEmail({ toEmail, code, recipientName = 'KisanConnect User' }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.trim() === 'YOUR_BREVO_API_KEY') {
    console.error('[BREVO] Error: BREVO_API_KEY is not configured in backend environment.');
    return { 
      success: false, 
      error: 'Email service is not configured. Please ensure BREVO_API_KEY is set in backend environment.' 
    };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'kishanconnectos@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'KisanConnect';
  const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5;

  const subject = 'Your KisanConnect Verification Code';
  const textContent = `KisanConnect\n\nYour verification OTP is:\n\n${code}\n\nThis OTP is valid for ${expiryMinutes} minutes.\n\nDo not share this OTP with anyone.\n\nIf you did not request this OTP, you can safely ignore this email.\n\nKisanConnect Team`;

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your KisanConnect Verification Code</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" max-width="560px" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;" cellpadding="0" cellspacing="0">
            <!-- Header Banner -->
            <tr>
              <td style="background: linear-gradient(135deg, #064e3b 0%, #047857 60%, #0f172a 100%); padding: 36px 32px; text-align: center;">
                <div style="font-size: 32px; line-height: 1; margin-bottom: 8px;">🌾</div>
                <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">
                  KisanConnect
                </h1>
                <p style="margin: 6px 0 0; color: #a7f3d0; font-size: 13px; font-weight: 500; letter-spacing: 0.5px;">
                  Empowering Indian Agriculture & Direct Trade
                </p>
              </td>
            </tr>
            <!-- Main Content -->
            <tr>
              <td style="padding: 36px 32px;">
                <h2 style="margin: 0 0 12px; color: #0f172a; font-size: 20px; font-weight: 700;">
                  Your Verification Code
                </h2>
                <p style="margin: 0 0 24px; color: #475569; font-size: 15px; line-height: 1.6;">
                  Hello, please use the 6-digit one-time password (OTP) below to authenticate your KisanConnect account.
                </p>
                <!-- OTP Box -->
                <div style="background-color: #f0fdf4; border: 2px dashed #10b981; border-radius: 14px; padding: 24px 16px; text-align: center; margin-bottom: 24px;">
                  <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #047857; font-weight: 700; margin-bottom: 8px;">
                    One-Time Password (OTP)
                  </div>
                  <div style="font-size: 40px; font-weight: 900; letter-spacing: 10px; color: #064e3b; font-family: 'Courier New', Courier, monospace;">
                    ${code}
                  </div>
                  <div style="margin-top: 10px; font-size: 12px; color: #059669; font-weight: 600;">
                    ⏱️ Valid for ${expiryMinutes} minutes
                  </div>
                </div>
                <!-- Security Guidance -->
                <div style="background-color: #f8fafc; border-radius: 10px; padding: 16px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                  <p style="margin: 0 0 8px; color: #475569; font-size: 13px; line-height: 1.5;">
                    🔒 <strong>Security Notice:</strong> Never share this OTP with anyone, including any KisanConnect representative.
                  </p>
                  <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.5;">
                    If you did not request this OTP, you can safely ignore this email. No changes have been made to your account.
                  </p>
                </div>
                <p style="margin: 0; color: #0f172a; font-size: 14px; font-weight: 600;">
                  Warm regards,<br>
                  <span style="color: #047857;">The KisanConnect Team</span>
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
                <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                  This is an automated notification from KisanConnect. Please do not reply directly to this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  console.log('[OTP] Brevo request starting');
  console.log(`[OTP] Email: ${toEmail}`);

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey.trim(),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: toEmail, name: recipientName }],
        subject,
        htmlContent,
        textContent
      })
    });

    console.log(`[OTP] Brevo response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OTP] Brevo error response (${response.status}):`, errorText);

      let userFriendlyError = 'Unable to send verification code. Please try again.';
      if (errorText.includes('unrecognised IP address') || errorText.includes('authorised_ips')) {
        console.error('[OTP] ACTION REQUIRED: Your current IP is not authorized in Brevo. Visit https://app.brevo.com/security/authorised_ips to add this IP or deactivate API IP blocking.');
        userFriendlyError = 'Brevo blocked API request due to unrecognized IP address. Please deactivate IP blocking in Brevo settings (https://app.brevo.com/security/authorised_ips).';
      } else if (response.status === 401) {
        userFriendlyError = 'Brevo authentication failed (invalid API key or unauthorized IP).';
      }

      return { 
        success: false, 
        error: userFriendlyError,
        statusCode: response.status
      };
    }

    const data = await response.json().catch(() => ({}));
    console.log(`[OTP] Verification email delivered to ${maskEmail(toEmail)} (messageId: ${data.messageId || 'ok'})`);
    return { success: true, messageId: data.messageId };
  } catch (err) {
    console.error('[OTP] Network exception during Brevo email dispatch:', err.message);
    return { 
      success: false, 
      error: 'Unable to reach email delivery service. Please try again in a few moments.' 
    };
  }
}

class DatabaseOtpProvider {
  constructor() {
    this.OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5;
    this.OTP_EXPIRY_MS = this.OTP_EXPIRY_MINUTES * 60 * 1000;
    this.COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 10) || 60;
    this.MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5;
  }

  getExpiryMs() {
    const mins = parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || this.OTP_EXPIRY_MINUTES;
    return mins * 60 * 1000;
  }

  getCooldownSeconds() {
    return parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 10) || this.COOLDOWN_SECONDS;
  }

  getMaxAttempts() {
    return parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || this.MAX_ATTEMPTS;
  }

  /**
   * Send OTP to Phone or Email
   */
  async sendOtp(phoneOrEmail, options = {}) {
    const raw = (phoneOrEmail || '').trim().toLowerCase();
    const isEmail = raw.includes('@');
    const normalized = isEmail ? raw : raw.replace(/\D/g, '').slice(-10);

    // Validation
    if (isEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!raw || !emailRegex.test(raw) || raw.length < 5) {
        return { success: false, error: 'Please enter a valid email address' };
      }
    } else {
      if (!normalized || normalized.length !== 10) {
        return { success: false, error: 'Please enter a valid 10-digit mobile number' };
      }
    }

    const cooldownSec = this.getCooldownSeconds();

    // Check resend cooldown from database
    const existingOtp = await safeQuery(
      'SELECT created_at FROM otps WHERE phone = $1',
      [normalized]
    );

    if (existingOtp.rows.length > 0) {
      const lastCreated = new Date(existingOtp.rows[0].created_at).getTime();
      const elapsedSeconds = Math.floor((Date.now() - lastCreated) / 1000);
      if (elapsedSeconds < cooldownSec) {
        const waitTime = cooldownSec - elapsedSeconds;
        return {
          success: false,
          error: `Please wait ${waitTime}s before requesting a new OTP.`
        };
      }
    }

    // Cryptographically secure generation (never Math.random)
    let code;
    let isDemo = false;

    if (isEmail) {
      // EMAILS ALWAYS GET REAL CRYPTOGRAPHIC OTP SENT VIA BREVO
      code = crypto.randomInt(100000, 1000000).toString();
      isDemo = false;
    } else {
      // Phone number: check demo phone list
      const isDemoMode = process.env.DEMO_MODE === 'true';
      isDemo = isDemoMode && isAllowedDemoPhone(normalized);
      code = isDemo ? '123456' : crypto.randomInt(100000, 1000000).toString();
    }

    // Store OTP securely hashed (never plain text)
    const hashedCode = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + this.getExpiryMs());

    // Upsert into otps table
    await safeQuery(`
      INSERT INTO otps (phone, code, expires_at, attempts, created_at)
      VALUES ($1, $2, $3, 0, NOW())
      ON CONFLICT (phone) DO UPDATE SET
        code = EXCLUDED.code,
        expires_at = EXCLUDED.expires_at,
        attempts = 0,
        created_at = NOW()
    `, [normalized, hashedCode, expiresAt]);

    // Clean up expired OTPs periodically
    safeQuery('DELETE FROM otps WHERE expires_at < NOW()').catch(() => {});

    // If Email: Dispatch through Brevo
    if (isEmail) {
      const emailResult = await sendBrevoEmail({
        toEmail: normalized,
        code,
        recipientName: options.recipientName || 'KisanConnect User'
      });

      if (!emailResult.success) {
        // Remove the newly created OTP if email delivery failed
        await safeQuery('DELETE FROM otps WHERE phone = $1', [normalized]).catch(() => {});
        return {
          success: false,
          error: emailResult.error || 'Unable to send OTP email. Please try again.'
        };
      }

      // Security: Never return code or demoCode for email
      return {
        success: true,
        message: 'OTP sent successfully to your email.',
        expiresInSeconds: Math.floor(this.getExpiryMs() / 1000),
        isEmail: true
      };
    }

    // Phone flow
    const hasExternalSms = Boolean(process.env.SMS_GATEWAY_URL);
    return {
      success: true,
      message: 'OTP sent successfully to your mobile number.',
      demoCode: (isDemo || !hasExternalSms) ? code : undefined,
      expiresInSeconds: Math.floor(this.getExpiryMs() / 1000),
      isDemo,
      isEmail: false
    };
  }

  /**
   * Verify OTP
   */
  async verifyOtp(phoneOrEmail, inputCode) {
    const raw = (phoneOrEmail || '').trim().toLowerCase();
    const isEmail = raw.includes('@');
    const normalized = isEmail ? raw : raw.replace(/\D/g, '').slice(-10);

    if (!normalized || !inputCode) {
      return { 
        valid: false, 
        error: isEmail ? 'Email and OTP code are required.' : 'Phone number and OTP code are required.' 
      };
    }

    const res = await safeQuery(
      'SELECT code, expires_at, attempts FROM otps WHERE phone = $1',
      [normalized]
    );

    if (res.rows.length === 0) {
      return { valid: false, error: 'No active OTP found. Please request a new OTP.' };
    }

    const record = res.rows[0];
    const maxAttempts = this.getMaxAttempts();

    // Check expiration
    if (new Date() > new Date(record.expires_at)) {
      safeQuery('DELETE FROM otps WHERE phone = $1', [normalized]).catch(() => {});
      return { valid: false, error: 'OTP has expired. Please request a new OTP.' };
    }

    // Check max attempts
    if (record.attempts >= maxAttempts) {
      safeQuery('DELETE FROM otps WHERE phone = $1', [normalized]).catch(() => {});
      return { valid: false, error: 'Too many attempts. Please request a new OTP.' };
    }

    // Verify hashed code
    const isMatch = await bcrypt.compare(inputCode.trim(), record.code);
    if (!isMatch) {
      const newAttempts = record.attempts + 1;
      if (newAttempts >= maxAttempts) {
        await safeQuery('DELETE FROM otps WHERE phone = $1', [normalized]);
        return { valid: false, error: 'Too many attempts. Please request a new OTP.' };
      }

      await safeQuery('UPDATE otps SET attempts = $1 WHERE phone = $2', [newAttempts, normalized]);
      const remaining = maxAttempts - newAttempts;
      return { 
        valid: false, 
        error: `Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` 
      };
    }

    // Valid OTP: Invalidate immediately and delete row
    await safeQuery('DELETE FROM otps WHERE phone = $1', [normalized]);
    return { valid: true };
  }
}

const otpProvider = new DatabaseOtpProvider();

module.exports = { 
  otpProvider, 
  DatabaseOtpProvider, 
  isAllowedDemoPhone,
  sendBrevoEmail,
  maskEmail
};
