const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db, hashPassword, findUserByIdentifier, findUserByGoogleId, findUserById } = require('./db');
const { calculateMatch, evaluateEligibility } = require('./services/matchingService');
const { calculateNetRealization, calculateStorageScenario } = require('./services/netRealizationService');
const { predictYield, analyzeProduceQualityCV } = require('./services/forecastService');
const { otpProvider } = require('./services/otpService');
const { getHyperlocalWeather } = require('./services/weatherService');
const { calculateDistanceKm, resolveCoordinates, filterByDistance } = require('./services/locationService');
const { generateBuyerRecommendation, generateKisanSaathiResponse } = require('./services/geminiService');
const {
  createOffer,
  acceptOffer,
  counterOffer,
  rejectOffer,
  getDealsForUser,
  getDealById,
  getAllOffersForUser,
  getSentOffers,
  getIncomingOffers
} = require('./services/dealService');
const { createRateLimiter } = require('./middleware/rateLimiter');
const { 
  JWT_SECRET, 
  authMiddleware, 
  optionalAuth, 
  requireRole, 
  requireActiveStatus,
  getCookieOptions
} = require('./middleware/auth');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5001;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const allowedOrigins = FRONTEND_ORIGIN.split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, serverless internal)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow Vercel and Render deployments
    if (origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) return callback(null, true);
    // Allow localhost/127.0.0.1 in non-production development
    if (process.env.NODE_ENV !== 'production' && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
      return callback(null, true);
    }
    return callback(new Error('CORS error: Request origin not authorized: ' + origin));
  },
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Rate limiters for security
const authLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 15, message: 'Too many authentication attempts. Please wait.' });
const otpSendLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10, message: 'Too many OTP requests. Please wait a few minutes.' });
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 15, message: 'Too many login attempts. Please wait.' });
const publicSimulationLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30, message: 'Rate limit exceeded for simulation and calculation APIs. Please try again later.' });
const aiLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30, message: 'Rate limit exceeded for AI advisory requests. Please wait a moment.' });

// Request logger (never logs passwords or OTPs)
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});


// ---------------------------------------------
// 1. AUTHENTICATION & ROLE-PROTECTED ACCESS
// ---------------------------------------------

// OTP Send (Farmer & Mobile authentication) - Fails CLOSED (503) on DB error
app.post('/api/auth/otp/send', otpSendLimiter, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    const result = await otpProvider.sendOtp(phone);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      message: 'OTP sent successfully',
      demoOtp: result.demoCode,
      expiresInSeconds: result.expiresInSeconds,
      isDemo: result.isDemo
    });
  } catch (err) {
    console.error('[OTP SEND] Database error:', err.message);
    return res.status(503).json({ error: 'Service Unavailable. Database error during OTP send.' });
  }
});

// OTP Verify & Login / Auto-Registration for Farmer - Fails CLOSED (503) on DB error
app.post('/api/auth/otp/verify', authLimiter, async (req, res) => {
  try {
    const { phone, code, expectedRole } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ error: 'Mobile number and OTP code are required' });
    }

    const result = await otpProvider.verifyOtp(phone, code);
    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    let user = await findUserByIdentifier(cleanPhone);

    if (!user) {
      return res.status(404).json({
        error: 'NO_ACCOUNT_FOUND',
        message: 'No account found with this mobile number. Please complete Sign Up first.'
      });
    }

    // Server-side check that real role in DB matches tab
    if (expectedRole && user.role !== expectedRole) {
      const roleLabels = { farmer: 'Farmer', aggregator: 'Aggregator', dealer: 'Big Dealer', buyer: 'Big Dealer' };
      return res.status(400).json({
        error: 'ROLE_MISMATCH',
        message: `This mobile number is registered as a ${roleLabels[user.role] || user.role}. Please switch to the ${roleLabels[user.role] || user.role} tab to log in.`
      });
    }

    // Reject blocked and rejected users
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

    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.cookie('token', token, getCookieOptions());
    res.cookie('kc_session', token, getCookieOptions());

    const { password: _, ...userSafe } = user;
    res.json({ token, user: userSafe });
  } catch (err) {
    console.error('[OTP VERIFY] Database error:', err.message);
    return res.status(503).json({ error: 'Service Unavailable. Database error during OTP verify.' });
  }
});

// Step 2: Farmer Sign Up
app.post('/api/auth/signup/farmer', authLimiter, async (req, res) => {
  try {
    const { name, phone, villageDistrict, mainCrops, password } = req.body;
    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);

    if (!name || !cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({ error: 'Please enter a valid name and 10-digit mobile number' });
    }

    if (password && password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const existing = await findUserByIdentifier(cleanPhone);
    if (existing) {
      return res.status(400).json({ 
        error: 'An account with this mobile number already exists. Please log in directly.' 
      });
    }

    const newFarmer = {
      id: `usr-farmer-${Date.now()}`,
      name: name.trim(),
      phone: cleanPhone,
      password: password ? hashPassword(password) : null,
      authMethods: password ? ['phone', 'password'] : ['phone'],
      role: 'farmer',
      status: 'active',
      location: villageDistrict || 'Agra, UP',
      rating: 5.0,
      reviewsCount: 0,
      verified: true,
      phoneVerified: true,
      completedOrders: 0,
      createdAt: new Date().toISOString(),
      farmerProfile: {
        villageDistrict: villageDistrict || 'Agra, UP',
        mainCrops: Array.isArray(mainCrops) ? mainCrops : ['Potato']
      }
    };

    await db.insert('users', newFarmer);

    // Send initial OTP for mobile verification
    const otpRes = await otpProvider.sendOtp(cleanPhone);

    res.json({
      success: true,
      message: 'Farmer account created. Please verify your mobile number with OTP.',
      demoOtp: otpRes.demoCode,
      isDemo: otpRes.isDemo
    });
  } catch (err) {
    console.error('[SIGNUP FARMER] Database error:', err.message);
    return res.status(503).json({ error: 'Service Unavailable. Database error during signup.' });
  }
});

// Helper: Safely parse Google credential JWT or user object
function extractGooglePayload(body) {
  const { credential, googleUser } = body || {};
  if (credential && typeof credential === 'string') {
    const parts = credential.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        return {
          googleId: payload.sub,
          email: payload.email ? payload.email.toLowerCase().trim() : null,
          name: payload.name || payload.given_name || (payload.email ? payload.email.split('@')[0] : 'Google User'),
          picture: payload.picture || null,
          emailVerified: Boolean(payload.email_verified)
        };
      } catch (e) {
        console.warn('[GOOGLE AUTH] Failed to decode Google credential JWT:', e.message);
      }
    }
  }

  const targetObj = (googleUser && typeof googleUser === 'object') ? googleUser : body;
  if (targetObj && typeof targetObj === 'object') {
    const email = (targetObj.email || '').toLowerCase().trim();
    const googleId = targetObj.googleId || targetObj.sub || (email ? `goog-${email.replace(/[^a-zA-Z0-9]/g, '-')}` : null);
    const name = targetObj.name || (email ? email.split('@')[0] : 'Google User');
    const picture = targetObj.picture || targetObj.avatarUrl || null;
    if (email && googleId) {
      return { googleId, email, name, picture, emailVerified: true };
    }
  }

  return null;
}

// Helper: Mask email for privacy display (e.g. su***n@gmail.com)
function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

// Google Auth Step 1: Initialize Google Sign-in / Register
// Dispatches verification OTP to the user's Google Email address.
// If user exists: returns status 'OTP_REQUIRED' with email OTP.
// If user is new: returns status 'REGISTER_REQUIRED' with email OTP to verify on signup.
app.post('/api/auth/google/init', authLimiter, async (req, res) => {
  try {
    const googleData = extractGooglePayload(req.body);
    if (!googleData || !googleData.email || !googleData.googleId) {
      return res.status(400).json({ error: 'INVALID_GOOGLE_CREDENTIALS', message: 'Valid Google credentials are required.' });
    }

    const cleanEmail = googleData.email.toLowerCase().trim();

    // Lookup user by google_id or by email
    let user = await findUserByGoogleId(googleData.googleId);
    if (!user) {
      user = await findUserByIdentifier(cleanEmail);
    }

    if (!user) {
      // New user: Send verification OTP directly to their Google email
      const otpRes = await otpProvider.sendOtp(cleanEmail);
      if (!otpRes.success) {
        return res.status(400).json({ error: otpRes.error || 'Failed to send verification code to Google email' });
      }

      const tempToken = jwt.sign(
        {
          type: 'google_register_email_otp',
          email: cleanEmail,
          googleId: googleData.googleId,
          name: googleData.name,
          avatarUrl: googleData.picture
        },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      return res.json({
        status: 'REGISTER_REQUIRED',
        verificationType: 'email',
        tempToken,
        email: cleanEmail,
        maskedEmail: maskEmail(cleanEmail),
        demoOtp: otpRes.demoCode,
        isDemo: otpRes.isDemo,
        googleProfile: {
          googleId: googleData.googleId,
          email: cleanEmail,
          name: googleData.name,
          picture: googleData.picture
        },
        message: `Verification code sent to your Google email (${maskEmail(cleanEmail)}). Please complete your registration.`
      });
    }

    // Check account status
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

    // Existing user: Send verification OTP to their Google email
    const targetEmail = (user.email || cleanEmail).toLowerCase().trim();
    const otpRes = await otpProvider.sendOtp(targetEmail);
    if (!otpRes.success) {
      return res.status(400).json({ error: otpRes.error || 'Failed to send verification code to your Google email' });
    }

    // Signed temporary token (valid 10 minutes) for 2FA email OTP verification
    const tempToken = jwt.sign(
      {
        type: 'google_login_email_otp',
        userId: user.id,
        email: targetEmail,
        googleId: googleData.googleId,
        avatarUrl: googleData.picture
      },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    const maskedEmail = maskEmail(targetEmail);

    return res.json({
      status: 'OTP_REQUIRED',
      verificationType: 'email',
      tempToken,
      maskedEmail,
      email: targetEmail,
      demoOtp: otpRes.demoCode,
      isDemo: otpRes.isDemo,
      role: user.role,
      user: {
        id: user.id,
        name: user.name,
        email: targetEmail,
        role: user.role
      },
      message: `Verification code sent to your Google email (${maskedEmail}). Please enter the 6-digit code to log in.`
    });
  } catch (err) {
    console.error('[GOOGLE INIT] Database error:', err.message);
    return res.status(503).json({ error: 'Service Unavailable. Database error during Google authentication.' });
  }
});

// Google Auth Step 2a: Verify Email OTP for Existing User Login
app.post('/api/auth/google/verify-otp', authLimiter, async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ error: 'Temporary token and OTP code are required' });
    }

    let payload;
    try {
      payload = jwt.verify(tempToken, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'EXPIRED_OR_INVALID_SESSION', message: 'Verification session expired. Please sign in with Google again.' });
    }

    if ((payload.type !== 'google_login_email_otp' && payload.type !== 'google_login_otp') || !payload.userId || !payload.email) {
      return res.status(400).json({ error: 'INVALID_TOKEN_TYPE', message: 'Invalid verification token.' });
    }

    const otpResult = await otpProvider.verifyOtp(payload.email, code);
    if (!otpResult.valid) {
      return res.status(400).json({ error: otpResult.error || 'Invalid OTP code' });
    }

    const user = await findUserById(payload.userId);
    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    // Link Google ID & avatar & email verification if not already present
    const updates = {};
    if (!user.googleId && payload.googleId) updates.googleId = payload.googleId;
    if (!user.avatarUrl && payload.avatarUrl) updates.avatarUrl = payload.avatarUrl;
    if (!user.emailVerified) updates.emailVerified = true;
    if (Object.keys(updates).length > 0) {
      await db.updateById('users', user.id, updates);
    }

    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, getCookieOptions());
    res.cookie('kc_session', token, getCookieOptions());

    const { password: _, ...userSafe } = user;
    return res.json({ token, user: userSafe });
  } catch (err) {
    console.error('[GOOGLE VERIFY OTP] Database error:', err.message);
    return res.status(503).json({ error: 'Service Unavailable. Database error during OTP verification.' });
  }
});

// Google Auth Step 2b: Register New User with Role, Email OTP & Optional Password
app.post('/api/auth/google/register', authLimiter, async (req, res) => {
  try {
    const {
      googleId,
      email,
      name,
      avatarUrl,
      code,
      password,
      role,
      phone,
      villageDistrict,
      mainCrops,
      businessName,
      contactPerson,
      city
    } = req.body;

    if (!role || (role !== 'farmer' && role !== 'aggregator' && role !== 'dealer')) {
      return res.status(400).json({ error: 'Please select a valid role (Farmer, Aggregator, or Big Dealer)' });
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ error: 'A valid Google email address is required' });
    }

    if (!code || code.trim().length !== 6) {
      return res.status(400).json({ error: 'Please enter the 6-digit verification code sent to your Google email' });
    }

    if (password && password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Verify Email OTP
    const otpResult = await otpProvider.verifyOtp(cleanEmail, code);
    if (!otpResult.valid) {
      return res.status(400).json({ error: otpResult.error || 'Invalid or expired email verification code' });
    }

    // Check duplicate email
    const existingEmail = await findUserByIdentifier(cleanEmail);
    if (existingEmail) {
      return res.status(400).json({ error: 'An account with this email already exists. Please log in directly.' });
    }

    // Optional phone validation (no mobile OTP required)
    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
    if (cleanPhone && cleanPhone.length === 10) {
      const existingPhone = await findUserByIdentifier(cleanPhone);
      if (existingPhone) {
        return res.status(400).json({ error: 'An account with this phone number already exists.' });
      }
    }

    let newUser;
    const authMethods = ['google', 'email'];
    if (password) authMethods.push('password');

    if (role === 'farmer') {
      newUser = {
        id: `usr-farmer-${Date.now()}`,
        name: (name || 'Farmer').trim(),
        email: cleanEmail,
        phone: cleanPhone || null,
        googleId: googleId || null,
        avatarUrl: avatarUrl || null,
        password: password ? hashPassword(password) : null,
        role: 'farmer',
        status: 'active',
        location: villageDistrict || 'Agra, UP',
        rating: 5.0,
        reviewsCount: 0,
        verified: true,
        phoneVerified: Boolean(cleanPhone),
        emailVerified: true,
        authMethods,
        completedOrders: 0,
        createdAt: new Date().toISOString(),
        farmerProfile: {
          villageDistrict: villageDistrict || 'Agra, UP',
          mainCrops: Array.isArray(mainCrops) ? mainCrops : ['Potato']
        }
      };
    } else {
      newUser = {
        id: `usr-${role.slice(0, 3)}-${Date.now()}`,
        name: (contactPerson || name || 'Business User').trim(),
        email: cleanEmail,
        phone: cleanPhone || null,
        googleId: googleId || null,
        avatarUrl: avatarUrl || null,
        password: password ? hashPassword(password) : null,
        role: role,
        status: 'pending',
        location: city || 'Agra, UP',
        rating: 0,
        reviewsCount: 0,
        verified: false,
        phoneVerified: Boolean(cleanPhone),
        emailVerified: true,
        authMethods,
        completedOrders: 0,
        createdAt: new Date().toISOString(),
        businessProfile: {
          businessName: (businessName || name).trim(),
          contactPerson: (contactPerson || name).trim(),
          city: city || 'Agra, UP'
        }
      };
    }

    await db.insert('users', newUser);

    const token = jwt.sign({ id: newUser.id, role: newUser.role, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, getCookieOptions());
    res.cookie('kc_session', token, getCookieOptions());

    const { password: _, ...userSafe } = newUser;
    return res.status(200).json({
      token,
      user: userSafe,
      status: newUser.status,
      message: newUser.status === 'pending'
        ? 'Registration successful! Your account is pending administrator verification.'
        : 'Registration successful! Welcome to KisanConnect.'
    });
  } catch (err) {
    console.error('[GOOGLE REGISTER] Database error:', err.message);
    return res.status(503).json({ error: 'Service Unavailable. Database error during Google registration.' });
  }
});

