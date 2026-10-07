/**
 * backend/services/dealService.js
 * Complete Two-Way Farmer <-> Buyer Marketplace Engine
 * 
 * CORE PRINCIPLES:
 * 1. LISTING ≠ OFFER ≠ CONFIRMED DEAL
 * 2. Farmer listing = Available supply.
 * 3. Offer = Reserved / On Hold supply (not purchased yet).
 * 4. Only final acceptance by BOTH Farmer and Buyer converts offer to Confirmed Deal.
 * 5. Rejection releases reserved supply back to Available.
 * 6. Negotiation changes reserved quantity based on the latest counter-offer.
 * 7. Buyer procurement requirement tracks confirmed procurement and remains open until confirmed.
 */

const { pool, mapRow } = require('../db');
const { logAudit } = require('./auditService');

/**
 * Synchronize farmer listing inventory states:
 * AVAILABLE = quantity_tons - reserved_quantity_tons - confirmed_quantity_tons
 * RESERVED = sum of active (PENDING or COUNTERED) offers
 * CONFIRMED = sum of accepted deals
 */
async function syncListingQuantities(listingId, client = pool) {
  if (!listingId) return null;
  try {
    const listRes = await client.query('SELECT * FROM farmer_listings WHERE id = $1', [listingId]);
    if (listRes.rows.length === 0) return null;
    const listing = listRes.rows[0];
    const totalQty = Number(listing.quantity_tons || 0);

    // Active offers for this listing
    const offersRes = await client.query(`
      SELECT status, quantity_tons, counter_quantity_tons 
      FROM offers 
      WHERE listing_id = $1
    `, [listingId]);

    let reservedTons = 0;
    let confirmedTons = 0;

    for (const off of offersRes.rows) {
      const activeQty = Number(
        off.counter_quantity_tons ? off.counter_quantity_tons : (off.quantity_tons || 0)
      );

      if (off.status === 'PENDING' || off.status === 'COUNTERED') {
        reservedTons += activeQty;
      } else if (off.status === 'ACCEPTED') {
        confirmedTons += activeQty;
      }
    }

    reservedTons = Number(reservedTons.toFixed(2));
    confirmedTons = Number(confirmedTons.toFixed(2));
    const availableTons = Math.max(0, Number((totalQty - reservedTons - confirmedTons).toFixed(2)));

    let status = listing.status || 'ACTIVE';
    if (totalQty > 0) {
      if (availableTons <= 0 && reservedTons > 0) {
        status = 'RESERVED'; // Offer Pending / On Hold
      } else if (availableTons <= 0 && reservedTons <= 0 && confirmedTons > 0) {
        status = 'SOLD'; // Deal Confirmed / Sold
      } else if (availableTons > 0) {
        status = 'ACTIVE';
      }
    }

    await client.query(`
      UPDATE farmer_listings
      SET reserved_quantity_tons = $1,
          confirmed_quantity_tons = $2,
          status = $3,
          updated_at = NOW()
      WHERE id = $4
    `, [reservedTons, confirmedTons, status, listingId]);

    return {
      totalQty,
      totalQuantityTons: totalQty,
      availableTons,
      availableQuantityTons: availableTons,
      reservedTons,
      reservedQuantityTons: reservedTons,
      confirmedTons,
      confirmedQuantityTons: confirmedTons,
      status
    };
  } catch (err) {
    console.warn(`[SYNC LISTING] Error updating listing ${listingId}:`, err.message);
    return null;
  }
}

/**
 * Synchronize buyer requirement procurement states:
 * Target Requirement = quantity_tons
 * Confirmed Procurement = sum of accepted deals (from orders or accepted offers)
 * Requirement is FULFILLED only when Confirmed >= Target
 */
