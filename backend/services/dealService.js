/**
 * backend/services/dealService.js
 * Complete Offer -> Negotiation / Counter -> Acceptance -> Deal Engine
 * 
 * CORE PRINCIPLE:
 * Deterministic Backend = Single Source of Truth.
 * Database transactions enforce atomic execution, quantity consistency,
 * duplicate acceptance prevention, and audit trail logging.
 */

const { pool, mapRow } = require('../db');
const { logAudit } = require('./auditService');

/**
 * 1. Create a new Offer
 * Can be initiated by Farmer (to Buyer) or Buyer (to Farmer).
 */
async function createOffer({ user, offerData }) {
  const {
    buyerId,
    buyerName,
    requirementId,
    listingId,
    sellerId,
    sellerName,
    cropName,
    variety,
    quantityTons,
    offeredPricePerKg,
    deliveryTerms,
    message
  } = offerData;

  const qty = Number(quantityTons);
  const price = Number(offeredPricePerKg);

  if (!qty || qty <= 0) {
    throw new Error('Valid quantity in tons is required');
  }
  if (!price || price <= 0) {
    throw new Error('Valid price per kg is required');
  }

  // Determine roles
  const isFarmer = user.role === 'farmer' || user.role === 'aggregator';
  const effectiveSellerId = isFarmer ? user.id : (sellerId || 'usr-farmer-a');
  const effectiveSellerName = isFarmer ? user.name : (sellerName || 'Farmer');
  const effectiveBuyerId = isFarmer ? buyerId : user.id;
  const effectiveBuyerName = isFarmer ? (buyerName || 'Buyer') : user.name;

  if (!effectiveBuyerId) {
    throw new Error('Buyer ID is required to make an offer');
  }

  // If farmer has an active listing, check quantity availability
  if (listingId) {
    const listRes = await pool.query('SELECT * FROM farmer_listings WHERE id = $1', [listingId]);
    if (listRes.rows.length > 0) {
      const listing = listRes.rows[0];
      const availableQty = Number(listing.quantity_tons || 0);
      if (qty > availableQty) {
        throw new Error(`इस फसल की केवल ${availableQty} टन मात्रा उपलब्ध है। (Only ${availableQty}T available)`);
      }
    }
  }

  const id = `off-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

  const insertSql = `
    INSERT INTO offers (
      id, requirement_id, listing_id, buyer_id, buyer_name,
      seller_id, seller_name, seller_role, crop_name, variety,
      quantity_tons, offered_price_per_kg, buyer_offered_price_per_kg,
      farmer_expected_price_per_kg, status, delivery_terms, message,
      is_demo, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13,
      $14, 'PENDING', $15, $16,
      true, NOW(), NOW()
    ) RETURNING *
  `;

  const values = [
    id,
    requirementId || null,
    listingId || null,
    effectiveBuyerId,
    effectiveBuyerName,
    effectiveSellerId,
    effectiveSellerName,
    user.role === 'aggregator' ? 'aggregator' : 'farmer',
    cropName || 'Potato',
    variety || 'Standard',
    qty,
    price,
    price,
    price,
    deliveryTerms || 'Farm Gate Pickup',
    message || 'Interested in fulfilling your requirements.'
  ];

  const res = await pool.query(insertSql, values);
  const createdOffer = mapRow(res.rows[0]);

  // Log audit
  await logAudit({
    actorId: user.id,
    actorRole: user.role,
    action: 'OFFER_CREATED',
    targetUserId: effectiveBuyerId,
    details: {
      offerId: id,
      cropName,
      quantityTons: qty,
      offeredPricePerKg: price,
      listingId,
      requirementId
    }
  });

  // Notify recipient
  const targetId = isFarmer ? effectiveBuyerId : effectiveSellerId;
  const notifId = `notif-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  await pool.query(`
    INSERT INTO notifications (id, user_id, title, message, type, read, timestamp)
    VALUES ($1, $2, $3, $4, 'OFFER', false, NOW())
  `, [
    notifId,
    targetId,
    `New Offer for ${qty}T ${cropName || 'Produce'}`,
    `${user.name} sent an offer of ₹${price}/kg for ${qty}T.`
  ]);

  return createdOffer;
}