// Google Auth Step: Resend Email OTP
app.post('/api/auth/google/resend-otp', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const otpRes = await otpProvider.sendOtp(cleanEmail);
    if (!otpRes.success) {
      return res.status(400).json({ error: otpRes.error || 'Failed to resend verification code' });
    }

    return res.json({
      success: true,
      maskedEmail: maskEmail(cleanEmail),
      demoOtp: otpRes.demoCode,
      isDemo: otpRes.isDemo,
      message: `A new verification code was sent to ${maskEmail(cleanEmail)}`
    });
  } catch (err) {
    console.error('[GOOGLE RESEND OTP] Error:', err.message);
    return res.status(503).json({ error: 'Service Unavailable. Failed to resend verification code.' });
  }
});


// Step 2: Aggregator / Dealer Sign Up (Status = "pending")
app.post('/api/auth/signup/business', authLimiter, async (req, res) => {
  try {
    const { role, businessName, contactPerson, mobile, email, city, password } = req.body;

    if (!role || (role !== 'aggregator' && role !== 'dealer')) {
      return res.status(400).json({ error: 'Please select a valid role (Aggregator or Big Dealer)' });
    }

    if (!businessName || !contactPerson || !mobile || !email || !password) {
      return res.status(400).json({ error: 'All fields including business name, contact person, mobile, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const cleanPhone = (mobile || '').replace(/\D/g, '').slice(-10);
    const cleanEmail = (email || '').trim().toLowerCase();

    const existingEmail = await findUserByIdentifier(cleanEmail);
    const existingPhone = cleanPhone.length === 10 ? await findUserByIdentifier(cleanPhone) : null;

    if (existingEmail || existingPhone) {
      return res.status(400).json({ error: 'An account with this email or mobile number already exists. Please log in.' });
    }

    const newBusinessUser = {
      id: `usr-${role.slice(0, 3)}-${Date.now()}`,
      name: contactPerson.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      password: hashPassword(password),
      role: role,
      status: 'pending', // Account status = "pending" until an admin approves
      location: city || 'Agra, UP',
      rating: 0,
      reviewsCount: 0,
      verified: false,
      completedOrders: 0,
      createdAt: new Date().toISOString(),
      businessProfile: {
        businessName: businessName.trim(),
        contactPerson: contactPerson.trim(),
        city: city || 'Agra, UP'
      }
    };

    await db.insert('users', newBusinessUser);

    const token = jwt.sign({ id: newBusinessUser.id, role: newBusinessUser.role, email: newBusinessUser.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.cookie('token', token, getCookieOptions());
    res.cookie('kc_session', token, getCookieOptions());

    const { password: _, ...userSafe } = newBusinessUser;
    res.status(200).json({ 
      token, 
      user: userSafe, 
      status: 'pending',
      message: 'Registration successful! Your account is currently pending administrator verification.' 
    });
  } catch (err) {
    console.error('[SIGNUP BUSINESS] Database error:', err.message);
    return res.status(503).json({ error: 'Service Unavailable. Database error during business signup.' });
  }
});

// Login for Aggregator / Dealer (Password-based with Role Tab Verification) - Fails CLOSED (503) on DB error
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { identifier, email, phone, password, expectedRole } = req.body;
    const loginId = (identifier || email || phone || '').trim();

    if (!loginId || !password) {
      return res.status(400).json({ error: 'Email or mobile number and password are required' });
    }

    const user = await findUserByIdentifier(loginId);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. No account found matching this email or mobile.' });
    }

    // Farmer accounts must use Mobile + OTP
    if (user.role === 'farmer' && expectedRole !== 'farmer') {
      return res.status(400).json({
        error: 'ROLE_MISMATCH',
        message: 'This account is registered as a Farmer. Please switch to the Farmer tab and log in with your mobile OTP.'
      });
    }

    // Ensure user's real DB role matches the active login tab
    if (expectedRole && user.role !== expectedRole) {
      const isDealerSynonym = (expectedRole === 'dealer' && user.role === 'buyer') || (expectedRole === 'buyer' && user.role === 'dealer');
      if (!isDealerSynonym) {
        const roleLabels = { farmer: 'Farmer', aggregator: 'Aggregator', dealer: 'Big Dealer', buyer: 'Big Dealer', admin: 'Admin' };
        return res.status(400).json({
          error: 'ROLE_MISMATCH',
          message: `This account is registered as a ${roleLabels[user.role] || user.role}. Please switch to the ${roleLabels[user.role] || user.role} tab to log in.`
        });
      }
    }

    if (!user.password) {
      return res.status(401).json({ error: 'This account is authenticated via mobile OTP. Please use the Farmer OTP login.' });
    }

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
    }

    // Reject blocked and rejected users
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

    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.cookie('token', token, getCookieOptions());
    res.cookie('kc_session', token, getCookieOptions());

    const { password: _, ...userSafe } = user;
    res.json({ token, user: userSafe });
  } catch (err) {
    console.error('[LOGIN] Database error:', err.message);
    return res.status(503).json({ error: 'Service Unavailable. Database error during login.' });
  }
});

// Logout (Clears session cookie)
app.post('/api/auth/logout', (req, res) => {
  const cookieOpts = getCookieOptions();
  res.clearCookie('token', { path: '/', httpOnly: true, secure: cookieOpts.secure, sameSite: cookieOpts.sameSite });
  res.clearCookie('kc_session', { path: '/', httpOnly: true, secure: cookieOpts.secure, sameSite: cookieOpts.sameSite });
  res.json({ success: true, message: 'Logged out successfully' });
});

// Instant role-switcher for evaluator / demo convenience (Gated behind DEMO_MODE=true)
app.post('/api/auth/demo-switch', async (req, res) => {
  try {
    if (process.env.DEMO_MODE !== 'true') {
      return res.status(403).json({ error: 'DEMO_SWITCH_DISABLED', message: 'Demo persona switching is disabled when DEMO_MODE is false.' });
    }

    const { role } = req.body;
    const targetUser = await db.findOne('users', u => u.role === role);
    if (!targetUser) {
      return res.status(404).json({ error: `No demo user found with role: ${role}` });
    }

    const token = jwt.sign({ id: targetUser.id, role: targetUser.role, email: targetUser.email }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, getCookieOptions());
    res.cookie('kc_session', token, getCookieOptions());

    const { password: _, ...userSafe } = targetUser;
    res.json({ token, user: userSafe });
  } catch (err) {
    console.error('[DEMO SWITCH] Error:', err.message);
    res.status(503).json({ error: 'Service Unavailable' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const { password: _, ...userSafe } = req.user;
  res.json({ user: userSafe });
});

// Cron-callable cleanup endpoint (strictly protected by CRON_SECRET in all environments)
app.all('/api/cleanup', async (req, res) => {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return res.status(403).json({ error: 'Unauthorized. Cleanup secret not configured on server.' });
  }

  const rawSecret = req.headers['x-cron-secret'] || 
                    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '') ||
                    req.query.secret;

  if (!rawSecret) {
    return res.status(403).json({ error: 'Unauthorized. Missing cleanup secret.' });
  }

  const suppliedBuf = Buffer.from(String(rawSecret));
  const expectedBuf = Buffer.from(String(expectedSecret));

  if (suppliedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(suppliedBuf, expectedBuf)) {
    return res.status(403).json({ error: 'Unauthorized. Invalid cleanup secret.' });
  }

  try {
    const { pool } = require('./db');
    const otpClean = await pool.query('DELETE FROM otps WHERE expires_at < NOW()');
    const rateLimitClean = await pool.query("DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour'");
    res.json({
      success: true,
      cleanedExpiredOtps: otpClean.rowCount || 0,
      cleanedStaleRateLimits: rateLimitClean.rowCount || 0,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[CLEANUP] Database error:', err.message);
    res.status(500).json({ error: 'Cleanup failed', message: err.message });
  }
});

// ---------------------------------------------
// 2. CROPS CATALOGUE (CROP-AGNOSTIC)
// ---------------------------------------------

app.get('/api/crops', async (req, res) => {
  const crops = await db.find('crops');
  res.json(crops);
});

app.post('/api/crops', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can add new crops to catalogue' });
  }

  const { name, category, defaultUnit, varieties, standardGrades, storageType, keyQualityParams, image } = req.body;
  const newCrop = {
    id: `crop-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name,
    category: category || 'Vegetables',
    defaultUnit: defaultUnit || 'tonnes',
    varieties: varieties || ['Standard'],
    standardGrades: standardGrades || ['Grade A', 'Grade B'],
    storageType: storageType || 'Dry Ventilated',
    keyQualityParams: keyQualityParams || ['Size (mm)', 'Moisture %'],
    image: image || 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&auto=format&fit=crop&q=60'
  };

  await db.insert('crops', newCrop);
  res.status(201).json(newCrop);
});

// Farmer Phone Privacy Sanitizer
// Exposes farmerPhone only to: (1) Admin, (2) The listing owner farmer, (3) Users with an accepted deal/order
async function sanitizeListing(listing, reqUser) {
  if (!listing) return null;
  try {
    if (reqUser) {
      if (reqUser.role === 'admin' || reqUser.id === listing.farmerId) {
        return listing;
      }
      const hasAcceptedOffer = await db.findOne('offers', o => 
        o.listingId === listing.id && 
        (o.buyerId === reqUser.id || o.sellerId === reqUser.id) && 
        o.status === 'ACCEPTED'
      );
      if (hasAcceptedOffer) return listing;

      const hasOrder = await db.findOne('orders', o => 
        o.listingId === listing.id && 
        (o.buyerId === reqUser.id || o.sellerId === reqUser.id || o.aggregatorId === reqUser.id)
      );
      if (hasOrder) return listing;
    }
  } catch (err) {
    console.warn('[SANITIZE LISTING] Transient lookup error:', err.message);
  }

  const { farmerPhone: _, ...safeListing } = listing;
  return safeListing;
}

app.get('/api/listings', optionalAuth, async (req, res) => {
  try {
    const { crop, farmerId, listingType, grade } = req.query;
    let listings = await db.find('farmerListings');

    if (crop) {
      listings = listings.filter(l => (l.cropName || '').toLowerCase() === crop.toLowerCase() || l.cropId === crop);
    }
    if (farmerId) {
      listings = listings.filter(l => l.farmerId === farmerId);
    }
    if (listingType) {
      listings = listings.filter(l => l.listingType === listingType);
    }
    if (grade) {
      listings = listings.filter(l => l.grade === grade);
    }

    const sanitizedListings = await Promise.all(listings.map(async l => {
      const total = Number(l.quantityTons || 0);
      const reserved = Number(l.reservedQuantityTons || 0);
      const confirmed = Number(l.confirmedQuantityTons || 0);
      const available = Math.max(0, Number((total - reserved - confirmed).toFixed(2)));

      let status = l.status || 'ACTIVE';
      if (total > 0) {
        if (available <= 0 && reserved > 0) status = 'RESERVED';
        else if (available <= 0 && reserved <= 0 && confirmed > 0) status = 'SOLD';
        else if (available > 0) status = 'ACTIVE';
      }

      const enriched = {
        ...l,
        totalQuantityTons: total,
        reservedQuantityTons: reserved,
        confirmedQuantityTons: confirmed,
        availableQuantityTons: available,
        status
      };
      return sanitizeListing(enriched, req.user);
    }));
    res.json(sanitizedListings);
  } catch (err) {
    console.error('[GET LISTINGS] Error:', err.message);
    res.status(503).json({ error: 'Service Unavailable. Failed to retrieve listings.' });
  }
});

app.post('/api/listings', authMiddleware, requireRole(['farmer', 'admin']), requireActiveStatus, async (req, res) => {
  const {
    cropId,
    cropName,
    variety,
    quantityTons,
    listingType,
    harvestDate,
    availableDate,
    grade,
    sizeMinMm,
    sizeMaxMm,
    moisturePercent,
    defectsPercent,
    expectedPricePerKg,
    storageRequirement,
    images,
    notes
  } = req.body;

  if (!cropName || !quantityTons || !expectedPricePerKg) {
    return res.status(400).json({ error: 'Missing cropName, quantity or expected price' });
  }

  const newListing = {
    id: `list-${Date.now()}`,
    farmerId: req.user.id,
    farmerName: req.user.name,
    farmerPhone: req.user.phone,
    farmerLocation: req.user.location,
    cropId: cropId || `crop-${cropName.toLowerCase()}`,
    cropName,
    variety: variety || 'Standard',
    quantityTons: Number(quantityTons),
    listingType: listingType || 'AVAILABLE_NOW',
    harvestDate: harvestDate || new Date().toISOString().split('T')[0],
    availableDate: availableDate || new Date().toISOString().split('T')[0],
    grade: grade || 'Grade A',
    sizeMinMm: Number(sizeMinMm) || 45,
    sizeMaxMm: Number(sizeMaxMm) || 75,
    moisturePercent: Number(moisturePercent) || 18,
    defectsPercent: Number(defectsPercent) || 2.0,
    expectedPricePerKg: Number(expectedPricePerKg),
    storageRequirement: storageRequirement || 'NONE',
    verificationStatus: 'SELF_DECLARED',
    status: 'ACTIVE',
    images: images && images.length ? images : ['https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&auto=format&fit=crop&q=60'],
    notes: notes || '',
    createdAt: new Date().toISOString()
  };

  await db.insert('farmerListings', newListing);

  // Notify aggregators in same region
  const aggregators = await db.find('users', u => u.role === 'aggregator');
  for (const agg of aggregators) {
    await db.insert('notifications', {
      userId: agg.id,
      title: `New Supply: ${quantityTons}T ${cropName} in ${req.user.location}`,
      message: `${req.user.name} posted ${quantityTons}T of ${variety} ${cropName} at ₹${expectedPricePerKg}/kg.`,
      type: 'MATCH',
      read: false,
      timestamp: new Date().toISOString()
    });
  }

  res.status(201).json(newListing);
});

// Quality Verification for a listing
app.post('/api/listings/:id/verify', authMiddleware, async (req, res) => {
  const listing = await db.findById('farmerListings', req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const updated = await db.updateById('farmerListings', req.params.id, {
    verificationStatus: 'VERIFIED',
    verifier: `${req.user.name} (${req.user.role})`
  });

  res.json(updated);
});

// ---------------------------------------------
// NALAMKI & ITU-T DIGITAL FARM ACTIVITY API (Annex A.16)
// Provides standardized electronic field records, agronomic operation logs & batch traceability
// ---------------------------------------------

app.get('/api/activities/standards/nalamki-manifest', (req, res) => {
  res.json({
    standard: 'NaLamKI · ITU-T / FAO Recommendation (Digital Farm Twin)',
    version: 'v1.0-ITU-T-Annex-A.16',
    entity: 'Activity',
    specificationUrl: 'https://nalamki.github.io/docs/concepts/data-model/entities#p5--work-and-operations-management',
    features: [
      'Electronic Field Record (EFR)',
      'Operation Type Ontology (tillage, sowing, irrigation, fertilization, crop_protection, harvesting, sorting_grading)',
      'Phenological BBCH Growth Stage Tracking',
      'Hyperlocal Environmental & Soil Microclimate Conditions',
      'ActivityResource Machine & Operator Attribution',
      'Lot & Batch Level Traceability Passport'
    ],
    status: 'ACTIVE_CONFORMANT'
  });
});

app.get('/api/activities', optionalAuth, async (req, res) => {
  try {
    const { listingId, farmerId, batchId, typeUri, status } = req.query;
    let activities = await db.find('farmActivities');
    
    if (listingId) {
      activities = activities.filter(a => a.listingId === listingId);
    }
    if (farmerId) {
      activities = activities.filter(a => a.farmerId === farmerId);
    }
    if (batchId) {
      activities = activities.filter(a => a.batchId === batchId);
    }
    if (typeUri) {
      activities = activities.filter(a => a.typeUri === typeUri);
    }
    if (status) {
      activities = activities.filter(a => a.status === status);
    }

    activities.sort((a, b) => new Date(b.startsAt || b.createdAt).getTime() - new Date(a.startsAt || a.createdAt).getTime());
    res.json(activities);
  } catch (err) {
    console.error('[GET ACTIVITIES] Error:', err.message);
    res.status(503).json({ error: 'Service Unavailable. Failed to retrieve activities.' });
  }
});

app.get('/api/activities/:id', optionalAuth, async (req, res) => {
  try {
    const activity = await db.findById('farmActivities', req.params.id);
    if (!activity) return res.status(404).json({ error: 'Activity not found' });
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve activity' });
  }
});

app.post('/api/activities', authMiddleware, requireRole(['farmer', 'aggregator', 'admin']), async (req, res) => {
  try {
    const {
      name,
      typeUri,
      typeLabel,
      status = 'COMPLETED',
      startsAt,
      endsAt,
      bbchStage,
      conditions,
      geometry,
      listingId,
      batchId,
      resources = [],
      inputsOutputs = [],
      notes
    } = req.body;

    const DEFAULT_BBCH_MAP = {
      sowing: 'BBCH 09 (Emergence / Germination)',
      tillage: 'BBCH 00 (Pre-sowing Seedbed Prep)',
      irrigation: 'BBCH 40 (Tuber Bulking / Vegetative Hydration)',
      fertilization: 'BBCH 45 (Vegetative Growth & Nutrition)',
      crop_protection: 'BBCH 60 (Flowering & Canopy Protection)',
      harvesting: 'BBCH 99 (Harvested Lot)',
      sorting_grading: 'BBCH 99 (Post-Harvest Lot Grading)'
    };

    const DEFAULT_NAME_MAP = {
      sowing: 'बुवाई एवं बीज रोपण (Sowing)',
      tillage: 'खेत जुताई (Tillage & Bed Prep)',
      irrigation: 'ड्रिप / ट्यूबवेल सिंचाई (Irrigation)',
      fertilization: 'खाद एवं फसल पोषण (Fertilization)',
      crop_protection: 'फसल सुरक्षा स्प्रे (Bio-IPM Spray)',
      harvesting: 'फसल कटाई (Harvesting)',
      sorting_grading: 'खेत ग्रेडिंग व छंटाई (Sorting & Grading)'
    };

    const finalTypeUri = typeUri || 'irrigation';
    const finalName = name || typeLabel || DEFAULT_NAME_MAP[finalTypeUri] || 'खेत कार्य (Field Work)';

    let cropName = '';
    let variety = '';
    if (listingId) {
      const listing = await db.findById('farmerListings', listingId);
      if (listing) {
        cropName = listing.cropName;
        variety = listing.variety;
      }
    }

    // Auto-fetch hyperlocal weather if not provided by farmer
    let resolvedConditions = conditions;
    if (!resolvedConditions || Object.keys(resolvedConditions).length === 0) {
      const lat = geometry?.coordinates?.[1] || 27.1767;
      const lon = geometry?.coordinates?.[0] || 78.0081;
      resolvedConditions = await getHyperlocalWeather(lat, lon);
    }

    const resolvedBbch = bbchStage || DEFAULT_BBCH_MAP[finalTypeUri] || 'BBCH 40 (Active Growth Stage)';

    const activityId = `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newActivity = {
      id: activityId,
      name: finalName,
      typeUri: finalTypeUri,
      typeLabel: typeLabel || DEFAULT_NAME_MAP[finalTypeUri] || finalName,
      status,
      startsAt: startsAt || new Date().toISOString(),
      endsAt: endsAt || startsAt || new Date().toISOString(),
      bbchStage: resolvedBbch,
      conditions: resolvedConditions,
      geometry: geometry || { type: 'Point', coordinates: [78.0081, 27.1767] },
      farmerId: req.user.id,
      farmerName: req.user.name,
      listingId: listingId || null,
      cropName: cropName || null,
      variety: variety || null,
      batchId: batchId || null,
      resources: Array.isArray(resources) ? resources : [],
      inputsOutputs: Array.isArray(inputsOutputs) ? inputsOutputs : [],
      notes: notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await db.insert('farmActivities', newActivity);
    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST ACTIVITY] Error:', err.message);
    res.status(500).json({ error: 'Failed to record activity: ' + err.message });
  }
});

app.patch('/api/activities/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await db.findById('farmActivities', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Activity not found' });
    if (existing.farmerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to update this activity' });
    }

    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    delete updates.id;
    const updated = await db.updateById('farmActivities', req.params.id, updates);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update activity: ' + err.message });
  }
});

