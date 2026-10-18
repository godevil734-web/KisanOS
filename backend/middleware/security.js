// backend/middleware/security.js
// Comprehensive Security Suite for KisanConnect:
// 1. Helmet Security Headers & Content Security Policy (CSP)
// 2. Request Input Sanitization (XSS, Script Injections, Null Bytes)
// 3. Brute Force Protection & Account Lockout Tracker
// 4. Password Strength Validation
// 5. Sensitive Data Redaction & Masking
// 6. Centralized Safe Production Error Handler

const helmet = require('helmet');

// ============================================================================
// 1. HELMET SECURITY HEADERS & CSP CONFIGURATION
// ============================================================================
function configureHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'", 
          "'unsafe-inline'", 
          "'unsafe-eval'", 
          "https://accounts.google.com", 
          "https://apis.google.com", 
          "https://cdn.jsdelivr.net"
        ],
        styleSrc: [
          "'self'", 
          "'unsafe-inline'", 
          "https://fonts.googleapis.com"
        ],
        fontSrc: [
          "'self'", 
          "https://fonts.gstatic.com", 
          "data:"
        ],
        imgSrc: [
          "'self'", 
          "data:", 
          "blob:", 
          "https://images.unsplash.com", 
          "https://*.googleusercontent.com", 
          "https://lh3.googleusercontent.com", 
          "https://*.tile.openstreetmap.org"
        ],
        connectSrc: [
          "'self'", 
          "http://localhost:*", 
          "ws://localhost:*", 
          "https://accounts.google.com", 
          "https://api.brevo.com"
        ],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        objectSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false, // Allows cross-origin assets (Unsplash, CDN fonts)
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  });
}

// ============================================================================
// 2. REQUEST INPUT SANITIZATION (XSS, SCRIPT INJECTION, NULL BYTES)
// ============================================================================
const SENSITIVE_PRESERVE_KEYS = new Set([
  'password', 
  'currentPassword', 
  'newPassword', 
  'confirmPassword', 
  'token', 
  'code', 
  'otp', 
  'refreshToken', 
  'apiKey'
]);

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  // 1. Remove null bytes
  let cleaned = str.replace(/\0/g, '');
  
  // 2. Strip script tags and their inner content
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // 3. Strip iframe, object, embed tags
  cleaned = cleaned.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  cleaned = cleaned.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  cleaned = cleaned.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
  
  // 4. Strip dangerous inline event handlers like onerror=, onload=, onclick=
  cleaned = cleaned.replace(/\s*on\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');
  
  // 5. Neutralize javascript: and vbscript: URIs
  cleaned = cleaned.replace(/(javascript|vbscript):/gi, '$1_blocked:');

  return cleaned;
}

function sanitizeObject(obj, keyName = '') {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    if (SENSITIVE_PRESERVE_KEYS.has(keyName)) {
      return obj; // preserve passwords, auth tokens, OTP codes
    }
    return sanitizeString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, keyName));
  }
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Prevent prototype pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      sanitized[key] = sanitizeObject(value, key);
    }
    return sanitized;
  }
  return obj;
}

function sanitizeInputs(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
}

// ============================================================================
// 3. BRUTE FORCE PROTECTION & ACCOUNT LOCKOUT TRACKER
// ============================================================================
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const lockoutStore = new Map();

function cleanLockoutStore() {
  const now = Date.now();
  for (const [key, record] of lockoutStore.entries()) {
    if (record.lockUntil && record.lockUntil < now) {
      lockoutStore.delete(key);
    } else if (!record.lockUntil && record.firstAttempt && (now - record.firstAttempt > LOCKOUT_WINDOW_MS)) {
      lockoutStore.delete(key);
    }
  }
}
setInterval(cleanLockoutStore, 5 * 60 * 1000).unref();

function getNormalizedKey(identifier, ip) {
  const normId = (identifier || '').trim().toLowerCase();
  const clientIp = (ip || '').trim();
  return normId ? `acc:${normId}` : `ip:${clientIp}`;
}

function checkAccountLockout(identifier, ip) {
  const key = getNormalizedKey(identifier, ip);
  const record = lockoutStore.get(key);
  if (!record) return { locked: false, remainingMs: 0 };

  const now = Date.now();
  if (record.lockUntil && record.lockUntil > now) {
    return {
      locked: true,
      remainingMs: record.lockUntil - now,
      remainingMinutes: Math.ceil((record.lockUntil - now) / 60000)
    };
  }

  // Lock expired
  if (record.lockUntil && record.lockUntil <= now) {
    lockoutStore.delete(key);
    return { locked: false, remainingMs: 0 };
  }

  return { locked: false, remainingMs: 0 };
}