async function syncRequirementProcurement(requirementId, client = pool) {
  if (!requirementId) return null;
  try {
    const reqRes = await client.query('SELECT * FROM buyer_requirements WHERE id = $1', [requirementId]);
    if (reqRes.rows.length === 0) return null;
    const req = reqRes.rows[0];
    const targetQty = Number(req.quantity_tons || 0);

    // Sum confirmed deals from orders
    const ordersRes = await client.query(`
      SELECT quantity_tons FROM orders WHERE requirement_id = $1 AND status != 'CANCELLED'
    `, [requirementId]);

    let confirmedProcuredTons = ordersRes.rows.reduce((sum, r) => sum + Number(r.quantity_tons || 0), 0);

    // If no order rows, check accepted offers
    if (confirmedProcuredTons === 0) {
      const acceptedOffersRes = await client.query(`
        SELECT quantity_tons, counter_quantity_tons FROM offers 
        WHERE requirement_id = $1 AND status = 'ACCEPTED'
      `, [requirementId]);

      confirmedProcuredTons = acceptedOffersRes.rows.reduce((sum, off) => {
        const qty = Number(off.counter_quantity_tons || off.quantity_tons || 0);
        return sum + qty;
      }, 0);
    }

    confirmedProcuredTons = Number(confirmedProcuredTons.toFixed(2));
    const isFulfilled = targetQty > 0 && confirmedProcuredTons >= targetQty;
    const isPartial = confirmedProcuredTons > 0 && confirmedProcuredTons < targetQty;
    const status = isFulfilled ? 'FULFILLED' : (req.status || 'ACTIVE');

    await client.query(`
      UPDATE buyer_requirements
      SET confirmed_procured_tons = $1,
          status = $2,
          updated_at = NOW()
      WHERE id = $3
    `, [confirmedProcuredTons, status, requirementId]);

    const remainingTons = Math.max(0, Number((targetQty - confirmedProcuredTons).toFixed(2)));

    return {
      targetQty,
      targetQuantityTons: targetQty,
      confirmedProcuredTons,
      confirmedProcurementTons: confirmedProcuredTons,
      remainingTons,
      remainingRequirementTons: remainingTons,
      status
    };
  } catch (err) {
    console.warn(`[SYNC REQUIREMENT] Error updating requirement ${requirementId}:`, err.message);
    return null;
  }
}

/**
 * 1. Create a new Offer (Two-Way: Farmer -> Buyer or Buyer -> Farmer)
 */