app.delete('/api/activities/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await db.findById('farmActivities', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Activity not found' });
    if (existing.farmerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this activity' });
    }

    await pool.query('DELETE FROM farm_activities WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Activity deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

// Listing Traceability & NaLamKI Digital Farm Passport
app.get('/api/listings/:id/traceability', optionalAuth, async (req, res) => {
  try {
    const listing = await db.findById('farmerListings', req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    let activities = await db.find('farmActivities', { listingId: req.params.id });
    if (!activities || activities.length === 0) {
      activities = await db.find('farmActivities', { farmerId: listing.farmerId });
    }

    activities.sort((a, b) => new Date(a.startsAt || a.createdAt).getTime() - new Date(b.startsAt || b.createdAt).getTime());

    const agronomicSummary = {
      crop: listing.cropName,
      variety: listing.variety,
      grade: listing.grade,
      harvestDate: listing.harvestDate,
      location: listing.location || listing.farmerLocation,
      verificationStatus: listing.verificationStatus || 'VERIFIED',
      organicOrIpmpPractices: activities.some(a => a.typeUri === 'crop_protection' && /neem|bio|organic/i.test(a.notes || a.name)),
      waterOptimized: activities.some(a => a.typeUri === 'irrigation' && /drip|micro/i.test(a.name || a.notes))
    };

    res.json({
      listing,
      passportId: `PASSPORT-${listing.id.toUpperCase()}`,
      standardCompliance: 'NaLamKI / ITU-T Digital Agriculture Spec',
      activitiesCount: activities.length,
      activities,
      agronomicSummary,
      complianceMetrics: agronomicSummary
    });
  } catch (err) {
    console.error('[GET TRACEABILITY] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch traceability data' });
  }
});

// ---------------------------------------------
// 4. BUYER REQUIREMENTS & PROXIMITY DISCOVERY
// ---------------------------------------------

// Helper to handle requirements list with distance and filters
async function handleGetRequirements(req, res) {
  const { crop, buyerId, status, buyerType, radiusKm, lat, lon } = req.query;
  let reqs = await db.find('buyerRequirements');

  const userCoords = (lat && lon) 
    ? { lat: Number(lat), lon: Number(lon) } 
    : (req.user ? resolveCoordinates(req.user) : { lat: 26.7410, lon: 83.8890 });

  if (crop) {
    reqs = reqs.filter(r => (r.cropName || '').toLowerCase() === crop.toLowerCase());
  }
  if (buyerId) {
    reqs = reqs.filter(r => r.buyerId === buyerId);
  }
  if (status) {
    reqs = reqs.filter(r => r.status === status);
  }
  if (buyerType && buyerType !== 'all') {
    reqs = reqs.filter(r => (r.buyerType || r.buyer_type || 'bulk').toLowerCase() === buyerType.toLowerCase());
  }

  // Calculate distance
  const mapped = reqs.map(r => {
    const rCoords = resolveCoordinates(r);
    const distanceKm = calculateDistanceKm(userCoords.lat, userCoords.lon, rCoords.lat, rCoords.lon);
    return {
      ...r,
      buyerType: r.buyerType || r.buyer_type || 'bulk',
      requiredQuantityKg: r.requiredQuantityKg ? Number(r.requiredQuantityKg) : Number(r.quantityTons * 1000),
      minimumDirectFarmerLotKg: r.minimumDirectFarmerLotKg !== undefined ? Number(r.minimumDirectFarmerLotKg) : 0,
      aggregationAllowed: r.aggregationAllowed !== false && r.aggregation_allowed !== false,
      distanceKm,
      deliveryLatitude: rCoords.lat,
      deliveryLongitude: rCoords.lon
    };
  });

  if (radiusKm && !isNaN(Number(radiusKm))) {
    const maxR = Number(radiusKm);
    return res.json(mapped.filter(r => r.distanceKm <= maxR).sort((a, b) => a.distanceKm - b.distanceKm));
  }

  res.json(mapped.sort((a, b) => a.distanceKm - b.distanceKm));
}

app.get('/api/requirements', optionalAuth, handleGetRequirements);
app.get('/api/buyer-requirements', optionalAuth, handleGetRequirements);

// Get single requirement
app.get('/api/buyer-requirements/:id', optionalAuth, async (req, res) => {
  const reqItem = await db.findById('buyerRequirements', req.params.id);
  if (!reqItem) return res.status(404).json({ error: 'Requirement not found' });
  const rCoords = resolveCoordinates(reqItem);
  res.json({
    ...reqItem,
    buyerType: reqItem.buyerType || reqItem.buyer_type || 'bulk',
    requiredQuantityKg: reqItem.requiredQuantityKg ? Number(reqItem.requiredQuantityKg) : Number(reqItem.quantityTons * 1000),
    minimumDirectFarmerLotKg: reqItem.minimumDirectFarmerLotKg !== undefined ? Number(reqItem.minimumDirectFarmerLotKg) : 0,
    aggregationAllowed: reqItem.aggregationAllowed !== false && reqItem.aggregation_allowed !== false,
    deliveryLatitude: rCoords.lat,
    deliveryLongitude: rCoords.lon
  });
});

// Helper to handle requirement creation
async function handleCreateRequirement(req, res) {
  const {
    cropId,
    cropName,
    variety,
    quantityTons,
    buyerType,
    requiredQuantityKg,
    minimumDirectFarmerLotKg,
    aggregationAllowed,
    gradeRequired,
    sizeMinMm,
    sizeMaxMm,
    maxMoisture,
    maxDefects,
    location,
    deliveryLatitude,
    deliveryLongitude,
    requiredDate,
    offeredPricePerKg,
    deliveryType,
    specialRequirements
  } = req.body;

  if (!cropName || !quantityTons || !offeredPricePerKg) {
    return res.status(400).json({ error: 'Missing crop, quantity, or offered price' });
  }

  const determinedBuyerType = buyerType || (req.user.buyerType || 'bulk');
  const qtyTons = Number(quantityTons);
  const qtyKg = requiredQuantityKg ? Number(requiredQuantityKg) : qtyTons * 1000;
  const minLotKg = minimumDirectFarmerLotKg !== undefined 
    ? Number(minimumDirectFarmerLotKg) 
    : (determinedBuyerType === 'local' ? 250 : 5000);

  const coords = (deliveryLatitude && deliveryLongitude)
    ? { lat: Number(deliveryLatitude), lon: Number(deliveryLongitude) }
    : resolveCoordinates({ location: location || req.user.location });

  const newReq = {
    id: `req-${Date.now()}`,
    buyerId: req.user.id,
    buyerName: req.user.name,
    buyerCompany: req.user.buyerProfile?.companyName || req.user.name,
    buyerType: determinedBuyerType,
    cropId: cropId || `crop-${cropName.toLowerCase()}`,
    cropName,
    variety: variety || 'All Varieties',
    quantityTons: qtyTons,
    requiredQuantityKg: qtyKg,
    minimumDirectFarmerLotKg: minLotKg,
    aggregationAllowed: aggregationAllowed !== false,
    unit: 'tonnes',
    gradeRequired: gradeRequired || 'Grade A',
    sizeMinMm: Number(sizeMinMm) || 45,
    sizeMaxMm: Number(sizeMaxMm) || 75,
    maxMoisture: Number(maxMoisture) || 19,
    maxDefects: Number(maxDefects) || 3.0,
    location: location || req.user.location,
    deliveryLatitude: coords.lat,
    deliveryLongitude: coords.lon,
    requiredDate: requiredDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    offeredPricePerKg: Number(offeredPricePerKg),
    deliveryType: deliveryType || 'PICKUP_REQUIRED',
    status: 'OPEN',
    specialRequirements: specialRequirements || '',
    createdAt: new Date().toISOString()
  };

  await db.insert('buyerRequirements', newReq);

  // Notify relevant users
  const farmers = await db.find('users', u => u.role === 'farmer');
  for (const farmer of farmers.slice(0, 5)) {
    await db.insert('notifications', {
      userId: farmer.id,
      title: `${determinedBuyerType === 'local' ? 'Local Buyer' : 'Bulk Buyer'} Demand: ${qtyTons}T ${cropName}`,
      message: `${newReq.buyerCompany} is offering ₹${offeredPricePerKg}/kg for ${qtyTons}T ${cropName}.`,
      type: 'MATCH',
      read: false,
      timestamp: new Date().toISOString()
    });
  }

  res.status(201).json(newReq);
}

app.post('/api/requirements', authMiddleware, requireRole(['dealer', 'buyer', 'admin']), requireActiveStatus, handleCreateRequirement);
app.post('/api/buyer-requirements', authMiddleware, requireRole(['dealer', 'buyer', 'admin']), requireActiveStatus, handleCreateRequirement);

// GET /api/buyers/nearby - Geolocation query for nearby buyers
app.get('/api/buyers/nearby', optionalAuth, async (req, res) => {
  const { lat, lon, crop, buyerType, radiusKm } = req.query;
  const userCoords = (lat && lon) 
    ? { lat: Number(lat), lon: Number(lon) } 
    : (req.user ? resolveCoordinates(req.user) : { lat: 26.7410, lon: 83.8890 });

  const maxRadius = radiusKm ? Number(radiusKm) : 100;
  const allReqs = await db.find('buyerRequirements', r => r.status === 'OPEN');

  const nearby = allReqs.map(r => {
    const rCoords = resolveCoordinates(r);
    const distanceKm = calculateDistanceKm(userCoords.lat, userCoords.lon, rCoords.lat, rCoords.lon);
    return {
      ...r,
      buyerType: r.buyerType || r.buyer_type || 'bulk',
      requiredQuantityKg: r.requiredQuantityKg ? Number(r.requiredQuantityKg) : Number(r.quantityTons * 1000),
      minimumDirectFarmerLotKg: r.minimumDirectFarmerLotKg !== undefined ? Number(r.minimumDirectFarmerLotKg) : 0,
      aggregationAllowed: r.aggregationAllowed !== false && r.aggregation_allowed !== false,
      distanceKm,
      deliveryLatitude: rCoords.lat,
      deliveryLongitude: rCoords.lon
    };
  }).filter(r => {
    if (crop && (r.cropName || '').toLowerCase() !== crop.toLowerCase()) return false;
    if (buyerType && buyerType !== 'all') {
      const bType = (r.buyerType || r.buyer_type || 'bulk').toLowerCase();
      if (bType !== buyerType.toLowerCase()) return false;
    }
    if (radiusKm && r.distanceKm > maxRadius) return false;
    return true;
  }).sort((a, b) => a.distanceKm - b.distanceKm);

  res.json(nearby);
});

// GET /api/farmer-supply/nearby - Nearby farmer supply discovery
app.get('/api/farmer-supply/nearby', optionalAuth, async (req, res) => {
  const { lat, lon, crop, radiusKm } = req.query;
  const userCoords = (lat && lon) 
    ? { lat: Number(lat), lon: Number(lon) } 
    : (req.user ? resolveCoordinates(req.user) : { lat: 26.7410, lon: 83.8890 });

  const maxRadius = radiusKm ? Number(radiusKm) : 100;
  const allListings = await db.find('farmerListings', l => l.status === 'ACTIVE');

  const nearby = (await Promise.all(allListings.map(async l => {
    const lCoords = resolveCoordinates(l);
    const distanceKm = calculateDistanceKm(userCoords.lat, userCoords.lon, lCoords.lat, lCoords.lon);
    const sanitized = await sanitizeListing(l, req.user);
    return {
      ...sanitized,
      quantityKg: l.quantityKg ? Number(l.quantityKg) : Number(l.quantityTons * 1000),
      distanceKm,
      latitude: lCoords.lat,
      longitude: lCoords.lon
    };
  }))).filter(l => {
    if (crop && (l.cropName || '').toLowerCase() !== crop.toLowerCase()) return false;
    if (radiusKm && l.distanceKm > maxRadius) return false;
    return true;
  }).sort((a, b) => a.distanceKm - b.distanceKm);

  res.json(nearby);
});

// ---------------------------------------------
// 5. MATCHING ENGINE & NET REALIZATION
// ---------------------------------------------

// Find matching requirements for a farmer listing (with Step 1 Eligibility + Step 2 Score)
app.get('/api/matches/listing/:listingId', optionalAuth, async (req, res) => {
  const listing = await db.findById('farmerListings', req.params.listingId);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const allReqs = await db.find('buyerRequirements', r => r.status === 'OPEN');
  const matches = allReqs.map(reqItem => {
    const matchResult = calculateMatch(listing, reqItem);
    const distanceKm = matchResult.distanceKm || 25;
    const netCalc = calculateNetRealization({
      buyerPricePerKg: reqItem.offeredPricePerKg,
      distanceKm,
      buyerPicksUp: reqItem.deliveryType === 'PICKUP_REQUIRED',
      storageCostPerKg: listing.storageRequirement === 'COLD_STORAGE' ? 0.45 : 0
    });

    return {
      requirement: {
        ...reqItem,
        buyerType: reqItem.buyerType || reqItem.buyer_type || 'bulk',
        requiredQuantityKg: reqItem.requiredQuantityKg ? Number(reqItem.requiredQuantityKg) : Number(reqItem.quantityTons * 1000),
        minimumDirectFarmerLotKg: reqItem.minimumDirectFarmerLotKg !== undefined ? Number(reqItem.minimumDirectFarmerLotKg) : 0,
        aggregationAllowed: reqItem.aggregationAllowed !== false && reqItem.aggregation_allowed !== false
      },
      matchScore: matchResult.score,
      isViable: matchResult.isViable,
      eligibility: matchResult.eligibility,
      distanceKm,
      breakdown: matchResult.breakdown,
      reasons: matchResult.reasons,
      netRealization: netCalc
    };
  })
  // Part F & Acceptance Test 1 & 4:
  // Must be visible to farmer (either direct match or aggregator opportunity)
  .filter(m => m.eligibility.visibleToFarmer === true && m.matchScore >= 40)
  .sort((a, b) => b.matchScore - a.matchScore);

  const sanitized = await sanitizeListing(listing, req.user);
  res.json({ listing: sanitized, matches });
});

// Find multi-channel matching supply for a buyer requirement (Direct, Aggregator, Cold Storage)
app.get('/api/matches/requirement/:reqId', optionalAuth, async (req, res) => {
  const requirement = await db.findById('buyerRequirements', req.params.reqId);
  if (!requirement) return res.status(404).json({ error: 'Requirement not found' });

  const minDirectLotKg = Number(requirement.minimumDirectFarmerLotKg || 0);

  // 1. Direct Farmer Listings & Aggregator Supply Pipeline
  const rawListings = await db.find('farmerListings');
  const directFarmers = [];
  const aggregatorSupply = [];

  for (const rawL of rawListings) {
    const totalQty = Number(rawL.quantityTons || 0);
    const reservedQty = Number(rawL.reservedQuantityTons || 0);
    const confirmedQty = Number(rawL.confirmedQuantityTons || 0);
    const availQty = Math.max(0, Number((totalQty - reservedQty - confirmedQty).toFixed(2)));

    // Only listings with available stock can be matched for new supply
    if (availQty <= 0) continue;

    const listing = {
      ...rawL,
      totalQuantityTons: totalQty,
      reservedQuantityTons: reservedQty,
      confirmedQuantityTons: confirmedQty,
      availableQuantityTons: availQty,
      quantityTons: availQty // Show currently available unreserved tons
    };

    const matchResult = calculateMatch(listing, requirement);
    if (matchResult.score >= 40 && (listing.cropName || '').toLowerCase() === (requirement.cropName || '').toLowerCase()) {
      const netCalc = calculateNetRealization({
        buyerPricePerKg: requirement.offeredPricePerKg,
        distanceKm: matchResult.distanceKm || 30,
        buyerPicksUp: requirement.deliveryType === 'PICKUP_REQUIRED'
      });
      const sanitized = await sanitizeListing(listing, req.user);
      const matchObj = {
        listing: sanitized,
        matchScore: matchResult.score,
        isViable: matchResult.isViable,
        eligibility: matchResult.eligibility,
        distanceKm: matchResult.distanceKm,
        breakdown: matchResult.breakdown,
        reasons: matchResult.reasons,
        netRealization: netCalc
      };

      const farmerQtyKg = Number(listing.quantityKg || (availQty * 1000)) || 1000;
      if (minDirectLotKg > 0 && farmerQtyKg < minDirectLotKg) {
        aggregatorSupply.push(matchObj);
      } else {
        directFarmers.push(matchObj);
      }
    }
  }

  // 2. Existing Aggregation Batches
  const batches = await db.find('aggregationBatches', b => 
    (b.cropName || '').toLowerCase() === requirement.cropName.toLowerCase()
  );

  // 3. Cold Storage Inventory
  const coldStores = await db.find('coldStorages');
  const storageMatches = [];
  coldStores.forEach(cs => {
    (cs.inventory || []).forEach(inv => {
      if ((inv.cropName || '').toLowerCase() === requirement.cropName.toLowerCase()) {
        storageMatches.push({
          storageId: cs.id,
          storageName: cs.name,
          location: cs.location,
          cropName: inv.cropName,
          variety: inv.variety,
          availableQuantityTons: inv.quantityTons,
          expectedReleaseMonths: inv.expectedReleaseMonths
        });
      }
    });
  });

  // 4. Track Offers, Negotiations, and Confirmed Procurement for this requirement
  const reqOffers = await db.find('offers', o => o.requirementId === req.params.reqId);
  const reqOrders = await db.find('orders', ord => ord.requirementId === req.params.reqId && ord.status !== 'CANCELLED');

  const offersSentTons = Number(reqOffers
    .filter(o => o.status === 'PENDING')
    .reduce((sum, o) => sum + Number(o.quantityTons || 0), 0)
    .toFixed(1));

  const negotiatingTons = Number(reqOffers
    .filter(o => o.status === 'COUNTERED')
    .reduce((sum, o) => sum + Number(o.counterQuantityTons || o.quantityTons || 0), 0)
    .toFixed(1));

  let confirmedProcurementTons = Number(reqOrders
    .reduce((sum, ord) => sum + Number(ord.quantityTons || 0), 0)
    .toFixed(1));

  if (confirmedProcurementTons === 0) {
    confirmedProcurementTons = Number(reqOffers
      .filter(o => o.status === 'ACCEPTED')
      .reduce((sum, o) => sum + Number(o.counterQuantityTons || o.quantityTons || 0), 0)
      .toFixed(1));
  }

  const targetRequirementTons = Number(requirement.quantityTons) || 1;
  const remainingRequirementTons = Math.max(0, Number((targetRequirementTons - confirmedProcurementTons).toFixed(1)));

  // Available supply channels
  const directFarmerSupplyTons = Number(directFarmers.reduce((sum, f) => sum + (Number(f.listing.availableQuantityTons || f.listing.quantityTons) || 0), 0).toFixed(1));
  const batchSupplyTons = Number(batches.reduce((sum, b) => sum + (Number(b.currentAggregatedTons) || 0), 0).toFixed(1));
  const storageSupplyTons = Number(storageMatches.reduce((sum, s) => sum + (Number(s.availableQuantityTons) || 0), 0).toFixed(1));
  const totalAvailableSupplyTons = Number((directFarmerSupplyTons + batchSupplyTons + storageSupplyTons).toFixed(1));

  const fulfillmentPercent = Math.min(100, Math.round((confirmedProcurementTons / targetRequirementTons) * 100));

  res.json({
    requirement: {
      ...requirement,
      buyerType: requirement.buyerType || requirement.buyer_type || 'bulk',
      requiredQuantityKg: requirement.requiredQuantityKg ? Number(requirement.requiredQuantityKg) : Number(requirement.quantityTons * 1000),
      minimumDirectFarmerLotKg: requirement.minimumDirectFarmerLotKg !== undefined ? Number(requirement.minimumDirectFarmerLotKg) : 0,
      aggregationAllowed: requirement.aggregationAllowed !== false && requirement.aggregation_allowed !== false,
      confirmedProcuredTons: confirmedProcurementTons
    },
    farmerMatches: directFarmers.sort((a, b) => b.matchScore - a.matchScore),
    aggregatorSupply: aggregatorSupply.sort((a, b) => b.matchScore - a.matchScore),
    aggregatorBatches: batches,
    coldStorageInventory: storageMatches,
    supplySummary: {
      // 6 Essential Procurement Metrics (Part 6)
      targetRequirementTons,
      availableFarmerSupplyTons: directFarmerSupplyTons,
      offersSentTons,
      negotiatingTons,
      confirmedProcurementTons,
      remainingRequirementTons,
      // Channel Breakdown
      directFarmerTons: directFarmerSupplyTons,
      aggregatorProcurementTons: batchSupplyTons,
      coldStorageTons: storageSupplyTons,
      totalAvailableTons: totalAvailableSupplyTons,
      fulfillmentPercent
    }
  });
});

// ---------------------------------------------
// AGGREGATOR DEMAND, SUPPLY & PROCUREMENT PLANS
// ---------------------------------------------

// GET /api/aggregator/demand - Open buyer demand in aggregator service area
app.get('/api/aggregator/demand', authMiddleware, requireRole(['aggregator', 'admin']), async (req, res) => {
  const userCoords = resolveCoordinates(req.user);
  const radiusKm = Number(req.query.radiusKm) || req.user.aggregatorProfile?.serviceRadiusKm || 50;

  const allReqs = await db.find('buyerRequirements', r => r.status === 'OPEN');
  const allListings = await db.find('farmerListings', l => l.status === 'ACTIVE');
  const allBatches = await db.find('aggregationBatches');
  const allPlans = await db.find('procurementPlans', p => p.aggregatorId === req.user.id);

  const demands = allReqs.map(reqItem => {
    const reqCoords = resolveCoordinates(reqItem);
    const distanceKm = calculateDistanceKm(userCoords.lat, userCoords.lon, reqCoords.lat, reqCoords.lon);

    // Compatible farmer listings in aggregator radius
    const compatibleListings = allListings.filter(l => {
      const isCrop = (l.cropName || '').toLowerCase() === (reqItem.cropName || '').toLowerCase();
      if (!isCrop) return false;
      const fCoords = resolveCoordinates(l);
      const fDist = calculateDistanceKm(userCoords.lat, userCoords.lon, fCoords.lat, fCoords.lon);
      return fDist <= radiusKm;
    });

    const availableSupplyTons = Number(compatibleListings.reduce((sum, l) => sum + (Number(l.quantityTons) || 0), 0).toFixed(1));

    // Committed volumes in plans & batches
    const relatedPlans = allPlans.filter(p => p.buyerRequirementId === reqItem.id);
    const committedPlanTons = Number(relatedPlans.reduce((sum, p) => sum + ((Number(p.plannedQuantityKg) || 0) / 1000), 0).toFixed(1));
    const relatedBatches = allBatches.filter(b => b.buyerRequirementId === reqItem.id);
    const committedBatchTons = Number(relatedBatches.reduce((sum, b) => sum + (Number(b.currentAggregatedTons) || 0), 0).toFixed(1));
    const committedTons = Math.max(committedPlanTons, committedBatchTons);

    const targetTons = Number(reqItem.quantityTons) || 1;
    const remainingTons = Math.max(0, Number((targetTons - committedTons).toFixed(1)));

    return {
      ...reqItem,
      buyerType: reqItem.buyerType || reqItem.buyer_type || 'bulk',
      requiredQuantityKg: reqItem.requiredQuantityKg ? Number(reqItem.requiredQuantityKg) : Number(reqItem.quantityTons * 1000),
      minimumDirectFarmerLotKg: reqItem.minimumDirectFarmerLotKg !== undefined ? Number(reqItem.minimumDirectFarmerLotKg) : 0,
      aggregationAllowed: reqItem.aggregationAllowed !== false && reqItem.aggregation_allowed !== false,
      distanceKm,
      availableSupplyTons,
      committedTons,
      remainingTons,
      compatibleFarmersCount: compatibleListings.length
    };
  }).filter(d => {
    if (req.query.crop && d.cropName.toLowerCase() !== req.query.crop.toLowerCase()) return false;
    if (req.query.withinRadius === 'true') return d.distanceKm <= radiusKm;
    return true;
  }).sort((a, b) => a.distanceKm - b.distanceKm);

  res.json(demands);
});

// GET /api/aggregator/supply - Farmer supply within aggregator operating radius
app.get('/api/aggregator/supply', authMiddleware, requireRole(['aggregator', 'admin']), async (req, res) => {
  const userCoords = resolveCoordinates(req.user);
  const radiusKm = Number(req.query.radiusKm) || req.user.aggregatorProfile?.serviceRadiusKm || 50;

  const allListings = await db.find('farmerListings', l => l.status === 'ACTIVE');
  const cropFilter = req.query.crop;

  const supply = (await Promise.all(allListings.map(async listing => {
    const fCoords = resolveCoordinates(listing);
    const distanceKm = calculateDistanceKm(userCoords.lat, userCoords.lon, fCoords.lat, fCoords.lon);
    const sanitized = await sanitizeListing(listing, req.user);
    return {
      ...sanitized,
      quantityKg: listing.quantityKg ? Number(listing.quantityKg) : Number(listing.quantityTons * 1000),
      distanceKm,
      latitude: fCoords.lat,
      longitude: fCoords.lon
    };
  }))).filter(item => {
    if (cropFilter && cropFilter !== 'All' && item.cropName.toLowerCase() !== cropFilter.toLowerCase()) return false;
    if (req.query.radiusKm) return item.distanceKm <= radiusKm;
    return true;
  }).sort((a, b) => a.distanceKm - b.distanceKm);

  res.json(supply);
});

// GET /api/aggregator/procurement-plans
app.get('/api/aggregator/procurement-plans', authMiddleware, requireRole(['aggregator', 'admin']), async (req, res) => {
  const plans = await db.find('procurementPlans', p => p.aggregatorId === req.user.id);
  res.json(plans);
});

// POST /api/aggregator/procurement-plans
app.post('/api/aggregator/procurement-plans', authMiddleware, requireRole(['aggregator', 'admin']), requireActiveStatus, async (req, res) => {
  const {
    buyerRequirementId,
    cropName,
    variety,
    targetQuantityKg,
    selectedFarmers = [],
    notes
  } = req.body;

  let reqItem = null;
  if (buyerRequirementId) {
    reqItem = await db.findById('buyerRequirements', buyerRequirementId);
  }

  const plannedQtyKg = selectedFarmers.reduce((sum, f) => sum + (Number(f.quantityKg || (f.quantityTons * 1000)) || 0), 0);
  const estProcCost = selectedFarmers.reduce((sum, f) => {
    const qty = Number(f.quantityKg || (f.quantityTons * 1000)) || 0;
    const price = Number(f.expectedPricePerKg || f.purchasePricePerKg) || 18;
    return sum + (qty * price);
  }, 0);

  const indicativeBuyerPrice = Number(reqItem?.offeredPricePerKg || req.body.indicativeBuyerPricePerKg || 20);
  const estLogistics = Number((plannedQtyKg * 1.25).toFixed(2));
  const indicativeGrossRevenue = plannedQtyKg * indicativeBuyerPrice;
  const estGrossMargin = Number((indicativeGrossRevenue - estProcCost).toFixed(2));
  const estNetMargin = Number((estGrossMargin - estLogistics).toFixed(2));

  const plan = {
    id: `plan-${Date.now()}`,
    aggregatorId: req.user.id,
    aggregatorName: req.user.aggregatorProfile?.businessName || req.user.name,
    buyerRequirementId: reqItem?.id || buyerRequirementId || null,
    buyerName: reqItem?.buyerName || req.body.buyerName || 'Verified Buyer',
    buyerCompany: reqItem?.buyerCompany || req.body.buyerCompany || 'Commercial Buyer',
    cropName: reqItem?.cropName || cropName || 'Potato',
    variety: reqItem?.variety || variety || 'All Varieties',
    targetQuantityKg: Number(targetQuantityKg || (reqItem ? reqItem.quantityTons * 1000 : 20000)),
    plannedQuantityKg: plannedQtyKg,
    selectedFarmers,
    estimatedProcurementCost: estProcCost,
    indicativeBuyerPricePerKg: indicativeBuyerPrice,
    estimatedLogisticsCost: estLogistics,
    estimatedGrossMargin: estGrossMargin,
    estimatedNetMargin: estNetMargin,
    status: 'DRAFT',
    notes: notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db.insert('procurementPlans', plan);
  res.status(201).json(plan);
});

// PUT /api/aggregator/procurement-plans/:id
app.put('/api/aggregator/procurement-plans/:id', authMiddleware, requireRole(['aggregator', 'admin']), requireActiveStatus, async (req, res) => {
  const plan = await db.findById('procurementPlans', req.params.id);
  if (!plan) return res.status(404).json({ error: 'Procurement plan not found' });
  if (plan.aggregatorId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { selectedFarmers, status, notes } = req.body;
  if (selectedFarmers !== undefined) {
    plan.selectedFarmers = selectedFarmers;
    plan.plannedQuantityKg = selectedFarmers.reduce((sum, f) => sum + (Number(f.quantityKg || (f.quantityTons * 1000)) || 0), 0);
    plan.estimatedProcurementCost = selectedFarmers.reduce((sum, f) => {
      const qty = Number(f.quantityKg || (f.quantityTons * 1000)) || 0;
      const price = Number(f.expectedPricePerKg || f.purchasePricePerKg) || 18;
      return sum + (qty * price);
    }, 0);
    const indicativeGrossRevenue = plan.plannedQuantityKg * plan.indicativeBuyerPricePerKg;
    plan.estimatedLogisticsCost = Number((plan.plannedQuantityKg * 1.25).toFixed(2));
    plan.estimatedGrossMargin = Number((indicativeGrossRevenue - plan.estimatedProcurementCost).toFixed(2));
    plan.estimatedNetMargin = Number((plan.estimatedGrossMargin - plan.estimatedLogisticsCost).toFixed(2));
  }
  if (status) plan.status = status;
  if (notes !== undefined) plan.notes = notes;
  plan.updatedAt = new Date().toISOString();

  await db.update('procurementPlans', plan.id, plan);
  res.json(plan);
});

// POST /api/aggregator/procurement-plans/:id/create-batch
// Part N: Pooling is OPTIONAL. If 1 farmer satisfies demand -> Direct Fulfillment, if multiple -> Aggregated Batch!
app.post('/api/aggregator/procurement-plans/:id/create-batch', authMiddleware, requireRole(['aggregator', 'admin']), requireActiveStatus, async (req, res) => {
  const plan = await db.findById('procurementPlans', req.params.id);
  if (!plan) return res.status(404).json({ error: 'Procurement plan not found' });

  const farmerCount = (plan.selectedFarmers || []).length;
  if (farmerCount === 0) {
    return res.status(400).json({ error: 'Cannot create batch with zero selected farmers' });
  }

  const currentAggregatedTons = Number(((plan.plannedQuantityKg || 0) / 1000).toFixed(2));
  const targetQuantityTons = Number(((plan.targetQuantityKg || 0) / 1000).toFixed(2));

  const batch = {
    id: `batch-${Date.now()}`,
    aggregatorId: plan.aggregatorId,
    aggregatorName: plan.aggregatorName,
    buyerRequirementId: plan.buyerRequirementId,
    buyerName: plan.buyerCompany || plan.buyerName,
    cropName: plan.cropName,
    variety: plan.variety,
    targetQuantityTons,
    currentAggregatedTons,
    status: farmerCount === 1 ? 'DIRECT_FULFILLMENT' : 'GATHERING',
    buyerSalePricePerKg: plan.indicativeBuyerPricePerKg,
    farmerPurchasePriceAvg: Number((plan.estimatedProcurementCost / (plan.plannedQuantityKg || 1)).toFixed(2)),
    estimatedLogisticsCostPerKg: 1.25,
    estimatedGrossMarginPerKg: Number((plan.estimatedGrossMargin / (plan.plannedQuantityKg || 1)).toFixed(2)),
    farmers: plan.selectedFarmers.map(f => ({
      listingId: f.listingId || f.id,
      farmerId: f.farmerId,
      farmerName: f.farmerName,
      farmerLocation: f.farmerLocation,
      quantityTons: f.quantityTons || (f.quantityKg ? f.quantityKg / 1000 : 1),
      purchasePricePerKg: f.expectedPricePerKg || f.purchasePricePerKg || 18
    })),
    createdAt: new Date().toISOString()
  };

  await db.insert('aggregationBatches', batch);

  plan.batchId = batch.id;
  plan.status = farmerCount === 1 ? 'DIRECT_FULFILLMENT' : 'AGGREGATED';
  plan.updatedAt = new Date().toISOString();
  await db.update('procurementPlans', plan.id, plan);

  res.status(201).json({ plan, batch });
});

// ---------------------------------------------
// GEMINI AI RECOMMENDATION ADVISORY
// ---------------------------------------------

app.post('/api/ai/buyer-recommendation', authMiddleware, aiLimiter, async (req, res) => {
  try {
    const { listingId, cropName, quantityTons, location, latitude, longitude, grade, expectedPricePerKg, language = 'hi' } = req.body;
    let listing = null;
    if (listingId) {
      listing = await db.findById('farmerListings', listingId);
    }
    if (!listing && (cropName || quantityTons)) {
      listing = {
        id: 'adhoc-listing',
        farmerId: req.user.id,
        farmerName: req.user.name,
        cropName: cropName || 'Potato',
        quantityTons: Number(quantityTons) || 5,
        grade: grade || 'Grade A',
        farmerLocation: location || req.user.location || 'Kushinagar, UP',
        latitude: latitude || req.user.latitude || 26.740,
        longitude: longitude || req.user.longitude || 83.889,
        expectedPricePerKg: expectedPricePerKg || 18,
        status: 'ACTIVE'
      };
    }
    if (!listing) {
      const userListings = await db.find('farmerListings', l => l.farmerId === req.user.id && l.status === 'ACTIVE');
      listing = userListings[0];
    }

    if (!listing) {
      return res.status(400).json({ error: 'No active listing found for AI recommendation' });
    }

    const allReqs = await db.find('buyerRequirements', r => r.status === 'OPEN' || r.status === 'ACTIVE');
    const matches = allReqs.map(reqItem => {
      const matchResult = calculateMatch(listing, reqItem);
      return {
        requirement: reqItem,
        matchScore: matchResult.score,
        eligibility: matchResult.eligibility,
        distanceKm: matchResult.distanceKm,
        reasons: matchResult.reasons,
        structuredReasons: matchResult.structuredReasons,
        route: matchResult.route
      };
    }).filter(m => m.eligibility.visibleToFarmer === true)
      .sort((a, b) => b.matchScore - a.matchScore);

    const result = await generateBuyerRecommendation({
      listing,
      opportunities: matches,
      language: language === 'en' ? 'en' : 'hi'
    });

    res.json(result);
  } catch (err) {
    console.error('[AI Recommendation] Error:', err);
    res.json({
      available: true,
      summary: req.body.language === 'en' 
        ? 'Best matching buyer options grounded in verified market demand:' 
        : 'सत्यापित खरीदार मांग के आधार पर शीर्ष अनुशंसित विकल्प:',
      recommendations: [],
      fallbackMessage: null
    });
  }
});

// ---------------------------------------------
// KISAN SAATHI CONVERSATIONAL AI ASSISTANT (MULTI-ROLE)
// ---------------------------------------------

app.post('/api/ai/kisan-saathi/chat', authMiddleware, requireRole(['farmer', 'aggregator', 'buyer', 'dealer', 'admin']), aiLimiter, async (req, res) => {
  try {
    const { message, history = [], language = 'hi' } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    if (message.length > 1000) {
      return res.status(400).json({ error: 'Message exceeds maximum length of 1000 characters' });
    }

    const userId = req.user.id;
    const user = await db.findById('users', userId) || req.user;
    const role = (user.role || req.user.role || 'farmer').toLowerCase();

    let verifiedContext = {};

    if (role === 'farmer') {
      const farmerListings = await db.find('farmerListings', l => l.farmerId === userId && l.status === 'ACTIVE');
      const openRequirements = await db.find('buyerRequirements', r => r.status === 'OPEN' || r.status === 'ACTIVE');
      const primaryListing = farmerListings[0];
      
      const evaluatedBuyers = openRequirements.map(reqItem => {
        const dist = calculateDistanceKm(
          Number(primaryListing?.latitude || user?.latitude || 26.740),
          Number(primaryListing?.longitude || user?.longitude || 83.889),
          Number(reqItem.delivery_latitude || reqItem.deliveryLatitude || 26.740),
          Number(reqItem.delivery_longitude || reqItem.deliveryLongitude || 83.889)
        );

        let elig = { eligible: true, routeType: 'direct_local' };
        if (primaryListing) {
          elig = evaluateEligibility(primaryListing, reqItem);
        } else {
          const bType = (reqItem.buyerType || (reqItem.quantityTons >= 20 ? 'bulk' : 'local')).toLowerCase();
          elig = {
            eligible: bType === 'local',
            routeType: bType === 'local' ? 'direct_local' : 'aggregator_pooled'
          };
        }

        return {
          ...reqItem,
          distanceKm: dist,
          routeType: elig.routeType,
          directEligible: elig.eligible && elig.routeType !== 'aggregator_pooled'
        };
      }).sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));

      const farmerOffers = await db.find('offers', o => o.sellerId === userId);
      const storageFacilities = await db.find('coldStorages', s => s.status === 'ACTIVE');

      verifiedContext = {
        listings: farmerListings,
        buyers: evaluatedBuyers,
        offersCount: farmerOffers.length,
        storageFacilities
      };
    } else if (role === 'aggregator') {
      const buyerRequirements = await db.find('buyerRequirements', r => r.status === 'OPEN' || r.status === 'ACTIVE');
      const farmerListings = await db.find('farmerListings', l => l.status === 'ACTIVE');
      
      const evaluatedRequirements = buyerRequirements.map(reqItem => {
        const dist = calculateDistanceKm(
          Number(user?.latitude || 27.176),
          Number(user?.longitude || 78.008),
          Number(reqItem.delivery_latitude || reqItem.deliveryLatitude || 27.176),
          Number(reqItem.delivery_longitude || reqItem.deliveryLongitude || 78.008)
        );
        return { ...reqItem, distanceKm: dist };
      }).sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));

      const evaluatedSupply = farmerListings.map(listingItem => {
        const dist = calculateDistanceKm(
          Number(user?.latitude || 27.176),
          Number(user?.longitude || 78.008),
          Number(listingItem.latitude || 27.176),
          Number(listingItem.longitude || 78.008)
        );
        return { ...listingItem, distanceKm: dist };
      }).sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));

      const batches = await db.find('aggregationBatches', b => b.aggregatorId === userId);
      const procurementPlans = await db.find('procurementPlans', p => p.aggregatorId === userId);

      verifiedContext = {
        buyerRequirements: evaluatedRequirements,
        buyers: evaluatedRequirements,
        farmerListings: evaluatedSupply,
        batches,
        procurementPlans
      };
    } else if (role === 'buyer' || role === 'dealer') {
      const buyerRequirements = await db.find('buyerRequirements', r => (r.buyerId === userId || r.buyer_id === userId));
      const farmerListings = await db.find('farmerListings', l => l.status === 'ACTIVE');
      
      const evaluatedSupply = farmerListings.map(l => {
        const dist = calculateDistanceKm(
          Number(user?.latitude || 28.613),
          Number(user?.longitude || 77.209),
          Number(l.latitude || 27.176),
          Number(l.longitude || 78.008)
        );
        return { ...l, distanceKm: dist };
      }).sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));

      const offers = await db.find('offers', o => o.buyerId === userId);
      const orders = await db.find('orders', o => o.buyerId === userId);

      verifiedContext = {
        buyerRequirements,
        farmerListings: evaluatedSupply,
        offers,
        orders
      };
    }

    const aiResponse = await generateKisanSaathiResponse({
      user,
      role,
      farmer: user,
      message: message.trim(),
      history,
      verifiedContext,
      language
    });

    res.json(aiResponse);
  } catch (err) {
    console.error('[Kisan Saathi Chat] Error:', err);
    res.json({
      success: true,
      available: true,
      reply: 'मैं आपकी सहायता के लिए तैयार हूँ। कृपया नीचे दिए गए बटनों से तुरंत अपनी जरूरत चुनें।',
      actions: [
        { label: 'Buyer खोजें', actionType: 'navigate_buyers', tab: 'buyers' },
        { label: 'मेरी फसल', actionType: 'navigate_crops', tab: 'listings' },
        { label: 'मेरे Offers', actionType: 'navigate_offers', tab: 'offers' },
        { label: 'Cold Storage', actionType: 'navigate_storage', tab: 'storage' }
      ],
      fallbackMessage: null
    });
  }
});