function recordFailedLogin(identifier, ip) {
  const key = getNormalizedKey(identifier, ip);
  const now = Date.now();
  let record = lockoutStore.get(key);

  if (!record || (now - record.firstAttempt > LOCKOUT_WINDOW_MS)) {
    record = {
      attempts: 1,
      firstAttempt: now,
      lockUntil: null
    };
  } else {
    record.attempts += 1;
    if (record.attempts >= MAX_FAILED_ATTEMPTS) {
      record.lockUntil = now + LOCKOUT_WINDOW_MS;
    }
  }

  lockoutStore.set(key, record);
  return {
    attempts: record.attempts,
    locked: Boolean(record.lockUntil && record.lockUntil > now),
    remainingMs: record.lockUntil ? Math.max(0, record.lockUntil - now) : 0
  };
}

function recordSuccessfulLogin(identifier, ip) {
  const key = getNormalizedKey(identifier, ip);
  lockoutStore.delete(key);
}

function resetLockoutStore() {
  lockoutStore.clear();
}

function accountLockoutMiddleware(req, res, next) {
  const identifier = (req.body?.identifier || req.body?.email || req.body?.phone || '').trim();
  const ip = req.ip || req.connection?.remoteAddress;
  const status = checkAccountLockout(identifier, ip);

  if (status.locked) {
    res.setHeader('Retry-After', Math.ceil(status.remainingMs / 1000));
    return res.status(423).json({
      error: 'ACCOUNT_TEMPORARILY_LOCKED',
      message: `Account is temporarily locked due to multiple consecutive failed login attempts. Please try again in ${status.remainingMinutes} minute(s).`,
      retryAfterSeconds: Math.ceil(status.remainingMs / 1000)
    });
  }
  next();
}

// ============================================================================
// 4. PASSWORD STRENGTH VALIDATION
// ============================================================================
const WEAK_PASSWORDS = new Set([
  'password', 'password123', '12345678', '123456789', 'admin123', 'qwertyuiop', 'kisan123', 'farmer123'
]);

function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }

  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, error: 'Password is too common or weak. Please choose a more secure password.' };
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigitOrSpecial = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  if (!hasLetter || !hasDigitOrSpecial) {
    return { 
      valid: false, 
      error: 'Password must contain both letters and numbers or symbols' 
    };
  }

  return { valid: true };
}

// ============================================================================
// 5. SENSITIVE DATA REDACTION & MASKING
// ============================================================================
function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '******' + digits;
  return '******' + digits.slice(-4);
}

function maskAadhaar(aadhaar) {
  if (!aadhaar || typeof aadhaar !== 'string') return '';
  const clean = aadhaar.replace(/\D/g, '');
  if (clean.length < 4) return 'XXXX-XXXX-XXXX';
  return `XXXX-XXXX-${clean.slice(-4)}`;
}

function sanitizeUserData(user, viewer = null) {
  if (!user || typeof user !== 'object') return user;
  const safe = { ...user };

  // Always delete internal secrets and hashes
  delete safe.password;
  delete safe.password_hash;
  delete safe.otp;
  delete safe.otp_code;
  delete safe.otpExpiry;
  delete safe.verification_token;
  delete safe.reset_token;

  const isSelf = viewer && viewer.id === user.id;
  const isAdmin = viewer && viewer.role === 'admin';

  // If not viewing own profile and not an admin, mask phone & Aadhaar
  if (!isSelf && !isAdmin) {
    if (safe.phone) {
      safe.phone = maskPhone(safe.phone);
    }
    if (safe.aadhaar) {
      safe.aadhaar = maskAadhaar(safe.aadhaar);
    }
    if (safe.farmerProfile?.aadhaar) {
      safe.farmerProfile = {
        ...safe.farmerProfile,
        aadhaar: maskAadhaar(safe.farmerProfile.aadhaar)
      };
    }
  }

  return safe;
}

// ============================================================================
// 6. CENTRALIZED SAFE PRODUCTION ERROR HANDLER
// ============================================================================
function safeErrorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const status = Number(err.status || err.statusCode) || 500;

  // Always log error details on server side
  console.error(`[SECURITY ERROR HANDLER] ${req.method} ${req.path} -> Status ${status}:`, err.message || err);

  // Return clean, un-leaked response to client
  if (status >= 500) {
    return res.status(status).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: isProd ? 'An unexpected server error occurred. Please try again later.' : (err.message || 'Server error')
    });
  }

  return res.status(status).json({
    error: err.name || 'REQUEST_ERROR',
    message: err.message || 'An error occurred processing your request.'
  });
}

module.exports = {
  configureHelmet,
  sanitizeInputs,
  sanitizeString,
  sanitizeObject,
  validatePasswordStrength,
  checkAccountLockout,
  recordFailedLogin,
  recordSuccessfulLogin,
  resetLockoutStore,
  accountLockoutMiddleware,
  maskPhone,
  maskAadhaar,
  sanitizeUserData,
  safeErrorHandler
};