async function createOffer(arg1, arg2) {
  let user, offerData;
  if (arg2) {
    offerData = arg1;
    user = arg2;
  } else if (arg1 && arg1.user) {
    user = arg1.user;
    offerData = arg1.offerData || arg1;
  } else {
    offerData = arg1 || {};
    user = {
      id: offerData.initiatorId || offerData.buyerId || offerData.sellerId,
      role: offerData.initiatorRole || (offerData.buyerId ? 'buyer' : 'farmer'),
      name: offerData.initiatorName || offerData.buyerName || offerData.sellerName || 'User'
    };
  }

  const {
    buyerId,
    buyerName,
    requirementId,
    listingId,
    sellerId,
    sellerName,
    sellerRole,
    cropName,
    variety,
    quantityTons,
    offeredPricePerKg,
    pickupTerms,
    deliveryTerms,
    targetDate,
    date,
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

  const isBuyerRole = user.role === 'buyer' || user.role === 'dealer';
  const isFarmerRole = user.role === 'farmer' || user.role === 'aggregator';

  const initiatorId = user.id;
  const initiatorRole = isBuyerRole ? 'buyer' : (user.role === 'aggregator' ? 'aggregator' : 'farmer');

  let effectiveBuyerId, effectiveBuyerName;
  let effectiveSellerId, effectiveSellerName;
  let effectiveSellerRole = sellerRole || 'farmer';
  let recipientId, recipientRole;

  if (isBuyerRole) {
    // Buyer -> Farmer (Direct Farm Offer)
    effectiveBuyerId = user.id;
    effectiveBuyerName = user.name;
    effectiveSellerId = sellerId || 'usr-farmer-a';
    effectiveSellerName = sellerName || 'Farmer';
    recipientId = effectiveSellerId;
    recipientRole = effectiveSellerRole;
  } else {
    // Farmer -> Buyer (Farmer initiates offer)
    effectiveSellerId = user.id;
    effectiveSellerName = user.name;
    effectiveSellerRole = user.role === 'aggregator' ? 'aggregator' : 'farmer';
    effectiveBuyerId = buyerId;
    effectiveBuyerName = buyerName || 'Buyer';
    recipientId = effectiveBuyerId;
    recipientRole = 'buyer';
  }

  if (!effectiveBuyerId || !effectiveSellerId) {
    throw new Error('Both Buyer and Seller must be identified for this offer');
  }

  // Double-booking check on Farmer Listing:
  if (listingId) {
    const listRes = await pool.query('SELECT * FROM farmer_listings WHERE id = $1', [listingId]);
    if (listRes.rows.length > 0) {
      const listing = listRes.rows[0];
      const totalListingQty = Number(listing.quantity_tons || 0);
      const reservedListingQty = Number(listing.reserved_quantity_tons || 0);
      const confirmedListingQty = Number(listing.confirmed_quantity_tons || 0);
      const currentlyAvailable = Math.max(0, Number((totalListingQty - reservedListingQty - confirmedListingQty).toFixed(2)));

      if (qty > currentlyAvailable) {
        throw new Error(`Only ${currentlyAvailable}T currently available. (इस फसल की केवल ${currentlyAvailable} टन मात्रा वर्तमान में उपलब्ध है)`);
      }
    }
  }

  const id = `off-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const effectiveTerms = pickupTerms || deliveryTerms || 'Farm Gate Pickup';
  const effectiveTargetDate = targetDate || date || null;

  // Initial negotiation history record
  const initialHistory = [
    {
      round: 1,
      action: 'OFFER_CREATED',
      senderId: user.id,
      senderRole: initiatorRole,
      senderName: user.name,
      quantityTons: qty,
      pricePerKg: price,
      pickupTerms: effectiveTerms,
      deliveryTerms: effectiveTerms,
      date: effectiveTargetDate,
      message: message || (isBuyerRole ? 'Direct Farm Offer' : 'Farmer Offer to Buyer'),
      createdAt: new Date().toISOString()
    }
  ];

  const insertSql = `
    INSERT INTO offers (
      id, requirement_id, listing_id,
      initiator_id, initiator_role, recipient_id, recipient_role,
      buyer_id, buyer_name, seller_id, seller_name, seller_role,
      crop_name, variety, quantity_tons, offered_price_per_kg,
      buyer_offered_price_per_kg, farmer_expected_price_per_kg,
      status, pickup_terms, delivery_terms, target_date, message,
      negotiation_history, last_action_by, last_action_role,
      is_demo, created_at, updated_at
    ) VALUES (
      $1, $2, $3,
      $4, $5, $6, $7,
      $8, $9, $10, $11, $12,
      $13, $14, $15, $16,
      $17, $18,
      'PENDING', $19, $20, $21, $22,
      $23, $24, $25,
      true, NOW(), NOW()
    ) RETURNING *
  `;

  const values = [
    id,
    requirementId || null,
    listingId || null,
    initiatorId,
    initiatorRole,
    recipientId,
    recipientRole,
    effectiveBuyerId,
    effectiveBuyerName,
    effectiveSellerId,
    effectiveSellerName,
    effectiveSellerRole,
    cropName || 'Produce',
    variety || 'Standard',
    qty,
    price,
    price,
    price,
    effectiveTerms,
    effectiveTerms,
    effectiveTargetDate,
    message || (isBuyerRole ? 'Direct Farm Offer' : 'Farmer Offer to Buyer'),
    JSON.stringify(initialHistory),
    user.id,
    initiatorRole
  ];

  const res = await pool.query(insertSql, values);
  const createdOffer = mapRow(res.rows[0]);
  if (createdOffer) {
    let hist = createdOffer.negotiationHistory || createdOffer.negotiation_history || [];
    if (typeof hist === 'string') {
      try { hist = JSON.parse(hist); } catch (e) { hist = []; }
    }
    createdOffer.negotiationHistory = hist;
    createdOffer.negotiation_history = hist;
  }

  // Synchronize listing inventory to mark quantity as RESERVED (On Hold)
  if (listingId) {
    await syncListingQuantities(listingId);
  }

  // Synchronize requirement procurement overview
  if (requirementId) {
    await syncRequirementProcurement(requirementId);
  }

  // Audit log
  await logAudit({
    actorId: user.id,
    actorRole: user.role,
    action: 'OFFER_CREATED',
    targetUserId: recipientId,
    details: {
      offerId: id,
      cropName,
      quantityTons: qty,
      offeredPricePerKg: price,
      listingId,
      requirementId,
      initiatorRole
    }
  });

  // Notify recipient
  const notifId = `notif-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  await pool.query(`
    INSERT INTO notifications (id, user_id, title, message, type, read, timestamp)
    VALUES ($1, $2, $3, $4, 'OFFER', false, NOW())
  `, [
    notifId,
    recipientId,
    `New Offer for ${qty}T ${cropName || 'Produce'}`,
    `${user.name} sent an offer of ₹${price}/kg for ${qty}T.`
  ]);

  return createdOffer;
}

/**
 * 2. Counter an Offer (Negotiation step)
 */
async function counterOffer(arg1, arg2, arg3) {
  let user, offerId, counterData;
  if (typeof arg1 === 'string') {
    offerId = arg1;
    counterData = arg2 || {};
    user = arg3 || {};
  } else {
    user = arg1.user;
    offerId = arg1.offerId;
    counterData = arg1;
  }

  if (!offerId) throw new Error('Offer ID is required');

  const { counterPricePerKg, counterQuantityTons, pickupTerms, deliveryTerms, targetDate, date, message } = counterData;
  const price = Number(counterPricePerKg);
  const qty = Number(counterQuantityTons);

  if (!price || price <= 0) throw new Error('Valid counter price per kg is required');
  if (!qty || qty <= 0) throw new Error('Valid counter quantity in tons is required');

  const offerRes = await pool.query('SELECT * FROM offers WHERE id = $1', [offerId]);
  if (offerRes.rows.length === 0) throw new Error('Offer not found');

  const offer = offerRes.rows[0];
  if (offer.status !== 'PENDING' && offer.status !== 'COUNTERED') {
    throw new Error(`Cannot negotiate an offer with status ${offer.status}`);
  }

  // Authorization: Only involved parties can counter
  const isBuyer = user.id === offer.buyer_id;
  const isSeller = user.id === offer.seller_id;
  const isAdmin = user.role === 'admin';

  if (!isAdmin && !isBuyer && !isSeller) {
    throw new Error('Unauthorized to negotiate this offer');
  }

  // If counter is from buyer/seller, check available stock on listing
  if (offer.listing_id) {
    const listRes = await pool.query('SELECT * FROM farmer_listings WHERE id = $1', [offer.listing_id]);
    if (listRes.rows.length > 0) {
      const listing = listRes.rows[0];
      const totalQty = Number(listing.quantity_tons || 0);
      const confirmedQty = Number(listing.confirmed_quantity_tons || 0);
      // Available capacity without this offer's previous reserved hold
      const maxAvailableForThisDeal = totalQty - confirmedQty;
      if (qty > maxAvailableForThisDeal) {
        throw new Error(`Counter quantity (${qty}T) exceeds farmer listing total available stock (${maxAvailableForThisDeal}T)`);
      }
    }
  }

  const counterByRole = isBuyer ? 'buyer' : (offer.seller_role || 'farmer');
  const recipientId = isBuyer ? offer.seller_id : offer.buyer_id;
  const effectiveTerms = pickupTerms || deliveryTerms || offer.delivery_terms || 'Farm Gate Pickup';
  const effectiveDate = targetDate || date || offer.target_date || null;

  // Structured negotiation history
  let history = [];
  try {
    history = typeof offer.negotiation_history === 'string'
      ? JSON.parse(offer.negotiation_history || '[]')
      : (Array.isArray(offer.negotiation_history) ? offer.negotiation_history : []);
  } catch (e) {
    history = [];
  }

  history.push({
    round: history.length + 1,
    action: 'COUNTER_OFFER',
    senderId: user.id,
    senderRole: counterByRole,
    senderName: user.name,
    quantityTons: qty,
    pricePerKg: price,
    pickupTerms: effectiveTerms,
    deliveryTerms: effectiveTerms,
    date: effectiveDate,
    message: message || `Counter proposed by ${user.name}`,
    createdAt: new Date().toISOString()
  });

  const updateSql = `
    UPDATE offers
    SET status = 'COUNTERED',
        counter_price_per_kg = $1,
        counter_quantity_tons = $2,
        counter_message = $3,
        counter_by = $4,
        pickup_terms = $5,
        delivery_terms = $6,
        target_date = $7,
        last_action_by = $8,
        last_action_role = $9,
        negotiation_history = $10,
        updated_at = NOW()
    WHERE id = $11
    RETURNING *
  `;

  const res = await pool.query(updateSql, [
    price,
    qty,
    message || 'Counter offer proposed',
    counterByRole,
    effectiveTerms,
    effectiveTerms,
    effectiveDate,
    user.id,
    counterByRole,
    JSON.stringify(history),
    offerId
  ]);

  const updatedOffer = mapRow(res.rows[0]);
  if (updatedOffer) {
    let hist = updatedOffer.negotiationHistory || updatedOffer.negotiation_history || [];
    if (typeof hist === 'string') {
      try { hist = JSON.parse(hist); } catch (e) { hist = []; }
    }
    updatedOffer.negotiationHistory = hist;
    updatedOffer.negotiation_history = hist;
  }

  // Synchronize listing inventory (the new counter quantity now determines the reserved hold)
  if (offer.listing_id) {
    await syncListingQuantities(offer.listing_id);
  }

  if (offer.requirement_id) {
    await syncRequirementProcurement(offer.requirement_id);
  }

  // Audit log
  await logAudit({
    actorId: user.id,
    actorRole: user.role,
    action: 'OFFER_COUNTERED',
    targetUserId: recipientId,
    details: { offerId, counterPricePerKg: price, counterQuantityTons: qty, counterByRole }
  });

  // Notify recipient
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
 * 3. Reject an Offer (Returns reserved quantity to Available)
 */
async function rejectOffer(arg1, arg2, arg3, arg4) {
  let user, offerId, reason;
  if (typeof arg1 === 'string') {
    offerId = arg1;
    if (typeof arg2 === 'object' && arg2 !== null) {
      user = arg2;
      reason = arg3;
    } else {
      user = { id: arg2, role: arg3 || 'farmer', name: 'User' };
      reason = arg4;
    }
  } else {
    user = arg1.user;
    offerId = arg1.offerId;
    reason = arg1.reason;
  }

  if (!offerId) throw new Error('Offer ID is required');

  const offerRes = await pool.query('SELECT * FROM offers WHERE id = $1', [offerId]);
  if (offerRes.rows.length === 0) throw new Error('Offer not found');

  const offer = offerRes.rows[0];
  if (offer.status === 'ACCEPTED') {
    throw new Error('Cannot reject an already accepted offer / confirmed deal.');
  }

  const isBuyer = user.id === offer.buyer_id;
  const isSeller = user.id === offer.seller_id;
  const isAdmin = user.role === 'admin';

  if (!isAdmin && !isBuyer && !isSeller) {
    throw new Error('Unauthorized to reject this offer');
  }

  const rejectRole = isBuyer ? 'buyer' : (offer.seller_role || 'farmer');
  const recipientId = isBuyer ? offer.seller_id : offer.buyer_id;

  let history = [];
  try {
    history = typeof offer.negotiation_history === 'string'
      ? JSON.parse(offer.negotiation_history || '[]')
      : (Array.isArray(offer.negotiation_history) ? offer.negotiation_history : []);
  } catch (e) {
    history = [];
  }

  history.push({
    round: history.length + 1,
    action: 'OFFER_REJECTED',
    senderId: user.id,
    senderRole: rejectRole,
    senderName: user.name,
    message: reason || 'Offer declined',
    createdAt: new Date().toISOString()
  });

  const updateSql = `
    UPDATE offers
    SET status = 'REJECTED',
        counter_message = $1,
        last_action_by = $2,
        last_action_role = $3,
        negotiation_history = $4,
        updated_at = NOW()
    WHERE id = $5
    RETURNING *
  `;

  const res = await pool.query(updateSql, [
    reason || 'Offer declined',
    user.id,
    rejectRole,
    JSON.stringify(history),
    offerId
  ]);

  const updatedOffer = mapRow(res.rows[0]);

  // Release quantity from RESERVED back to AVAILABLE!
  if (offer.listing_id) {
    await syncListingQuantities(offer.listing_id);
  }

  if (offer.requirement_id) {
    await syncRequirementProcurement(offer.requirement_id);
  }

  // Audit log
  await logAudit({
    actorId: user.id,
    actorRole: user.role,
    action: 'OFFER_REJECTED',
    targetUserId: recipientId,
    details: { offerId, reason }
  });

  // Notify other party
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
 * 4. Accept an Offer (ATOMIC DEAL CONFIRMATION)
 * Only final acceptance by both parties fulfills procurement and marks crop as confirmed.
 */
async function acceptOffer(arg1, arg2, arg3) {
  let user, offerId;
  if (typeof arg1 === 'string') {
    offerId = arg1;
    if (typeof arg2 === 'object' && arg2 !== null) {
      user = arg2;
    } else {
      user = { id: arg2, role: arg3 || 'buyer', name: 'User' };
    }
  } else {
    user = arg1.user;
    offerId = arg1.offerId;
  }

  if (!offerId) throw new Error('Offer ID is required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Row-level lock
    const offerRes = await client.query('SELECT * FROM offers WHERE id = $1 FOR UPDATE', [offerId]);
    if (offerRes.rows.length === 0) {
      throw new Error('Offer not found');
    }

    const offer = offerRes.rows[0];

    if (offer.status === 'ACCEPTED') {
      throw new Error('Offer already accepted and deal confirmed.');
    }
    if (offer.status === 'REJECTED' || offer.status === 'CANCELLED') {
      throw new Error(`Cannot accept an offer with status ${offer.status}.`);
    }

    const existingOrderRes = await client.query('SELECT id, order_number FROM orders WHERE offer_id = $1', [offerId]);
    if (existingOrderRes.rows.length > 0) {
      throw new Error('Deal already exists for this offer.');
    }

    const currentStatus = offer.status;
    const isBuyer = user.id === offer.buyer_id;
    const isSeller = user.id === offer.seller_id;
    const isAdmin = user.role === 'admin';

    if (!isAdmin && !isBuyer && !isSeller) {
      throw new Error('Unauthorized: You are not a party to this offer.');
    }

    // Party verification: The party who did NOT submit the last action must be the one to accept!
    if (!isAdmin) {
      if (offer.last_action_by && offer.last_action_by === user.id) {
        throw new Error('You cannot accept your own proposal. Waiting for the other party to respond.');
      }
    }

    // Determine final agreed terms
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

    // Create confirmed Deal / Order
    const dealId = `ord-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const orderNumber = `KC-DEAL-${Math.floor(1000 + Math.random() * 9000)}`;
    const produceTotal = Math.round(agreedQuantityTons * 1000 * agreedPricePerKg);
    const platformFee = Math.round(produceTotal * 0.02);
    const logisticsCost = 0;
    const totalAmount = produceTotal + platformFee + logisticsCost;

    const timeline = JSON.stringify([
      { status: 'OFFER_ACCEPTED', note: `Deal confirmed and accepted by ${user.name}`, timestamp: new Date().toISOString() },
      { status: 'DEAL_CONFIRMED', note: `Procurement of ${agreedQuantityTons}T confirmed at ₹${agreedPricePerKg}/kg in escrow`, timestamp: new Date().toISOString() }
    ]);

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

    // Append to negotiation history
    let history = [];
    try {
      history = typeof offer.negotiation_history === 'string'
        ? JSON.parse(offer.negotiation_history || '[]')
        : (Array.isArray(offer.negotiation_history) ? offer.negotiation_history : []);
    } catch (e) {
      history = [];
    }

    history.push({
      round: history.length + 1,
      action: 'DEAL_CONFIRMED',
      senderId: user.id,
      senderRole: isBuyer ? 'buyer' : 'farmer',
      senderName: user.name,
      quantityTons: agreedQuantityTons,
      pricePerKg: agreedPricePerKg,
      message: `Final offer accepted by ${user.name}. Deal confirmed!`,
      createdAt: new Date().toISOString()
    });

    // Update Offer status to ACCEPTED with deal_id
    await client.query(`
      UPDATE offers
      SET status = 'ACCEPTED',
          deal_id = $1,
          last_action_by = $2,
          last_action_role = $3,
          negotiation_history = $4,
          updated_at = NOW()
      WHERE id = $5
    `, [dealId, user.id, isBuyer ? 'buyer' : 'farmer', JSON.stringify(history), offerId]);

    // Move listing quantity from RESERVED to CONFIRMED
    if (offer.listing_id) {
      await syncListingQuantities(offer.listing_id, client);
    }

    // Update buyer requirement confirmed procurement
    if (offer.requirement_id) {
      await syncRequirementProcurement(offer.requirement_id, client);
    }

    await client.query('COMMIT');

    // Audit logs & notifications
    await logAudit({
      actorId: user.id,
      actorRole: user.role,
      action: 'OFFER_ACCEPTED',
      targetUserId: isBuyer ? offer.seller_id : offer.buyer_id,
      details: { offerId, dealId, agreedQuantityTons, agreedPricePerKg, totalAmount }
    });

    await logAudit({
      actorId: user.id,
      actorRole: user.role,
      action: 'DEAL_CONFIRMED',
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
      `Offer for ${agreedQuantityTons}T ${offer.crop_name} confirmed at ₹${agreedPricePerKg}/kg!`
    ]);

    return {
      success: true,
      deal: createdDeal,
      order: createdDeal,
      offer: { ...mapRow(offer), status: 'ACCEPTED', deal_id: dealId, dealId },
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
 * 5. Format offer object for frontend consumers
 */
function enrichOffer(offer, user) {
  if (!offer) return null;
  const userObj = typeof user === 'string' ? { id: user } : (user || {});
  const userId = userObj.id;
  const isBuyer = (userObj.role === 'buyer' || userObj.role === 'dealer') || (userId && offer.buyerId === userId);
  const isFarmer = (userObj.role === 'farmer' || userObj.role === 'aggregator') || (userId && offer.sellerId === userId);

  const effectivePrice = Number(
    (offer.status === 'COUNTERED' && offer.counterPricePerKg)
      ? offer.counterPricePerKg
      : (offer.offeredPricePerKg || offer.buyerOfferedPricePerKg || offer.farmerExpectedPricePerKg || 0)
  );

  const effectiveQuantity = Number(
    (offer.status === 'COUNTERED' && offer.counterQuantityTons)
      ? offer.counterQuantityTons
      : (offer.quantityTons || 0)
  );

  // Parse negotiation history safely
  let negotiationHistory = [];
  try {
    negotiationHistory = typeof offer.negotiationHistory === 'string'
      ? JSON.parse(offer.negotiationHistory)
      : (Array.isArray(offer.negotiationHistory) ? offer.negotiationHistory : []);
  } catch (e) {
    negotiationHistory = [];
  }

  // Determine direction: 'SENT' or 'RECEIVED'
  let direction = 'SENT';
  if (userId) {
    if (offer.initiatorId) {
      direction = offer.initiatorId === userId ? 'SENT' : 'RECEIVED';
    } else {
      // Fallback
      if (isFarmer) {
        direction = offer.sellerId === userId ? 'SENT' : 'RECEIVED';
      } else {
        direction = offer.buyerId === userId ? 'SENT' : 'RECEIVED';
      }
    }
  }

  // Determine whose turn it is
  const lastActionBy = offer.lastActionBy || offer.initiatorId;
  const isMyTurn = userId ? (
    (offer.status === 'PENDING' || offer.status === 'COUNTERED') &&
    lastActionBy !== userId
  ) : false;

  // Clear, unambiguous status display strings
  let statusBadge = offer.status;
  let statusText = offer.status;

  if (offer.status === 'PENDING') {
    if (direction === 'SENT') {
      statusText = isBuyer ? 'OFFER SENT — Waiting for Farmer' : 'OFFER SENT — Waiting for Buyer';
      statusBadge = 'SENT_WAITING';
    } else {
      statusText = isFarmer ? 'BUYER OFFER RECEIVED' : 'FARMER OFFER RECEIVED';
      statusBadge = 'OFFER_RECEIVED';
    }
  } else if (offer.status === 'COUNTERED') {
    statusBadge = 'NEGOTIATING';
    if (isMyTurn) {
      statusText = 'Counter-Offer Received (Review & Respond)';
    } else {
      statusText = 'Counter-Offer Sent (Waiting for Response)';
    }
  } else if (offer.status === 'ACCEPTED') {
    statusBadge = 'DEAL_CONFIRMED';
    statusText = 'Deal Confirmed';
  } else if (offer.status === 'REJECTED') {
    statusBadge = 'REJECTED';
    statusText = 'Rejected';
  }

  return {
    ...offer,
    effectivePricePerKg: effectivePrice,
    effectiveQuantityTons: effectiveQuantity,
    negotiationHistory,
    direction,
    isMyTurn,
    statusBadge,
    statusText
  };
}

/**
 * 6. Get All Offers for a User
 */
async function getAllOffersForUser({ user }) {
  let sql;
  let values = [];

  if (user.role === 'farmer' || user.role === 'aggregator') {
    sql = `
      SELECT * FROM offers 
      WHERE seller_id = $1 OR initiator_id = $1 OR recipient_id = $1
      ORDER BY updated_at DESC, created_at DESC
    `;
    values = [user.id];
  } else if (user.role === 'buyer' || user.role === 'dealer') {
    sql = `
      SELECT * FROM offers 
      WHERE buyer_id = $1 OR initiator_id = $1 OR recipient_id = $1
      ORDER BY updated_at DESC, created_at DESC
    `;
    values = [user.id];
  } else {
    // Admin sees all
    sql = 'SELECT * FROM offers ORDER BY updated_at DESC, created_at DESC';
  }

  const res = await pool.query(sql, values);
  return res.rows.map(mapRow).map(o => enrichOffer(o, user));
}

/**
 * 7. Get Sent Offers
 */
async function getSentOffers({ user }) {
  const all = await getAllOffersForUser({ user });
  return all.filter(o => o.direction === 'SENT');
}

/**
 * 8. Get Incoming (Received) Offers
 */
async function getIncomingOffers({ user }) {
  const all = await getAllOffersForUser({ user });
  return all.filter(o => o.direction === 'RECEIVED');
}

/**
 * 9. Get Deals for User
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
    sql += ' ORDER BY created_at DESC';
  }

  const res = await pool.query(sql, values);
  return res.rows.map(mapRow);
}

/**
 * 10. Get Deal By ID
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

module.exports = {
  syncListingQuantities,
  syncRequirementProcurement,
  createOffer,
  acceptOffer,
  counterOffer,
  rejectOffer,
  getDealsForUser,
  getDealById,
  getAllOffersForUser,
  getSentOffers,
  getIncomingOffers,
  enrichOffer
};