// ---------------------------------------------
// 6. OFFERS & NEGOTIATION
// ---------------------------------------------

app.get('/api/offers', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const offers = await getAllOffersForUser({ user });
    res.json(offers);
  } catch (err) {
    console.error('Error fetching offers:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch offers' });
  }
});

app.get('/api/offers/sent', authMiddleware, async (req, res) => {
  try {
    const offers = await getSentOffers({ user: req.user });
    res.json(offers);
  } catch (err) {
    console.error('Error fetching sent offers:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch sent offers' });
  }
});

app.get('/api/offers/incoming', authMiddleware, async (req, res) => {
  try {
    const offers = await getIncomingOffers({ user: req.user });
    res.json(offers);
  } catch (err) {
    console.error('Error fetching incoming offers:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch incoming offers' });
  }
});

app.post('/api/offers', authMiddleware, requireRole(['farmer', 'aggregator', 'dealer', 'buyer', 'admin']), requireActiveStatus, async (req, res) => {
  try {
    const newOffer = await createOffer({ user: req.user, offerData: req.body });
    res.status(201).json(newOffer);
  } catch (err) {
    console.error('Error creating offer:', err);
    res.status(400).json({ error: err.message || 'Failed to create offer' });
  }
});

app.post('/api/offers/:id/accept', authMiddleware, requireActiveStatus, async (req, res) => {
  try {
    const result = await acceptOffer({ user: req.user, offerId: req.params.id });
    res.json(result);
  } catch (err) {
    console.error('Error accepting offer:', err);
    res.status(400).json({ error: err.message || 'Failed to accept offer' });
  }
});

