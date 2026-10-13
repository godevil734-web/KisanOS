// backend/services/kisanPointsService.js
// Server-side Idempotent Kisan Points Ledger & Evidence-Backed Trust Engine
const { pool, mapRow } = require('../db');

/**
 * Configurable Points Rules
 * Single source of truth for gamification / farmer engagement ledger.
 */
const POINTS_RULES = {
  PROFILE_COMPLETED: {
    points: 10,
    description: 'Profile completed with personal, village, and farm location details',
    type: 'profile'
  },
  FIELD_ADDED: {
    points: 20,
    description: 'Registered a farm field with verified acreage and irrigation details',
    type: 'field'
  },
  CROP_RECORD_ADDED: {
    points: 10,
    description: 'Logged an active crop cultivation record linked to a registered field',
    type: 'crop_record'
  },
  FIRST_SALE_COMPLETED: {
    points: 50,
    description: 'First verified commercial crop sale successfully delivered and completed',
    type: 'order'
  },
  SALE_COMPLETED: {
    points: 20,
    description: 'Verified crop sale successfully fulfilled through platform escrow',
    type: 'order'
  },
  ON_TIME_FULFILLMENT: {
    points: 10,
    description: 'Order fulfilled on or before the committed delivery date',
    type: 'order'
  }
};

/**
 * Idempotently award points to a user.
 * If the (userId, reason, referenceId) pair has already been recorded, no duplicate points are awarded.
 */
async function awardPoints(userId, reasonKey, referenceId = null, customDescription = null) {
  if (!userId || !reasonKey) {
    throw new Error('userId and reasonKey are required to award points.');
  }

  const rule = POINTS_RULES[reasonKey];
  if (!rule) {
    throw new Error(`Unknown points rule: ${reasonKey}`);
  }

  const refId = referenceId ? String(referenceId) : 'DEFAULT';
  const desc = customDescription || rule.description;
  const refType = rule.type;
  const entryId = `pt-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  try {
    const insertRes = await pool.query(`
      INSERT INTO kisan_points_ledger (id, user_id, points, reason, reference_id, reference_type, description, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (user_id, reason, reference_id) DO NOTHING
      RETURNING *
    `, [entryId, userId, rule.points, reasonKey, refId, refType, desc]);

    if (insertRes.rows.length === 0) {
      // Idempotency check: Already awarded
      const currentBal = await getPointsBalance(userId);
      return {
        awarded: false,
        alreadyAwarded: true,
        pointsAwarded: 0,
        balance: currentBal,
        reason: reasonKey
      };
    }

    const currentBal = await getPointsBalance(userId);
    return {
      awarded: true,
      alreadyAwarded: false,
      pointsAwarded: rule.points,
      balance: currentBal,
      reason: reasonKey,
      entry: mapRow(insertRes.rows[0])
    };
  } catch (err) {
    console.error(`[KisanPoints] Error awarding points to ${userId}:`, err.message);
    throw err;
  }
}

/**
 * Get current verified points balance for user
 */
async function getPointsBalance(userId) {
  if (!userId) return 0;
  const res = await pool.query(`
    SELECT COALESCE(SUM(points), 0)::integer as balance
    FROM kisan_points_ledger
    WHERE user_id = $1
  `, [userId]);
  return res.rows.length > 0 ? Number(res.rows[0].balance) : 0;
}

/**
 * Get chronological ledger statement for user
 */
async function getPointsLedger(userId) {
  if (!userId) return [];
  const res = await pool.query(`
    SELECT *
    FROM kisan_points_ledger
    WHERE user_id = $1
    ORDER BY created_at DESC
  `, [userId]);
  return res.rows.map(mapRow);
}

/**
 * Evaluate and award sale completion points when an order completes.
 * Called only from verified order advancement workflow.
 */
async function checkAndAwardSalePoints(orderId) {
  if (!orderId) return null;
  const orderRes = await pool.query(`
    SELECT * FROM orders WHERE id = $1 LIMIT 1
  `, [orderId]);

  if (orderRes.rows.length === 0) return null;
  const order = mapRow(orderRes.rows[0]);

  if (order.status !== 'COMPLETED') {
    return { awarded: false, reason: 'Order is not in COMPLETED status' };
  }

  const sellerId = order.sellerId;
  if (!sellerId) return null;

  // Check how many completed sales this seller had prior to or including this order
  const completedSalesRes = await pool.query(`
    SELECT id FROM orders 
    WHERE seller_id = $1 AND status = 'COMPLETED'
    ORDER BY created_at ASC
  `, [sellerId]);

  const completedList = completedSalesRes.rows;
  const isFirstSale = completedList.length > 0 && completedList[0].id === order.id;

  let mainSaleAward;
  if (isFirstSale) {
    mainSaleAward = await awardPoints(
      sellerId,
      'FIRST_SALE_COMPLETED',
      order.id,
      `Milestone: First verified crop sale completed for Order #${order.orderNumber || order.id}`
    );
  } else {
    mainSaleAward = await awardPoints(
      sellerId,
      'SALE_COMPLETED',
      order.id,
      `Verified crop sale completed for Order #${order.orderNumber || order.id}`
    );
  }

  // Check for on-time fulfillment bonus
  let onTimeAward = null;
  if (order.estimatedDeliveryDate) {
    const estDate = new Date(order.estimatedDeliveryDate);
    const completedTimeline = (order.timeline || []).find(t => t.status === 'COMPLETED' || t.status === 'DELIVERED');
    const compDate = completedTimeline ? new Date(completedTimeline.timestamp) : new Date();

    if (compDate <= estDate) {
      onTimeAward = await awardPoints(
        sellerId,
        'ON_TIME_FULFILLMENT',
        order.id,
        `On-time fulfillment bonus for Order #${order.orderNumber || order.id}`
      );
    }
  }

  return {
    sellerId,
    orderId: order.id,
    mainSaleAward,
    onTimeAward
  };
}

