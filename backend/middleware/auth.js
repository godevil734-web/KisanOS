// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { findUserById } = require('../db');

// JWT_SECRET resolution: strictly environment-driven, no hardcoded production fallback
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    console.error('FATAL: JWT_SECRET environment variable is missing in production/Vercel mode. Refusing to start.');
    process.exit(1);
  } else {
    JWT_SECRET = crypto.randomBytes(32).toString('hex');
    console.warn('[SECURITY WARNING] JWT_SECRET is not set in environment. Generated random ephemeral secret for this session.');
  }
}

function getCookieOptions() {
  const isSecure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' || process.env.COOKIE_SECURE === 'true';
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  };
}

// Zero-dependency cookie parser helper
function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      const name = parts.shift().trim();
      const val = parts.join('=').trim();
      if (name) {
        list[name] = decodeURIComponent(val);
      }
    });
  }
  return list;
}

// Authentication middleware (supports httpOnly cookie + Authorization header)
async function authMiddleware(req, res, next) {
  const cookies = parseCookies(req);
  let token = cookies.token || cookies.kc_session;

  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please login.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User account not found.' });
    }
    if (user.status === 'blocked') {
      return res.status(403).json({ 
        error: 'ACCOUNT_BLOCKED', 
        message: 'Your account has been suspended by administration. Please contact support.' 
      });
    }
    if (user.status === 'rejected') {
      const reasonMsg = user.rejectionReason || user.rejection_reason ? ` Reason: ${user.rejectionReason || user.rejection_reason}` : '';
      return res.status(403).json({ 
        error: 'ACCOUNT_REJECTED', 
        message: `Your account registration was not approved by administration.${reasonMsg}` 
      });
    }
    // Enforce that user.role in DB is authoritative
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid. Please login again.' });
  }
}

// Optional Auth (for public or hybrid endpoints)
async function optionalAuth(req, res, next) {
  const cookies = parseCookies(req);
  let token = cookies.token;

  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = await findUserById(decoded.id);
    } catch (e) {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

// Role-enforcement middleware — SERVER decides permissions; never trusts client
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    // Handle dealer / buyer role synonym
    const userRole = req.user.role === 'buyer' ? 'dealer' : req.user.role;
    const normalizedAllowed = allowedRoles.map(r => r === 'buyer' ? 'dealer' : r);

    if (!normalizedAllowed.includes(userRole) && !normalizedAllowed.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Forbidden: Insufficient role permissions',
        requiredRoles: allowedRoles,
        userRole: req.user.role 
      });
    }
    next();
  };
}

// Status check middleware — pending aggregators/dealers cannot post or accept anything
function requireActiveStatus(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.status === 'pending') {
    return res.status(403).json({
      error: 'ACCOUNT_PENDING_APPROVAL',
      message: 'Account pending admin approval. You can browse, but cannot create batches / make offers until verified.'
    });
  }
  next();
}

module.exports = {
  JWT_SECRET,
  parseCookies,
  getCookieOptions,
  authMiddleware,
  optionalAuth,
  requireRole,
  requireActiveStatus
};