app.post('/api/offers/:id/counter', authMiddleware, requireActiveStatus, async (req, res) => {
  try {
    const { counterPricePerKg, counterQuantityTons, pickupTerms, deliveryTerms, targetDate, date, message } = req.body;
    const updatedOffer = await counterOffer({
      user: req.user,
      offerId: req.params.id,
      counterPricePerKg,
      counterQuantityTons,
      pickupTerms,
      deliveryTerms,
      targetDate,
      date,
      message
    });
    res.json(updatedOffer);
  } catch (err) {
    console.error('Error countering offer:', err);
    res.status(400).json({ error: err.message || 'Failed to counter offer' });
  }
});

app.post('/api/offers/:id/reject', authMiddleware, requireActiveStatus, async (req, res) => {
  try {
    const { reason } = req.body;
    const updatedOffer = await rejectOffer({
      user: req.user,
      offerId: req.params.id,
      reason
    });
    res.json(updatedOffer);
  } catch (err) {
    console.error('Error rejecting offer:', err);
    res.status(400).json({ error: err.message || 'Failed to reject offer' });
  }
});

app.put('/api/offers/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status, counterPricePerKg, counterQuantityTons, reason, message } = req.body;
    if (status === 'ACCEPTED') {
      const result = await acceptOffer({ user: req.user, offerId: req.params.id });
      return res.json({ offer: { id: req.params.id, status: 'ACCEPTED' }, order: result.deal });
    }
    if (status === 'REJECTED') {
      const updatedOffer = await rejectOffer({ user: req.user, offerId: req.params.id, reason: reason || message });
      return res.json({ offer: updatedOffer });
    }
    if (status === 'COUNTERED') {
      const updatedOffer = await counterOffer({
        user: req.user,
        offerId: req.params.id,
        counterPricePerKg,
        counterQuantityTons,
        message
      });
      return res.json({ offer: updatedOffer });
    }
    return res.status(400).json({ error: 'Unsupported offer status update' });
  } catch (err) {
    console.error('Error updating offer status:', err);
    res.status(400).json({ error: err.message || 'Failed to update offer' });
  }
});