/**
 * 2. Accept an Offer (ATOMIC DEAL CREATION)
 * Enforces transaction isolation, duplicate prevention, and inventory consistency.
 */
async function acceptOffer({ user, offerId }) {
  if (!offerId) throw new Error('Offer ID is required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock offer row for update to prevent concurrent duplicate acceptance
    const offerRes = await client.query('SELECT * FROM offers WHERE id = $1 FOR UPDATE', [offerId]);
    if (offerRes.rows.length === 0) {
      throw new Error('Offer not found');
    }

    const offer = offerRes.rows[0];

    // Status check
    if (offer.status === 'ACCEPTED') {
      throw new Error('Offer already accepted.');
    }
    if (offer.status === 'REJECTED' || offer.status === 'CANCELLED') {
      throw new Error(`Cannot accept an offer with status ${offer.status}.`);
    }

    // Duplicate deal check: Has a deal already been generated for this offer?
    const existingOrderRes = await client.query('SELECT id, order_number FROM orders WHERE offer_id = $1', [offerId]);
    if (existingOrderRes.rows.length > 0) {
      throw new Error('Deal already exists for this offer.');
    }

    // Authorization verification
    // When PENDING: The recipient accepts (buyer accepts farmer offer, or farmer accepts buyer offer)
    // When COUNTERED: The other party who didn't send the counter accepts
    const currentStatus = offer.status;
    const isBuyer = user.id === offer.buyer_id;
    const isSeller = user.id === offer.seller_id;
    const isAdmin = user.role === 'admin';

    if (!isAdmin && !isBuyer && !isSeller) {
      throw new Error('Unauthorized: You are not a party to this offer.');
    }

    if (!isAdmin) {
      if (currentStatus === 'PENDING') {
        // If farmer sent the offer, buyer must accept. If buyer sent, farmer must accept.
        const sellerSent = offer.seller_role === 'farmer' || offer.seller_role === 'aggregator';
        if (sellerSent && !isBuyer) {
          throw new Error('A farmer cannot accept their own pending offer. Waiting for buyer acceptance.');
        }
      } else if (currentStatus === 'COUNTERED') {
        // The party who was countered accepts
        if (offer.counter_by === 'buyer' && !isSeller) {
          throw new Error('Only the seller can accept the buyer counter-offer.');
        }
        if (offer.counter_by === 'farmer' && !isBuyer) {
          throw new Error('Only the buyer can accept the farmer counter-offer.');
        }
      }
    }

    // Determine agreed terms
    const agreedQuantityTons = Number(
      (currentStatus === 'COUNTERED' && offer.counter_quantity_tons) 
        ? offer.counter_quantity_tons 
        : offer.quantity_tons
    );
    const agreedPricePerKg = Number(
      (currentStatus === 'COUNTERED' && offer.counter_price_per_kg) 
        ? offer.counter_price_per_kg 
        : (offer.offered_price_per_kg || offer.buyer_offered_price_per_kg || offer.farmer_expected_price_per_kg)
    );

    // 1. Listing Quantity Consistency Check
    if (offer.listing_id) {
      const listRes = await client.query('SELECT * FROM farmer_listings WHERE id = $1 FOR UPDATE', [offer.listing_id]);
      if (listRes.rows.length > 0) {
        const listing = listRes.rows[0];
        const currentListingQty = Number(listing.quantity_tons || 0);

        if (currentListingQty < agreedQuantityTons) {
          throw new Error('इस फसल की पर्याप्त मात्रा अब उपलब्ध नहीं है. (Insufficient crop quantity available for this listing)');
        }

        const remainingQty = Math.max(0, currentListingQty - agreedQuantityTons);
        const newListingStatus = remainingQty <= 0 ? 'SOLD' : (listing.status || 'ACTIVE');

        await client.query(`
          UPDATE farmer_listings
          SET quantity_tons = $1, quantity_kg = $2, status = $3, updated_at = NOW()
          WHERE id = $4
        `, [remainingQty, remainingQty * 1000, newListingStatus, offer.listing_id]);
      }
    }

    // 2. Buyer Requirement Consistency Check
    if (offer.requirement_id) {
      const reqRes = await client.query('SELECT * FROM buyer_requirements WHERE id = $1 FOR UPDATE', [offer.requirement_id]);
      if (reqRes.rows.length > 0) {
        const req = reqRes.rows[0];
        const currentReqQty = Number(req.quantity_tons || 0);
        const remainingReqQty = Math.max(0, currentReqQty - agreedQuantityTons);
        const newReqStatus = remainingReqQty <= 0 ? 'FULFILLED' : (req.status || 'OPEN');

        await client.query(`
          UPDATE buyer_requirements
          SET quantity_tons = $1, required_quantity_kg = $2, status = $3, updated_at = NOW()
          WHERE id = $4
        `, [remainingReqQty, remainingReqQty * 1000, newReqStatus, offer.requirement_id]);
      }
    }

    // 3. Create confirmed Deal / Order
    const dealId = `ord-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const orderNumber = `KC-DEAL-${Math.floor(1000 + Math.random() * 9000)}`;
    const produceTotal = Math.round(agreedQuantityTons * 1000 * agreedPricePerKg);
    const platformFee = Math.round(produceTotal * 0.02); // 2% platform fee
    const logisticsCost = 0; // Farm-gate / Direct
    const totalAmount = produceTotal + platformFee + logisticsCost;

    const insertOrderSql = `
      INSERT INTO orders (
        id, order_number, offer_id, listing_id, requirement_id,
        buyer_id, buyer_name, seller_type, seller_id, seller_name,
        crop_name, variety, quantity_tons, unit_price_per_kg, agreed_price_per_kg,
        produce_total, logistics_cost, platform_fee, total_amount,
        pickup_location, delivery_location, status, payment_status,
        timeline, is_demo, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, 'ACTIVE', 'ESCROW_LOCKED',
        $22, true, NOW(), NOW()
      ) RETURNING *
    `;

    const timeline = JSON.stringify([
      { status: 'OFFER_ACCEPTED', note: `Offer accepted by ${user.name}`, timestamp: new Date().toISOString() },
      { status: 'DEAL_ACTIVE', note: 'Deal activated with agreed pricing in escrow', timestamp: new Date().toISOString() }
    ]);

    const orderValues = [
      dealId,
      orderNumber,
      offerId,
      offer.listing_id || null,
      offer.requirement_id || null,
      offer.buyer_id,
      offer.buyer_name,
      (offer.seller_role || 'farmer').toUpperCase(),
      offer.seller_id,
      offer.seller_name,
      offer.crop_name,
      offer.variety,
      agreedQuantityTons,
      agreedPricePerKg,
      agreedPricePerKg,
      produceTotal,
      logisticsCost,
      platformFee,
      totalAmount,
      'Farm Gate Pickup',
      'Buyer Mandi / Processing Center',
      timeline
    ];

    const orderRes = await client.query(insertOrderSql, orderValues);
    const createdDeal = mapRow(orderRes.rows[0]);

    // 4. Update Offer status to ACCEPTED with deal_id link
    await client.query(`
      UPDATE offers
      SET status = 'ACCEPTED', deal_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [dealId, offerId]);

    // 5. Commit database transaction
    await client.query('COMMIT');

    // 6. Audit logs & notifications (outside transaction block)
    await logAudit({
      actorId: user.id,
      actorRole: user.role,
      action: 'OFFER_ACCEPTED',
      targetUserId: user.id === offer.buyer_id ? offer.seller_id : offer.buyer_id,
      details: { offerId, dealId, agreedQuantityTons, agreedPricePerKg, totalAmount }
    });

    await logAudit({
      actorId: user.id,
      actorRole: user.role,
      action: 'DEAL_CREATED',
      targetUserId: null,
      details: { dealId, orderNumber, offerId, buyerId: offer.buyer_id, sellerId: offer.seller_id }
    });

    // Notify Buyer
    await pool.query(`
      INSERT INTO notifications (id, user_id, title, message, type, read, timestamp)
      VALUES ($1, $2, $3, $4, 'ORDER', false, NOW())
    `, [
      `notif-b-${Date.now()}`,
      offer.buyer_id,
      `Deal ${orderNumber} Confirmed!`,
      `Deal for ${agreedQuantityTons}T ${offer.crop_name} is active at ₹${agreedPricePerKg}/kg.`
    ]);

    // Notify Farmer
    await pool.query(`
      INSERT INTO notifications (id, user_id, title, message, type, read, timestamp)
      VALUES ($1, $2, $3, $4, 'ORDER', false, NOW())
    `, [
      `notif-s-${Date.now()}`,
      offer.seller_id,
      `Deal ${orderNumber} Confirmed!`,
      `Your offer for ${agreedQuantityTons}T ${offer.crop_name} was accepted at ₹${agreedPricePerKg}/kg!`
    ]);

    return {
      success: true,
      deal: createdDeal,
      offerId,
      dealId
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 3. Counter an Offer
 */
async function counterOffer({ user, offerId, counterPricePerKg, counterQuantityTons, message }) {
  if (!offerId) throw new Error('Offer ID is required');

  const price = Number(counterPricePerKg);
  const qty = Number(counterQuantityTons);

  if (!price || price <= 0) throw new Error('Valid counter price per kg is required');
  if (!qty || qty <= 0) throw new Error('Valid counter quantity in tons is required');

  const offerRes = await pool.query('SELECT * FROM offers WHERE id = $1', [offerId]);
  if (offerRes.rows.length === 0) throw new Error('Offer not found');

  const offer = offerRes.rows[0];
  if (offer.status !== 'PENDING' && offer.status !== 'COUNTERED') {
    throw new Error(`Cannot counter an offer with status ${offer.status}`);
  }

  // Authorization: Only parties to the offer can counter
  const isBuyer = user.id === offer.buyer_id;
  const isSeller = user.id === offer.seller_id;
  const isAdmin = user.role === 'admin';

  if (!isAdmin && !isBuyer && !isSeller) {
    throw new Error('Unauthorized to counter this offer');
  }

  // If farmer has listing, verify counter quantity does not exceed available crop
  if (offer.listing_id) {
    const listRes = await pool.query('SELECT * FROM farmer_listings WHERE id = $1', [offer.listing_id]);
    if (listRes.rows.length > 0) {
      const avail = Number(listRes.rows[0].quantity_tons || 0);
      if (qty > avail) {
        throw new Error(`Counter quantity (${qty}T) exceeds farmer available stock (${avail}T)`);
      }
    }
  }

  const counterByRole = isBuyer ? 'buyer' : 'farmer';

  const updateSql = `
    UPDATE offers
    SET status = 'COUNTERED',
        counter_price_per_kg = $1,
        counter_quantity_tons = $2,
        counter_message = $3,
        counter_by = $4,
        updated_at = NOW()
    WHERE id = $5
    RETURNING *
  `;

  const res = await pool.query(updateSql, [price, qty, message || 'Counter offer proposed', counterByRole, offerId]);
  const updatedOffer = mapRow(res.rows[0]);

  // Log audit
  await logAudit({
    actorId: user.id,
    actorRole: user.role,
    action: 'OFFER_COUNTERED',
    targetUserId: isBuyer ? offer.seller_id : offer.buyer_id,
    details: { offerId, counterPricePerKg: price, counterQuantityTons: qty, counterByRole }
  });

  // Notify recipient
  const recipientId = isBuyer ? offer.seller_id : offer.buyer_id;
  await pool.query(`
    INSERT INTO notifications (id, user_id, title, message, type, read, timestamp)
    VALUES ($1, $2, $3, $4, 'OFFER', false, NOW())
  `, [
    `notif-c-${Date.now()}`,
    recipientId,
    `Counter Offer from ${user.name}`,
    `Counter proposed: ₹${price}/kg for ${qty}T ${offer.crop_name}.`
  ]);

  return updatedOffer;
}

/**
 * 4. Reject an Offer
 */
async function rejectOffer({ user, offerId, reason }) {
  if (!offerId) throw new Error('Offer ID is required');

  const offerRes = await pool.query('SELECT * FROM offers WHERE id = $1', [offerId]);
  if (offerRes.rows.length === 0) throw new Error('Offer not found');

  const offer = offerRes.rows[0];
  if (offer.status === 'ACCEPTED') {
    throw new Error('Cannot reject an already accepted offer.');
  }

  const isBuyer = user.id === offer.buyer_id;
  const isSeller = user.id === offer.seller_id;
  const isAdmin = user.role === 'admin';

  if (!isAdmin && !isBuyer && !isSeller) {
    throw new Error('Unauthorized to reject this offer');
  }

  const updateSql = `
    UPDATE offers
    SET status = 'REJECTED',
        counter_message = $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;

  const res = await pool.query(updateSql, [reason || 'Offer declined', offerId]);
  const updatedOffer = mapRow(res.rows[0]);

  // Log audit
  await logAudit({
    actorId: user.id,
    actorRole: user.role,
    action: 'OFFER_REJECTED',
    targetUserId: isBuyer ? offer.seller_id : offer.buyer_id,
    details: { offerId, reason }
  });

  // Notify other party
  const recipientId = isBuyer ? offer.seller_id : offer.buyer_id;
  await pool.query(`
    INSERT INTO notifications (id, user_id, title, message, type, read, timestamp)
    VALUES ($1, $2, $3, $4, 'OFFER', false, NOW())
  `, [
    `notif-r-${Date.now()}`,
    recipientId,
    `Offer for ${offer.crop_name} Declined`,
    `${user.name} has declined the offer.`
  ]);

  return updatedOffer;
}

/**
 * 5. Get Deals for User
 */
async function getDealsForUser({ user }) {
  let sql = 'SELECT * FROM orders';
  let values = [];

  if (user.role === 'farmer' || user.role === 'aggregator') {
    sql += ' WHERE seller_id = $1 ORDER BY created_at DESC';
    values = [user.id];
  } else if (user.role === 'buyer' || user.role === 'dealer') {
    sql += ' WHERE buyer_id = $1 ORDER BY created_at DESC';
    values = [user.id];
  } else if (user.role === 'transporter') {
    sql += " WHERE transporter_id = 'trp-601' ORDER BY created_at DESC";
  } else {
    // Admin sees all
    sql += ' ORDER BY created_at DESC';
  }

  const res = await pool.query(sql, values);
  return res.rows.map(mapRow);
}

/**
 * 6. Get Deal By ID
 */
async function getDealById({ user, dealId }) {
  const res = await pool.query('SELECT * FROM orders WHERE id = $1', [dealId]);
  if (res.rows.length === 0) return null;
  const deal = mapRow(res.rows[0]);
  if (user.role !== 'admin' && user.id !== deal.buyerId && user.id !== deal.sellerId) {
    throw new Error('Unauthorized to view this deal');
  }
  return deal;
}

/**
 * 7. Get Sent Offers
 */
async function getSentOffers({ user }) {
  let sql;
  let values;
  if (user.role === 'farmer' || user.role === 'aggregator') {
    sql = 'SELECT * FROM offers WHERE seller_id = $1 ORDER BY created_at DESC';
    values = [user.id];
  } else if (user.role === 'buyer' || user.role === 'dealer') {
    sql = 'SELECT * FROM offers WHERE buyer_id = $1 ORDER BY created_at DESC';
    values = [user.id];
  } else {
    sql = 'SELECT * FROM offers ORDER BY created_at DESC';
    values = [];
  }
  const res = await pool.query(sql, values);
  return res.rows.map(mapRow);
}

/**
 * 8. Get Incoming Offers
 */
async function getIncomingOffers({ user }) {
  let sql;
  let values;
  if (user.role === 'buyer' || user.role === 'dealer') {
    sql = 'SELECT * FROM offers WHERE buyer_id = $1 ORDER BY created_at DESC';
    values = [user.id];
  } else if (user.role === 'farmer' || user.role === 'aggregator') {
    sql = 'SELECT * FROM offers WHERE seller_id = $1 ORDER BY created_at DESC';
    values = [user.id];
  } else {
    sql = 'SELECT * FROM offers ORDER BY created_at DESC';
    values = [];
  }
  const res = await pool.query(sql, values);
  return res.rows.map(mapRow);
}

module.exports = {
  createOffer,
  acceptOffer,
  counterOffer,
  rejectOffer,
  getDealsForUser,
  getDealById,
  getSentOffers,
  getIncomingOffers
};