/**
 * Calculate evidence-backed Farmer Trust Metrics
 * Note: Kept strictly SEPARATE from Kisan Points.
 * Trust is derived strictly from real transaction fulfillment and verified identity.
 */
async function calculateFarmerTrust(userId) {
  if (!userId) return null;

  const [userRes, ordersRes, reviewsRes] = await Promise.all([
    pool.query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [userId]),
    pool.query(`SELECT * FROM orders WHERE seller_id = $1`, [userId]),
    pool.query(`SELECT rating FROM reviews WHERE target_user_id = $1`, [userId])
  ]);

  if (userRes.rows.length === 0) return null;
  const user = mapRow(userRes.rows[0]);

  const orders = ordersRes.rows.map(mapRow);
  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.status === 'COMPLETED').length;
  const cancelledOrders = orders.filter(o => o.status === 'CANCELLED').length;
  const fulfillmentRate = totalOrders > 0 
    ? Math.round((completedOrders / totalOrders) * 100) 
    : 100;

  const totalQuantitySoldTons = orders
    .filter(o => o.status === 'COMPLETED')
    .reduce((sum, o) => sum + (Number(o.quantityTons) || 0), 0);

  const reviews = reviewsRes.rows;
  const averageRating = reviews.length > 0 
    ? Number((reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length).toFixed(1))
    : (user.rating ? Number(user.rating) : 5.0);

  const isPhoneVerified = Boolean(user.phoneVerified);
  const isEmailVerified = Boolean(user.emailVerified);
  const isAdminVerified = Boolean(user.verified);

  // Trust Score calculation (0 - 100)
  // Identity: up to 25 pts (Phone: 10, Email: 5, Admin KYC: 10)
  // Fulfillment: up to 45 pts (Fulfillment rate % * 0.45)
  // Ratings: up to 20 pts (Rating / 5.0 * 20)
  // Track Record Volume: up to 10 pts (min(completedOrders * 2, 10))
  let trustScore = 20; // baseline for registered account
  if (isPhoneVerified) trustScore += 10;
  if (isEmailVerified) trustScore += 5;
  if (isAdminVerified) trustScore += 10;
  
  if (totalOrders > 0) {
    trustScore += Math.round((fulfillmentRate / 100) * 35);
    trustScore += Math.min(completedOrders * 3, 10);
  } else {
    // New seller with no order defaults to baseline
    trustScore += 10;
  }
  trustScore += Math.round((averageRating / 5) * 10);
  trustScore = Math.min(Math.max(trustScore, 10), 100);

  let trustTier = 'NEW_MEMBER';
  let trustBadge = 'Registered Member';
  if (completedOrders >= 5 && fulfillmentRate >= 85 && (isPhoneVerified || isAdminVerified)) {
    trustTier = 'GOLD_PRODUCER';
    trustBadge = 'Gold Verified Producer';
  } else if (completedOrders >= 1 && (isPhoneVerified || isEmailVerified || isAdminVerified)) {
    trustTier = 'VERIFIED_FARMER';
    trustBadge = 'Active Verified Farmer';
  } else if (isAdminVerified || isPhoneVerified || isEmailVerified) {
    trustTier = 'VERIFIED_IDENTITY';
    trustBadge = 'Identity Verified';
  }

  return {
    trustScore,
    trustTier,
    trustBadge,
    completedOrders,
    totalOrders,
    cancelledOrders,
    fulfillmentRate,
    totalQuantitySoldTons: Number(totalQuantitySoldTons.toFixed(2)),
    averageRating,
    reviewsCount: reviews.length || user.reviewsCount || 0,
    identityVerification: {
      phoneVerified: isPhoneVerified,
      emailVerified: isEmailVerified,
      adminKycVerified: isAdminVerified,
      verifiedAt: user.updatedAt || user.createdAt
    }
  };
}

module.exports = {
  POINTS_RULES,
  awardPoints,
  getPointsBalance,
  getPointsLedger,
  checkAndAwardSalePoints,
  calculateFarmerTrust
};