// Dedicated Deals Endpoints (Mirrors / Orders)
app.get('/api/deals', authMiddleware, async (req, res) => {
  try {
    const deals = await getDealsForUser({ user: req.user });
    res.json(deals);
  } catch (err) {
    console.error('Error fetching deals:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch deals' });
  }
});

app.get('/api/deals/:id', authMiddleware, async (req, res) => {
  try {
    const deal = await getDealById({ user: req.user, dealId: req.params.id });
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    res.json(deal);
  } catch (err) {
    console.error('Error fetching deal:', err);
    res.status(400).json({ error: err.message || 'Failed to fetch deal' });
  }
});

// ---------------------------------------------
// 7. ORDERS & STATE MACHINE
// ---------------------------------------------

app.get('/api/orders', authMiddleware, async (req, res) => {
  const user = req.user;
  let orders = [];
  if (user.role === 'farmer' || user.role === 'aggregator') {
    orders = await db.find('orders', o => o.sellerId === user.id);
  } else if (user.role === 'buyer') {
    orders = await db.find('orders', o => o.buyerId === user.id);
  } else if (user.role === 'transporter') {
    orders = await db.find('orders', o => o.transporterId === 'trp-601');
  } else {
    orders = await db.find('orders'); // Admin sees all
  }
  res.json(orders);
});

app.get('/api/orders/:id', authMiddleware, async (req, res) => {
  const order = await db.findById('orders', req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// Advance order status
app.put('/api/orders/:id/status', authMiddleware, async (req, res) => {
  const { status, note } = req.body;
  const validStatuses = ['CREATED', 'CONFIRMED', 'AGGREGATING', 'READY_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid order status' });
  }

  const order = await db.findById('orders', req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const timeline = order.timeline || [];
  timeline.push({
    status,
    note: note || `Order advanced to ${status}`,
    timestamp: new Date().toISOString()
  });

  const updates = { status, timeline };
  if (status === 'COMPLETED') {
    updates.paymentStatus = 'RELEASED_TO_SELLER';
  }

  const updatedOrder = await db.updateById('orders', req.params.id, updates);

  // Notify parties
  await db.insert('notifications', {
    userId: order.buyerId,
    title: `Order ${order.orderNumber} Status: ${status}`,
    message: note || `Order transitioned to ${status}`,
    type: 'ORDER',
    read: false,
    timestamp: new Date().toISOString()
  });

  res.json(updatedOrder);
});

// ---------------------------------------------
// 8. LOCAL AGGREGATOR MODULE & SUBSCRIPTION
// ---------------------------------------------

app.get('/api/aggregators/profile', authMiddleware, async (req, res) => {
  if (req.user.role !== 'aggregator') {
    return res.status(403).json({ error: 'Only aggregator can access aggregator profile' });
  }

  const plans = await db.find('subscriptionPlans');
  const currentPlan = plans.find(p => p.id === req.user.aggregatorProfile?.subscribedPlanId) || null;

  res.json({
    user: req.user,
    profile: req.user.aggregatorProfile,
    currentPlan,
    isActive: req.user.aggregatorProfile?.subscriptionStatus === 'ACTIVE'
  });
});

// Subscribe to Aggregator Plan
app.post('/api/aggregators/subscribe', authMiddleware, async (req, res) => {
  const { planId, billingCycle = 'monthly', region, crops } = req.body;
  const plan = await db.findById('subscriptionPlans', planId);
  if (!plan) return res.status(404).json({ error: 'Invalid subscription plan' });

  const durationDays = billingCycle === 'yearly' ? 365 : 30;
  const expiresAt = new Date(Date.now() + durationDays * 86400000).toISOString();

  const updatedProfile = {
    ...req.user.aggregatorProfile,
    subscribedPlanId: plan.id,
    subscriptionStatus: 'ACTIVE',
    subscriptionExpiresAt: expiresAt,
    operatingRegion: region || req.user.aggregatorProfile?.operatingRegion || 'Agra Zone',
    allowedCrops: crops || plan.allowedCrops,
    maxAggregationCapacityTons: plan.maxAggregationCapacityTons
  };

  const updatedUser = await db.updateById('users', req.user.id, {
    aggregatorProfile: updatedProfile
  });

  // Record platform transaction
  const amount = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  await db.insert('notifications', {
    userId: req.user.id,
    title: `Subscription Activated: ${plan.name}`,
    message: `Payment of ₹${amount} simulated successfully. Subscription active until ${new Date(expiresAt).toLocaleDateString()}.`,
    type: 'SUBSCRIPTION',
    read: false,
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    plan,
    expiresAt,
    user: updatedUser
  });
});

// ---------------------------------------------
// 9. AGGREGATION BATCH BUILDER & MARGINS
// ---------------------------------------------

app.get('/api/batches', authMiddleware, async (req, res) => {
  const batches = await db.find('aggregationBatches');
  res.json(batches);
});

app.post('/api/batches', authMiddleware, requireRole(['aggregator', 'admin']), requireActiveStatus, async (req, res) => {
  // Check subscription status
  if (req.user.role === 'aggregator' && req.user.aggregatorProfile?.subscriptionStatus !== 'ACTIVE') {
    return res.status(403).json({
      error: 'Active subscription required to create aggregation batches. Please activate a plan.'
    });
  }

  const {
    buyerRequirementId,
    buyerName,
    cropName,
    variety,
    targetQuantityTons,
    buyerSalePricePerKg,
    farmers = []
  } = req.body;

  let currentAggregatedTons = 0;
  let totalFarmerPurchaseCost = 0;

  farmers.forEach(f => {
    currentAggregatedTons += Number(f.quantityTons);
    totalFarmerPurchaseCost += (Number(f.quantityTons) * 1000 * Number(f.purchasePricePerKg));
  });

  const farmerPurchasePriceAvg = currentAggregatedTons > 0 
    ? Number((totalFarmerPurchaseCost / (currentAggregatedTons * 1000)).toFixed(2))
    : Number(buyerSalePricePerKg) - 2.5;

  const logisticsCostPerKg = 0.85;
  const storageCostPerKg = 0.25;
  const platformFeePerKg = 0.15;
  const grossMargin = Number((Number(buyerSalePricePerKg) - (farmerPurchasePriceAvg + logisticsCostPerKg + storageCostPerKg + platformFeePerKg)).toFixed(2));

  const newBatch = {
    id: `batch-${Date.now()}`,
    aggregatorId: req.user.id,
    aggregatorName: req.user.aggregatorProfile?.businessName || req.user.name,
    buyerRequirementId: buyerRequirementId || 'req-custom',
    buyerName: buyerName || 'Bulk Buyer',
    cropName: cropName || 'Potato',
    variety: variety || 'Standard',
    targetQuantityTons: Number(targetQuantityTons),
    currentAggregatedTons,
    status: currentAggregatedTons >= Number(targetQuantityTons) ? 'READY_TO_FULFILL' : 'GATHERING',
    buyerSalePricePerKg: Number(buyerSalePricePerKg),
    farmerPurchasePriceAvg,
    estimatedLogisticsCostPerKg: logisticsCostPerKg,
    estimatedStorageCostPerKg: storageCostPerKg,
    estimatedPlatformFeePerKg: platformFeePerKg,
    estimatedGrossMarginPerKg: grossMargin,
    farmers,
    collectionRoute: {
      stops: farmers.map((f, i) => `Stop ${i + 1}: ${f.farmerLocation} (${f.farmerName} - ${f.quantityTons}T)`),
      totalDistanceKm: 45 + (farmers.length * 12),
      estimatedTransportCostTotal: 15000 + (farmers.length * 5000),
      estimatedCostPerKg: logisticsCostPerKg
    },
    createdAt: new Date().toISOString()
  };

  await db.insert('aggregationBatches', newBatch);
  res.status(201).json(newBatch);
});

// Add farmer listing to batch — SINGLE ATOMIC UPDATE
app.post('/api/batches/:id/add-farmer', authMiddleware, requireRole(['aggregator', 'admin']), requireActiveStatus, async (req, res) => {
  try {
    const updated = await db.addFarmerToBatch(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Batch not found' });
    res.json(updated);
  } catch (err) {
    console.error('[BATCH ADD FARMER] Error:', err.message);
    res.status(500).json({ error: 'Failed to add farmer to batch', message: err.message });
  }
});

// ---------------------------------------------
// 10. COLD STORAGE MODULE & INVENTORY
// ---------------------------------------------

// ---------------------------------------------
// 10. COLD STORAGE MODULE & INVENTORY
// ---------------------------------------------

app.get('/api/storage', async (req, res) => {
  const storages = await db.find('coldStorages');
  res.json(storages);
});

app.get('/api/storage/:id', async (req, res) => {
  const storage = await db.findById('coldStorages', req.params.id);
  if (!storage) return res.status(404).json({ error: 'Storage facility not found' });
  res.json(storage);
});

// Book cold storage space
app.post('/api/storage/book', authMiddleware, async (req, res) => {
  const { storageId, cropName, variety, quantityTons, durationMonths } = req.body;
  const storage = await db.findById('coldStorages', storageId);
  if (!storage) return res.status(404).json({ error: 'Storage not found' });

  const months = Number(durationMonths) || 3;
  const qty = Number(quantityTons) || 10;
  const totalCost = qty * (storage.storageChargePerMonthPerTon || 180) * months;

  const newBooking = {
    id: `sb-${Date.now()}`,
    storageId,
    storageName: storage.name,
    farmerId: req.user.id,
    farmerName: req.user.name,
    cropName,
    variety: variety || 'Standard',
    quantityTons: qty,
    entryDate: new Date().toISOString().split('T')[0],
    expectedReleaseDate: new Date(Date.now() + months * 30 * 86400000).toISOString().split('T')[0],
    durationMonths: months,
    ratePerTonPerMonth: storage.storageChargePerMonthPerTon || 180,
    totalStorageCharge: totalCost,
    status: 'ACTIVE',
    receiptNumber: `AICL-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString()
  };

  await db.insert('storageBookings', newBooking);

  // Update storage capacity
  const occ = (storage.occupiedCapacityTons || 0) + qty;
  const avail = Math.max(0, (storage.availableCapacityTons || storage.totalCapacityTons) - qty);
  const totalCap = storage.totalCapacityTons || 1000;
  await db.updateById('coldStorages', storageId, {
    occupiedCapacityTons: occ,
    availableCapacityTons: avail,
    utilizationPercent: Math.round((occ / totalCap) * 100)
  });

  res.status(201).json(newBooking);
});

app.get('/api/storage/bookings/my', authMiddleware, async (req, res) => {
  const bookings = await db.find('storageBookings', b => b.farmerId === req.user.id);
  res.json(bookings);
});

// Storage Decision Analysis: "Sell Now vs Store & Sell Later"
app.post('/api/storage/scenario', publicSimulationLimiter, (req, res) => {
  const { currentOfferPricePerKg, expectedFuturePricePerKg, storageDurationMonths, storageChargePerMonthPerKg } = req.body;
  const analysis = calculateStorageScenario({
    currentOfferPricePerKg: Number(currentOfferPricePerKg) || 18.0,
    expectedFuturePricePerKg: Number(expectedFuturePricePerKg) || 22.5,
    storageDurationMonths: Number(storageDurationMonths) || 3,
    storageChargePerMonthPerKg: Number(storageChargePerMonthPerKg) || 0.45
  });

  res.json(analysis);
});

// ---------------------------------------------
// 11. TRANSPORTERS & LOGISTICS MODULE
// ---------------------------------------------

app.get('/api/transporters', async (req, res) => {
  const transporters = await db.find('transporters');
  res.json(transporters);
});

app.post('/api/transporters/calculate-route', publicSimulationLimiter, (req, res) => {
  const { stops = [], totalQuantityTons = 10, vehicleType = 'Canter (4-6T)' } = req.body;

  const numStops = Math.max(1, stops.length);
  const baseKm = 40;
  const additionalKmPerStop = 18;
  const totalDistanceKm = baseKm + ((numStops - 1) * additionalKmPerStop);

  const ratePerKm = vehicleType.includes('Heavy') ? 68 : vehicleType.includes('Canter') ? 34 : 22;
  const baseCharge = vehicleType.includes('Heavy') ? 3500 : 1200;
  const totalTransportCost = baseCharge + (totalDistanceKm * ratePerKm);
  const costPerKg = Number((totalTransportCost / (totalQuantityTons * 1000)).toFixed(2));

  res.json({
    stops,
    totalDistanceKm,
    vehicleType,
    ratePerKm,
    baseCharge,
    totalTransportCost,
    costPerKg,
    estimatedTransitHours: Math.ceil(totalDistanceKm / 35),
    disclaimer: 'Indicative freight tariff based on multi-point rural consolidation rates.'
  });
});

// ---------------------------------------------
// 12. MARKET PRICES INTELLIGENCE
// ---------------------------------------------

app.get('/api/market-prices', async (req, res) => {
  const { crop, district } = req.query;
  let prices = await db.find('marketPrices');

  if (crop) {
    prices = prices.filter(p => (p.cropName || '').toLowerCase() === crop.toLowerCase());
  }
  if (district) {
    prices = prices.filter(p => (p.district || '').toLowerCase() === district.toLowerCase());
  }

  res.json(prices);
});

// ---------------------------------------------
// 13. SUPPLY & DEMAND FORECASTING & AI LAYER
// ---------------------------------------------

app.get('/api/forecasts/regional', async (req, res) => {
  const forecasts = await db.find('regionalSupplyForecasts');
  res.json(forecasts);
});

app.post('/api/forecasts/predict-yield', publicSimulationLimiter, (req, res) => {
  const { cropName, variety, acres, irrigationType, soilType, historicalYieldPerAcre } = req.body;
  const prediction = predictYield({
    cropName,
    variety,
    acres: Number(acres) || 10,
    irrigationType,
    soilType,
    historicalYieldPerAcre: Number(historicalYieldPerAcre) || 14
  });

  res.json(prediction);
});

app.post('/api/forecasts/cv-quality', publicSimulationLimiter, (req, res) => {
  const { cropName, variety, imageFileName } = req.body;
  const assessment = analyzeProduceQualityCV({
    cropName: cropName || 'Potato',
    variety: variety || 'Kufri Jyoti',
    imageFileName
  });

  res.json(assessment);
});

// ---------------------------------------------
// 14. ADMIN PANEL APIs
// ---------------------------------------------

// Helper to mask phone numbers (showing last 4 digits only)
function maskPhoneNumber(p) {
  if (!p) return null;
  const digits = String(p).replace(/\D/g, '');
  if (digits.length <= 4) return '••••';
  const last4 = digits.slice(-4);
  return `•••••• ${last4}`;
}

app.get('/api/admin/stats', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { pool } = require('./db');

    // Efficient database queries: counts by role, status, 30-day signups trend, pending count
    const [roleRes, statusRes, pendingRes, signupsRes, totalsRes] = await Promise.all([
      pool.query('SELECT role, COUNT(*)::int AS count FROM users GROUP BY role'),
      pool.query('SELECT status, COUNT(*)::int AS count FROM users GROUP BY status'),
      pool.query("SELECT COUNT(*)::int AS count FROM users WHERE status = 'pending' AND role IN ('aggregator', 'dealer', 'buyer')"),
      pool.query(`
        SELECT TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
               COALESCE(COUNT(u.id), 0)::int AS count
        FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, '1 day') AS d(day)
        LEFT JOIN users u ON DATE(u.created_at) = d.day
        GROUP BY d.day
        ORDER BY d.day ASC
      `),
      pool.query(`
        SELECT 
          (SELECT COUNT(*)::int FROM users) AS total_users,
          (SELECT COUNT(*)::int FROM farmer_listings WHERE status = 'ACTIVE') AS active_listings,
          (SELECT COUNT(*)::int FROM buyer_requirements WHERE status = 'OPEN') AS open_requirements,
          (SELECT COUNT(*)::int FROM aggregation_batches WHERE status != 'COMPLETED') AS active_batches,
          (SELECT COUNT(*)::int FROM orders) AS total_orders,
          (SELECT COALESCE(SUM(total_amount), 0)::numeric FROM orders) AS total_gmv,
          (SELECT COALESCE(SUM(total_capacity_tons), 0)::numeric FROM cold_storages) AS total_cold_storage_capacity_tons,
          (SELECT COALESCE(SUM(occupied_capacity_tons), 0)::numeric FROM cold_storages) AS occupied_cold_storage_capacity_tons
      `)
    ]);

    const usersByRole = {
      farmer: 0, aggregator: 0, buyer: 0, cold_storage: 0, transporter: 0, admin: 0
    };
    roleRes.rows.forEach(r => {
      const roleKey = r.role === 'dealer' ? 'buyer' : r.role;
      usersByRole[roleKey] = (usersByRole[roleKey] || 0) + Number(r.count);
    });

    const usersByStatus = {
      pending: 0, active: 0, blocked: 0, rejected: 0
    };
    statusRes.rows.forEach(s => {
      usersByStatus[s.status] = Number(s.count);
    });

    const totals = totalsRes.rows[0];

    res.json({
      totalUsers: Number(totals.total_users || 0),
      usersByRole,
      roleCounts: usersByRole,
      usersByStatus,
      statusCounts: usersByStatus,
      pendingCount: Number(pendingRes.rows[0]?.count || 0),
      signupTrend30Days: signupsRes.rows.map(r => ({ date: r.date, count: Number(r.count) })),
      signupTrend: signupsRes.rows.map(r => ({ date: r.date, count: Number(r.count) })),
      activeListings: Number(totals.active_listings || 0),
      openRequirements: Number(totals.open_requirements || 0),
      activeBatches: Number(totals.active_batches || 0),
      totalOrders: Number(totals.total_orders || 0),
      totalGMV: Number(totals.total_gmv || 0),
      totalColdStorageCapacityTons: Number(totals.total_cold_storage_capacity_tons || 0),
      occupiedColdStorageCapacityTons: Number(totals.occupied_cold_storage_capacity_tons || 0)
    });
  } catch (err) {
    console.error('[ADMIN STATS] Database error:', err.message);
    res.status(500).json({ error: 'Failed to compute admin statistics' });
  }
});

// Admin Stakeholder Directory (Masks phone numbers by default for privacy)
app.get('/api/admin/users', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { pool, mapRow } = require('./db');
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    const users = result.rows.map(row => {
      const u = mapRow(row);
      const { password: _, ...userSafe } = u;
      userSafe.rawPhone = undefined;
      userSafe.phoneMasked = maskPhoneNumber(u.phone);
      userSafe.phone = maskPhoneNumber(u.phone);
      return userSafe;
    });
    res.json(users);
  } catch (err) {
    console.error('[ADMIN USERS] Database error:', err.message);
    res.status(500).json({ error: 'Failed to fetch users directory' });
  }
});

// Reveal masked phone number (logs to audit_log)
app.post('/api/admin/users/:id/reveal-phone', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { pool, mapRow } = require('./db');
    const { logAudit } = require('./services/auditService');
    const userRes = await pool.query('SELECT id, name, phone, role FROM users WHERE id = $1', [req.params.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const target = mapRow(userRes.rows[0]);

    await logAudit({
      adminId: req.user.id,
      action: 'reveal_phone',
      targetUserId: target.id,
      details: { role: target.role, name: target.name }
    });

    res.json({ id: target.id, phone: target.phone });
  } catch (err) {
    console.error('[ADMIN REVEAL PHONE] Error:', err.message);
    res.status(500).json({ error: 'Failed to reveal phone number' });
  }
});

// Pending Approvals List for Aggregators / Dealers
app.get('/api/admin/pending-approvals', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { pool, mapRow } = require('./db');
    const result = await pool.query(`
      SELECT id, name, email, phone, role, status, business_profile, location, created_at
      FROM users
      WHERE status = 'pending' AND role IN ('aggregator', 'dealer', 'buyer')
      ORDER BY created_at ASC
    `);
    const list = result.rows.map(row => {
      const u = mapRow(row);
      const { password: _, ...safe } = u;
      safe.phoneMasked = maskPhoneNumber(u.phone);
      safe.phone = maskPhoneNumber(u.phone);
      return safe;
    });
    res.json(list);
  } catch (err) {
    console.error('[ADMIN PENDING] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

// Approve Pending Account
app.post('/api/admin/users/:id/approve', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { pool, mapRow } = require('./db');
    const { logAudit } = require('./services/auditService');
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const targetUser = mapRow(userRes.rows[0]);

    const updateRes = await pool.query(`
      UPDATE users
      SET status = 'active', rejection_reason = NULL, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [req.params.id]);

    const updated = mapRow(updateRes.rows[0]);
    await logAudit({
      adminId: req.user.id,
      action: 'approve',
      targetUserId: targetUser.id,
      details: { role: targetUser.role, name: targetUser.name, email: targetUser.email, previousStatus: targetUser.status }
    });

    const { password: _, ...userSafe } = updated;
    res.json({ success: true, message: 'User approved successfully', user: userSafe });
  } catch (err) {
    console.error('[ADMIN APPROVE] Error:', err.message);
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// Reject Pending Account with optional reason
app.post('/api/admin/users/:id/reject', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { pool, mapRow } = require('./db');
    const { logAudit } = require('./services/auditService');
    const { reason } = req.body || {};
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const targetUser = mapRow(userRes.rows[0]);

    const updateRes = await pool.query(`
      UPDATE users
      SET status = 'rejected', rejection_reason = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [req.params.id, reason || null]);

    const updated = mapRow(updateRes.rows[0]);
    await logAudit({
      adminId: req.user.id,
      action: 'reject',
      targetUserId: targetUser.id,
      details: { reason: reason || null, role: targetUser.role, name: targetUser.name, previousStatus: targetUser.status }
    });

    const { password: _, ...userSafe } = updated;
    res.json({ success: true, message: 'User rejected', user: userSafe });
  } catch (err) {
    console.error('[ADMIN REJECT] Error:', err.message);
    res.status(500).json({ error: 'Failed to reject user' });
  }
});

// Block Account
app.post('/api/admin/users/:id/block', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { pool, mapRow } = require('./db');
    const { logAudit } = require('./services/auditService');
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const targetUser = mapRow(userRes.rows[0]);

    const updateRes = await pool.query(`
      UPDATE users
      SET status = 'blocked', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [req.params.id]);

    const updated = mapRow(updateRes.rows[0]);
    await logAudit({
      adminId: req.user.id,
      action: 'block',
      targetUserId: targetUser.id,
      details: { role: targetUser.role, name: targetUser.name, previousStatus: targetUser.status }
    });

    const { password: _, ...userSafe } = updated;
    res.json({ success: true, message: 'User account blocked', user: userSafe });
  } catch (err) {
    console.error('[ADMIN BLOCK] Error:', err.message);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Unblock Account
app.post('/api/admin/users/:id/unblock', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { pool, mapRow } = require('./db');
    const { logAudit } = require('./services/auditService');
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const targetUser = mapRow(userRes.rows[0]);

    const updateRes = await pool.query(`
      UPDATE users
      SET status = 'active', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [req.params.id]);

    const updated = mapRow(updateRes.rows[0]);
    await logAudit({
      adminId: req.user.id,
      action: 'unblock',
      targetUserId: targetUser.id,
      details: { role: targetUser.role, name: targetUser.name, previousStatus: targetUser.status }
    });

    const { password: _, ...userSafe } = updated;
    res.json({ success: true, message: 'User account unblocked', user: userSafe });
  } catch (err) {
    console.error('[ADMIN UNBLOCK] Error:', err.message);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

app.put('/api/admin/users/:id/verify', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { pool, mapRow } = require('./db');
    const { logAudit } = require('./services/auditService');
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = mapRow(userRes.rows[0]);

    const updatedVerified = !user.verified;
    const updateRes = await pool.query(`
      UPDATE users SET verified = $1, updated_at = NOW() WHERE id = $2 RETURNING *
    `, [updatedVerified, req.params.id]);

    const updated = mapRow(updateRes.rows[0]);
    await logAudit({
      adminId: req.user.id,
      action: 'verify',
      targetUserId: user.id,
      details: { verified: updatedVerified, role: user.role, name: user.name }
    });

    const { password: _, ...userSafe } = updated;
    res.json(userSafe);
  } catch (err) {
    console.error('[ADMIN VERIFY TOGGLE] Error:', err.message);
    res.status(500).json({ error: 'Failed to toggle verification' });
  }
});

// Make Any User an Admin (multiple admins fully supported)
app.post('/api/admin/users/:id/make-admin', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { pool, mapRow } = require('./db');
    const { logAudit } = require('./services/auditService');
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const targetUser = mapRow(userRes.rows[0]);

    const updateRes = await pool.query(`
      UPDATE users
      SET role = 'admin', status = 'active', verified = true, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [req.params.id]);

    const updated = mapRow(updateRes.rows[0]);
    await logAudit({
      adminId: req.user.id,
      action: 'make_admin',
      targetUserId: targetUser.id,
      details: { previousRole: targetUser.role, name: targetUser.name, email: targetUser.email }
    });

    const { password: _, ...userSafe } = updated;
    res.json({ success: true, message: `${updated.name} has been granted Admin privileges`, user: userSafe });
  } catch (err) {
    console.error('[ADMIN MAKE ADMIN] Error:', err.message);
    res.status(500).json({ error: 'Failed to promote user to admin' });
  }
});

// Update User Role
app.post('/api/admin/users/:id/role', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { role } = req.body || {};
    const validRoles = ['farmer', 'aggregator', 'buyer', 'dealer', 'cold_storage', 'transporter', 'admin'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Allowed roles: ${validRoles.join(', ')}` });
    }
    const { pool, mapRow } = require('./db');
    const { logAudit } = require('./services/auditService');
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const targetUser = mapRow(userRes.rows[0]);

    const updateRes = await pool.query(`
      UPDATE users
      SET role = $1::varchar,
          status = CASE WHEN $1::text = 'admin' THEN 'active' ELSE status END,
          verified = CASE WHEN $1::text = 'admin' THEN true ELSE verified END,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [role, req.params.id]);

    const updated = mapRow(updateRes.rows[0]);
    await logAudit({
      adminId: req.user.id,
      action: 'change_role',
      targetUserId: targetUser.id,
      details: { previousRole: targetUser.role, newRole: role, name: targetUser.name, email: targetUser.email }
    });

    const { password: _, ...userSafe } = updated;
    res.json({ success: true, message: `User role updated to ${role}`, user: userSafe });
  } catch (err) {
    console.error('[ADMIN CHANGE ROLE] Error:', err.message);
    res.status(500).json({ error: 'Failed to change user role' });
  }
});

// Admin Remove / Delete User
app.delete('/api/admin/users/:id', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const targetId = req.params.id;
    if (req.user.id === targetId) {
      return res.status(400).json({ error: 'Cannot delete your own administrator account' });
    }

    const { pool, mapRow } = require('./db');
    const { logAudit } = require('./services/auditService');

    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [targetId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = mapRow(userRes.rows[0]);

    // Clean up associated listings, requirements, activities and notifications
    await pool.query('DELETE FROM farm_activities WHERE farmer_id = $1', [targetId]).catch(() => {});
    await pool.query('DELETE FROM farmer_listings WHERE farmer_id = $1', [targetId]).catch(() => {});
    await pool.query('DELETE FROM buyer_requirements WHERE buyer_id = $1', [targetId]).catch(() => {});
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [targetId]).catch(() => {});
    await pool.query('DELETE FROM users WHERE id = $1', [targetId]);

    // Log deletion in audit trail
    await logAudit({
      adminId: req.user.id,
      action: 'USER_DELETE',
      targetUserId: targetId,
      details: {
        role: targetUser.role,
        name: targetUser.name,
        email: targetUser.email,
        phone: targetUser.phone
      }
    });

    res.json({ success: true, message: 'User removed successfully' });
  } catch (err) {
    console.error('[ADMIN DELETE USER] Error:', err.message);
    res.status(500).json({ error: 'Failed to delete user: ' + err.message });
  }
});

// Admin Bulk Approve Users
app.post('/api/admin/users/bulk-approve', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { userIds } = req.body || {};
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds array is required' });
    }
    const { pool, mapRow } = require('./db');
    const { logAudit } = require('./services/auditService');

    let approvedCount = 0;
    for (const id of userIds) {
      const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (userRes.rows.length === 0) continue;
      const targetUser = mapRow(userRes.rows[0]);

      await pool.query(`
        UPDATE users
        SET status = 'active', rejection_reason = NULL, verified = true, updated_at = NOW()
        WHERE id = $1
      `, [id]);

      await logAudit({
        adminId: req.user.id,
        action: 'USER_BULK_APPROVE',
        targetUserId: id,
        details: { role: targetUser.role, name: targetUser.name, email: targetUser.email, previousStatus: targetUser.status }
      });
      approvedCount++;
    }

    res.json({ success: true, message: `${approvedCount} users approved successfully`, approvedCount });
  } catch (err) {
    console.error('[ADMIN BULK APPROVE] Error:', err.message);
    res.status(500).json({ error: 'Failed to bulk approve users: ' + err.message });
  }
});

// Admin Bulk Delete Users
app.post('/api/admin/users/bulk-delete', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { userIds } = req.body || {};
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds array is required' });
    }
    const { pool, mapRow } = require('./db');
    const { logAudit } = require('./services/auditService');

    // Never delete own admin account
    const safeIds = userIds.filter(id => id !== req.user.id);
    let deletedCount = 0;

    for (const targetId of safeIds) {
      const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [targetId]);
      if (userRes.rows.length === 0) continue;
      const targetUser = mapRow(userRes.rows[0]);

      // Clean up relations
      await pool.query('DELETE FROM farm_activities WHERE farmer_id = $1', [targetId]).catch(() => {});
      await pool.query('DELETE FROM farmer_listings WHERE farmer_id = $1', [targetId]).catch(() => {});
      await pool.query('DELETE FROM buyer_requirements WHERE buyer_id = $1', [targetId]).catch(() => {});
      await pool.query('DELETE FROM marketplace_deals WHERE farmer_id = $1 OR buyer_id = $1', [targetId]).catch(() => {});
      await pool.query('DELETE FROM marketplace_offers WHERE farmer_id = $1 OR buyer_id = $1', [targetId]).catch(() => {});
      await pool.query('DELETE FROM notifications WHERE user_id = $1', [targetId]).catch(() => {});
      await pool.query('DELETE FROM users WHERE id = $1', [targetId]);

      await logAudit({
        adminId: req.user.id,
        action: 'USER_BULK_DELETE',
        targetUserId: targetId,
        details: {
          role: targetUser.role,
          name: targetUser.name,
          email: targetUser.email,
          phone: targetUser.phone
        }
      });
      deletedCount++;
    }

    res.json({ success: true, message: `${deletedCount} users removed successfully`, deletedCount });
  } catch (err) {
    console.error('[ADMIN BULK DELETE] Error:', err.message);
    res.status(500).json({ error: 'Failed to bulk delete users: ' + err.message });
  }
});

// Configure Subscription Plans
app.get('/api/admin/plans', authMiddleware, requireRole(['admin']), async (req, res) => {
  const plans = await db.find('subscriptionPlans');
  res.json(plans);
});

app.put('/api/admin/plans/:id', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { logAudit } = require('./services/auditService');
    const updated = await db.updateById('subscriptionPlans', req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Plan not found' });

    await logAudit({
      adminId: req.user.id,
      action: 'plan_edit',
      targetUserId: null,
      details: { planId: req.params.id, updates: req.body }
    });

    res.json(updated);
  } catch (err) {
    console.error('[ADMIN PLAN EDIT] Error:', err.message);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// Audit Log Viewer endpoint
app.get('/api/admin/audit-logs', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { pool, mapRow } = require('./db');
    const { action, limit = 50, offset = 0 } = req.query;
    const query = `
      SELECT a.*,
             u_admin.name AS admin_name, u_admin.email AS admin_email,
             u_target.name AS target_user_name, u_target.email AS target_user_email, u_target.role AS target_user_role
      FROM audit_log a
      LEFT JOIN users u_admin ON a.admin_id = u_admin.id
      LEFT JOIN users u_target ON a.target_user_id = u_target.id
      WHERE ($1::varchar IS NULL OR a.action = $1)
      ORDER BY a.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [action || null, Math.min(Number(limit) || 50, 200), Number(offset) || 0]);
    res.json(result.rows.map(mapRow));
  } catch (err) {
    console.error('[ADMIN AUDIT LOGS] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Reset demo database to initial clean state (Gated behind DEMO_MODE=true; requires confirmation)
app.post('/api/admin/reset-demo', authMiddleware, requireRole(['admin']), async (req, res) => {
  if (process.env.DEMO_MODE !== 'true') {
    return res.status(403).json({ 
      error: 'DEMO_RESET_DISABLED', 
      message: 'Database reset is available only when DEMO_MODE=true.' 
    });
  }

  const { confirm } = req.body;
  if (confirm !== 'RESET_DEMO') {
    return res.status(400).json({ 
      error: 'CONFIRMATION_REQUIRED', 
      message: 'Explicit confirmation field { confirm: "RESET_DEMO" } is required to reset demo database.' 
    });
  }

  const { logAudit } = require('./services/auditService');
  await db.reset();
  await logAudit({
    adminId: req.user.id,
    action: 'reset_demo',
    targetUserId: null,
    details: { timestamp: new Date().toISOString() }
  });

  res.json({ message: 'Database reset to default seed data successfully.' });
});

// ---------------------------------------------
// 15. NOTIFICATIONS
// ---------------------------------------------

app.get('/api/notifications', authMiddleware, async (req, res) => {
  const notifs = await db.find('notifications', n => n.userId === req.user.id || n.userId === 'all');
  res.json(notifs);
});

app.put('/api/notifications/:id/read', authMiddleware, async (req, res) => {
  const updated = await db.updateById('notifications', req.params.id, { read: true });
  res.json(updated);
});

// ---------------------------------------------
// 16. REVIEWS & TRUST
// ---------------------------------------------

app.get('/api/reviews', async (req, res) => {
  const { targetUserId } = req.query;
  let reviews = await db.find('reviews');
  if (targetUserId) {
    reviews = reviews.filter(r => r.targetUserId === targetUserId);
  }
  res.json(reviews);
});

app.post('/api/reviews', authMiddleware, async (req, res) => {
  const { targetUserId, orderId, rating, comment } = req.body;
  if (!targetUserId || !rating) {
    return res.status(400).json({ error: 'Missing required review fields' });
  }

  const newReview = {
    id: `rev-${Date.now()}`,
    targetUserId,
    reviewerId: req.user.id,
    reviewerName: req.user.name,
    reviewerRole: req.user.role,
    orderId: orderId || null,
    rating: Number(rating),
    comment: comment || '',
    date: new Date().toISOString().split('T')[0]
  };

  await db.insert('reviews', newReview);
  res.status(201).json(newReview);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'KisanConnect API Server',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Public configuration endpoint
app.get('/api/config', (req, res) => {
  res.json({
    demoMode: process.env.DEMO_MODE === 'true'
  });
});

// Base API endpoint
app.get('/api', (req, res) => {
  res.json({
    status: 'OK',
    service: 'KisanConnect API Server',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

process.on('unhandledRejection', (reason) => {
  console.warn('[SERVER] Handled unhandledRejection:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.warn('[SERVER] Handled uncaughtException:', err?.message || err);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 KisanConnect API Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
