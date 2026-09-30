const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db, hashPassword } = require('./db');
const { calculateMatch } = require('./services/matchingService');
const { calculateNetRealization, calculateStorageScenario } = require('./services/netRealizationService');
const { predictYield, analyzeProduceQualityCV } = require('./services/forecastService');

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'kisanconnect-secret-key-2026';

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// Authentication middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.findById('users', decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Optional Auth (works if token is present or guest)
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = db.findById('users', decoded.id) || null;
    } catch (e) {
      req.user = null;
    }
  }
  next();
}

// ---------------------------------------------
// 1. AUTHENTICATION & QUICK DEMO ROLE SWITCHER
// ---------------------------------------------

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role, phone, location, profileDetails } = req.body;
  const userEmail = email || (phone ? `${phone.replace(/\D/g, '')}@kisan.in` : `user-${Date.now()}@kisan.in`);
  const userPassword = password || 'kisan123';

  if (!name || !role) {
    return res.status(400).json({ error: 'Missing required registration fields (name, role)' });
  }

  const existing = db.findOne('users', u => u.email.toLowerCase() === userEmail.toLowerCase() || (phone && u.phone === phone));
  if (existing) {
    return res.status(400).json({ error: 'An account with this phone or email is already registered. Please login.' });
  }

  const newUser = {
    id: `usr-${role.slice(0, 3)}-${Date.now()}`,
    name,
    email: userEmail,
    password: hashPassword(userPassword),
    phone: phone || '+91 98000 00000',
    role,
    location: location || 'Agra, UP',
    rating: 5.0,
    reviewsCount: 0,
    verified: false,
    completedOrders: 0,
    createdAt: new Date().toISOString()
  };

  if (role === 'farmer') {
    newUser.farmerProfile = {
      farmName: profileDetails?.farmName || `${name}'s Farm`,
      acres: Number(profileDetails?.acres) || 5,
      cropsGrown: profileDetails?.cropsGrown || ['Potato'],
      irrigationType: profileDetails?.irrigationType || 'Tube well',
      historicalYieldPerAcre: 13
    };
  } else if (role === 'aggregator') {
    newUser.aggregatorProfile = {
      businessName: profileDetails?.businessName || `${name} Agro Collectives`,
      operatingRegion: profileDetails?.operatingRegion || 'Agra Zone',
      serviceRadiusKm: Number(profileDetails?.serviceRadiusKm) || 50,
      maxAggregationCapacityTons: Number(profileDetails?.maxAggregationCapacityTons) || 50,
      subscribedPlanId: null,
      subscriptionStatus: 'NONE',
      subscriptionExpiresAt: null,
      allowedCrops: profileDetails?.allowedCrops || ['Potato', 'Onion'],
      warehouseLocation: location || 'Agra Hub',
      bankVerified: false
    };
  } else if (role === 'buyer') {
    newUser.buyerProfile = {
      companyName: profileDetails?.companyName || `${name} Agri Trade`,
      businessType: profileDetails?.businessType || 'Wholesaler',
      gstNumber: profileDetails?.gstNumber || '07AAACP0000A1Z5',
      annualDemandTons: Number(profileDetails?.annualDemandTons) || 500,
      preferredDelivery: profileDetails?.preferredDelivery || 'DELIVERY_TO_BUYER'
    };
  } else if (role === 'cold_storage') {
    newUser.coldStorageProfile = {
      facilityName: profileDetails?.facilityName || `${name} Cold Logistics`,
      capacityTons: Number(profileDetails?.capacityTons) || 5000,
      availableTons: Number(profileDetails?.capacityTons) || 5000,
      chargePerMonthPerTon: Number(profileDetails?.chargePerMonthPerTon) || 450,
      supportedCrops: profileDetails?.supportedCrops || ['Potato', 'Apple']
    };
    db.insert('coldStorages', {
      id: `cs-${Date.now()}`,
      operatorId: newUser.id,
      name: profileDetails?.facilityName || `${name} Cold Logistics`,
      location: location || 'Agra Bypass',
      totalCapacityTons: Number(profileDetails?.capacityTons) || 5000,
      availableCapacityTons: Number(profileDetails?.capacityTons) || 5000,
      storageChargePerMonthPerTon: Number(profileDetails?.chargePerMonthPerTon) || 450,
      supportedCrops: profileDetails?.supportedCrops || ['Potato', 'Apple'],
      verificationStatus: 'VERIFIED'
    });
  } else if (role === 'transporter') {
    newUser.transporterProfile = {
      agencyName: profileDetails?.agencyName || `${name} Kisan Logistics`,
      fleetSize: Number(profileDetails?.fleetSize) || 4,
      routes: profileDetails?.routes || ['Agra - Mathura - Delhi'],
      vehicleTypes: profileDetails?.vehicleTypes || ['Canter 6T', 'Tata 22T']
    };
  }

  db.insert('users', newUser);

  const token = jwt.sign({ id: newUser.id, role: newUser.role, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _, ...userSafe } = newUser;
  res.json({ token, user: userSafe });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = db.findOne('users', u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isValid = bcrypt.compareSync(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _, ...userSafe } = user;
  res.json({ token, user: userSafe });
});

// Instant role-switcher for evaluator / demo convenience
app.post('/api/auth/demo-switch', (req, res) => {
  const { role } = req.body;
  const targetUser = db.findOne('users', u => u.role === role);
  if (!targetUser) {
    return res.status(404).json({ error: `No demo user found with role: ${role}` });
  }

  const token = jwt.sign({ id: targetUser.id, role: targetUser.role, email: targetUser.email }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _, ...userSafe } = targetUser;
  res.json({ token, user: userSafe });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const { password: _, ...userSafe } = req.user;
  res.json({ user: userSafe });
});

// ---------------------------------------------
// 2. CROPS CATALOGUE (CROP-AGNOSTIC)
// ---------------------------------------------

app.get('/api/crops', (req, res) => {
  const crops = db.find('crops');
  res.json(crops);
});

app.post('/api/crops', authMiddleware, (req, res) => {
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

  db.insert('crops', newCrop);
  res.status(201).json(newCrop);
});

// ---------------------------------------------
// 3. FARMER LISTINGS
// ---------------------------------------------

app.get('/api/listings', (req, res) => {
  const { crop, farmerId, listingType, grade } = req.query;
  let listings = db.find('farmerListings');

  if (crop) {
    listings = listings.filter(l => l.cropName.toLowerCase() === crop.toLowerCase() || l.cropId === crop);
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

  res.json(listings);
});

app.post('/api/listings', authMiddleware, (req, res) => {
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

  db.insert('farmerListings', newListing);

  // Notify aggregators in same region
  const aggregators = db.find('users', u => u.role === 'aggregator');
  aggregators.forEach(agg => {
    db.insert('notifications', {
      userId: agg.id,
      title: `New Supply: ${quantityTons}T ${cropName} in ${req.user.location}`,
      message: `${req.user.name} posted ${quantityTons}T of ${variety} ${cropName} at ₹${expectedPricePerKg}/kg.`,
      type: 'MATCH',
      read: false,
      timestamp: new Date().toISOString()
    });
  });

  res.status(201).json(newListing);
});

// Quality Verification for a listing
app.post('/api/listings/:id/verify', authMiddleware, (req, res) => {
  const listing = db.findById('farmerListings', req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const updated = db.updateById('farmerListings', req.params.id, {
    verificationStatus: 'VERIFIED',
    verifier: `${req.user.name} (${req.user.role})`
  });

  res.json(updated);
});

// ---------------------------------------------
// 4. BUYER REQUIREMENTS
// ---------------------------------------------

app.get('/api/requirements', (req, res) => {
  const { crop, buyerId, status } = req.query;
  let reqs = db.find('buyerRequirements');

  if (crop) {
    reqs = reqs.filter(r => r.cropName.toLowerCase() === crop.toLowerCase());
  }
  if (buyerId) {
    reqs = reqs.filter(r => r.buyerId === buyerId);
  }
  if (status) {
    reqs = reqs.filter(r => r.status === status);
  }

  res.json(reqs);
});

app.post('/api/requirements', authMiddleware, (req, res) => {
  const {
    cropId,
    cropName,
    variety,
    quantityTons,
    gradeRequired,
    sizeMinMm,
    sizeMaxMm,
    maxMoisture,
    maxDefects,
    location,
    requiredDate,
    offeredPricePerKg,
    deliveryType,
    specialRequirements
  } = req.body;

  if (!cropName || !quantityTons || !offeredPricePerKg) {
    return res.status(400).json({ error: 'Missing crop, quantity, or offered price' });
  }

  const newReq = {
    id: `req-${Date.now()}`,
    buyerId: req.user.id,
    buyerName: req.user.name,
    buyerCompany: req.user.buyerProfile?.companyName || req.user.name,
    cropId: cropId || `crop-${cropName.toLowerCase()}`,
    cropName,
    variety: variety || 'All Varieties',
    quantityTons: Number(quantityTons),
    unit: 'tonnes',
    gradeRequired: gradeRequired || 'Grade A',
    sizeMinMm: Number(sizeMinMm) || 45,
    sizeMaxMm: Number(sizeMaxMm) || 75,
    maxMoisture: Number(maxMoisture) || 19,
    maxDefects: Number(maxDefects) || 3.0,
    location: location || req.user.location,
    requiredDate: requiredDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    offeredPricePerKg: Number(offeredPricePerKg),
    deliveryType: deliveryType || 'PICKUP_REQUIRED',
    status: 'OPEN',
    specialRequirements: specialRequirements || '',
    createdAt: new Date().toISOString()
  };

  db.insert('buyerRequirements', newReq);

  // Notify aggregators & farmers
  const farmers = db.find('users', u => u.role === 'farmer');
  farmers.slice(0, 5).forEach(farmer => {
    db.insert('notifications', {
      userId: farmer.id,
      title: `Bulk Buyer Demand: ${quantityTons}T ${cropName}`,
      message: `${newReq.buyerCompany} is offering ₹${offeredPricePerKg}/kg for ${quantityTons}T ${cropName}.`,
      type: 'MATCH',
      read: false,
      timestamp: new Date().toISOString()
    });
  });

  res.status(201).json(newReq);
});

// ---------------------------------------------
// 5. MATCHING ENGINE & NET REALIZATION
// ---------------------------------------------

// Find matching requirements for a farmer listing
app.get('/api/matches/listing/:listingId', (req, res) => {
  const listing = db.findById('farmerListings', req.params.listingId);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const allReqs = db.find('buyerRequirements', r => r.status === 'OPEN');
  const matches = allReqs.map(reqItem => {
    const matchResult = calculateMatch(listing, reqItem);
    const netCalc = calculateNetRealization({
      buyerPricePerKg: reqItem.offeredPricePerKg,
      distanceKm: matchResult.breakdown.find(b => b.factor === 'Location Proximity')?.earned >= 12 ? 35 : 120,
      buyerPicksUp: reqItem.deliveryType === 'PICKUP_REQUIRED',
      storageCostPerKg: listing.storageRequirement === 'COLD_STORAGE' ? 0.45 : 0
    });

    return {
      requirement: reqItem,
      matchScore: matchResult.score,
      isViable: matchResult.isViable,
      breakdown: matchResult.breakdown,
      reasons: matchResult.reasons,
      netRealization: netCalc
    };
  }).filter(m => m.matchScore >= 40)
    .sort((a, b) => b.matchScore - a.matchScore);

  res.json({ listing, matches });
});

// Find matching supply for a buyer requirement
app.get('/api/matches/requirement/:reqId', (req, res) => {
  const requirement = db.findById('buyerRequirements', req.params.reqId);
  if (!requirement) return res.status(404).json({ error: 'Requirement not found' });

  // 1. Direct Farmer Listings
  const allListings = db.find('farmerListings', l => l.status === 'ACTIVE');
  const matchedFarmers = allListings.map(listing => {
    const matchResult = calculateMatch(listing, requirement);
    const netCalc = calculateNetRealization({
      buyerPricePerKg: requirement.offeredPricePerKg,
      distanceKm: 40,
      buyerPicksUp: requirement.deliveryType === 'PICKUP_REQUIRED'
    });

    return {
      listing,
      matchScore: matchResult.score,
      isViable: matchResult.isViable,
      breakdown: matchResult.breakdown,
      reasons: matchResult.reasons,
      netRealization: netCalc
    };
  }).filter(m => m.matchScore >= 40)
    .sort((a, b) => b.matchScore - a.matchScore);

  // 2. Existing Aggregation Batches
  const batches = db.find('aggregationBatches', b => 
    b.cropName.toLowerCase() === requirement.cropName.toLowerCase()
  );

  // 3. Cold Storage Inventory
  const coldStores = db.find('coldStorages');
  const storageMatches = [];
  coldStores.forEach(cs => {
    cs.inventory.forEach(inv => {
      if (inv.cropName.toLowerCase() === requirement.cropName.toLowerCase()) {
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

  res.json({
    requirement,
    farmerMatches: matchedFarmers,
    aggregatorBatches: batches,
    coldStorageInventory: storageMatches
  });
});

// ---------------------------------------------
// 6. OFFERS & NEGOTIATION
// ---------------------------------------------

app.get('/api/offers', authMiddleware, (req, res) => {
  const user = req.user;
  let offers = [];
  if (user.role === 'farmer' || user.role === 'aggregator') {
    offers = db.find('offers', o => o.sellerId === user.id);
  } else if (user.role === 'buyer') {
    offers = db.find('offers', o => o.buyerId === user.id);
  } else {
    offers = db.find('offers');
  }
  res.json(offers);
});

app.post('/api/offers', authMiddleware, (req, res) => {
  const {
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
  } = req.body;

  const newOffer = {
    id: `off-${Date.now()}`,
    requirementId,
    listingId,
    buyerId: req.user.role === 'buyer' ? req.user.id : (req.body.buyerId || 'usr-buyer-1'),
    buyerName: req.user.role === 'buyer' ? req.user.name : (req.body.buyerName || 'Buyer'),
    sellerId: sellerId || req.user.id,
    sellerName: sellerName || req.user.name,
    sellerRole: req.user.role === 'aggregator' ? 'aggregator' : 'farmer',
    cropName: cropName || 'Potato',
    variety: variety || 'Standard',
    quantityTons: Number(quantityTons),
    buyerOfferedPricePerKg: Number(offeredPricePerKg),
    farmerExpectedPricePerKg: Number(offeredPricePerKg),
    deliveryTerms: deliveryTerms || 'Farm Gate Pickup',
    status: 'PENDING',
    message: message || 'Interested in fulfilling your requirements.',
    createdAt: new Date().toISOString()
  };

  db.insert('offers', newOffer);

  // Notify recipient
  const targetId = req.user.role === 'buyer' ? newOffer.sellerId : newOffer.buyerId;
  db.insert('notifications', {
    userId: targetId,
    title: `New Offer for ${newOffer.quantityTons}T ${newOffer.cropName}`,
    message: `${req.user.name} offered ₹${offeredPricePerKg}/kg.`,
    type: 'OFFER',
    read: false,
    timestamp: new Date().toISOString()
  });

  res.status(201).json(newOffer);
});

app.put('/api/offers/:id/status', authMiddleware, (req, res) => {
  const { status } = req.body; // 'ACCEPTED' or 'REJECTED'
  const offer = db.findById('offers', req.params.id);
  if (!offer) return res.status(404).json({ error: 'Offer not found' });

  const updatedOffer = db.updateById('offers', req.params.id, { status });

  // If accepted, automatically generate confirmed Order
  if (status === 'ACCEPTED') {
    const produceTotal = Number((offer.quantityTons * 1000 * offer.buyerOfferedPricePerKg).toFixed(0));
    const logisticsCost = 8500;
    const platformFee = 2000;
    const totalAmount = produceTotal + logisticsCost + platformFee;

    const newOrder = {
      id: `ord-${Date.now()}`,
      orderNumber: `KC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      buyerId: offer.buyerId,
      buyerName: offer.buyerName,
      sellerType: offer.sellerRole.toUpperCase(),
      sellerId: offer.sellerId,
      sellerName: offer.sellerName,
      cropName: offer.cropName,
      variety: offer.variety,
      quantityTons: offer.quantityTons,
      unitPricePerKg: offer.buyerOfferedPricePerKg,
      produceTotal,
      logisticsCost,
      platformFee,
      totalAmount,
      pickupLocation: 'Farm Gate / Collection Point',
      deliveryLocation: 'Buyer Processing / Mandi Gate',
      transporterId: 'trp-601',
      transporterName: 'Kisan Express Agri Freight',
      status: 'CONFIRMED',
      paymentStatus: 'ESCROW_LOCKED',
      createdAt: new Date().toISOString(),
      estimatedDeliveryDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      timeline: [
        { status: 'CREATED', note: 'Offer accepted by seller', timestamp: new Date().toISOString() },
        { status: 'CONFIRMED', note: 'Order confirmed and locked in escrow', timestamp: new Date().toISOString() }
      ]
    };

    db.insert('orders', newOrder);

    // Notify both
    db.insert('notifications', {
      userId: offer.buyerId,
      title: `Order ${newOrder.orderNumber} Created`,
      message: `Your offer for ${offer.quantityTons}T ${offer.cropName} was accepted!`,
      type: 'ORDER',
      read: false,
      timestamp: new Date().toISOString()
    });
    db.insert('notifications', {
      userId: offer.sellerId,
      title: `Order ${newOrder.orderNumber} Confirmed`,
      message: `Payment escrow locked. Prepare produce for pickup.`,
      type: 'ORDER',
      read: false,
      timestamp: new Date().toISOString()
    });

    return res.json({ offer: updatedOffer, order: newOrder });
  }

  res.json({ offer: updatedOffer });
});

// ---------------------------------------------
// 7. ORDERS & STATE MACHINE
// ---------------------------------------------

app.get('/api/orders', authMiddleware, (req, res) => {
  const user = req.user;
  let orders = [];
  if (user.role === 'farmer' || user.role === 'aggregator') {
    orders = db.find('orders', o => o.sellerId === user.id);
  } else if (user.role === 'buyer') {
    orders = db.find('orders', o => o.buyerId === user.id);
  } else if (user.role === 'transporter') {
    orders = db.find('orders', o => o.transporterId === 'trp-601');
  } else {
    orders = db.find('orders'); // Admin sees all
  }
  res.json(orders);
});

app.get('/api/orders/:id', authMiddleware, (req, res) => {
  const order = db.findById('orders', req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// Advance order status
app.put('/api/orders/:id/status', authMiddleware, (req, res) => {
  const { status, note } = req.body;
  const validStatuses = ['CREATED', 'CONFIRMED', 'AGGREGATING', 'READY_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid order status' });
  }

  const order = db.findById('orders', req.params.id);
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

  const updatedOrder = db.updateById('orders', req.params.id, updates);

  // Notify parties
  db.insert('notifications', {
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

app.get('/api/aggregators/profile', authMiddleware, (req, res) => {
  if (req.user.role !== 'aggregator') {
    return res.status(403).json({ error: 'Only aggregator can access aggregator profile' });
  }

  const plans = db.find('subscriptionPlans');
  const currentPlan = plans.find(p => p.id === req.user.aggregatorProfile?.subscribedPlanId) || null;

  res.json({
    user: req.user,
    profile: req.user.aggregatorProfile,
    currentPlan,
    isActive: req.user.aggregatorProfile?.subscriptionStatus === 'ACTIVE'
  });
});

// Subscribe to Aggregator Plan
app.post('/api/aggregators/subscribe', authMiddleware, (req, res) => {
  const { planId, billingCycle = 'monthly', region, crops } = req.body;
  const plan = db.findById('subscriptionPlans', planId);
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

  const updatedUser = db.updateById('users', req.user.id, {
    aggregatorProfile: updatedProfile
  });

  // Record platform transaction
  const amount = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  db.insert('notifications', {
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

app.get('/api/batches', authMiddleware, (req, res) => {
  const batches = db.find('aggregationBatches');
  res.json(batches);
});

app.post('/api/batches', authMiddleware, (req, res) => {
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

  db.insert('aggregationBatches', newBatch);
  res.status(201).json(newBatch);
});

// Add farmer listing to batch
app.post('/api/batches/:id/add-farmer', authMiddleware, (req, res) => {
  const batch = db.findById('aggregationBatches', req.params.id);
  if (!batch) return res.status(404).json({ error: 'Batch not found' });

  const { listingId, farmerId, farmerName, farmerLocation, quantityTons, purchasePricePerKg } = req.body;

  const farmers = batch.farmers || [];
  farmers.push({
    listingId,
    farmerId,
    farmerName,
    farmerLocation,
    quantityTons: Number(quantityTons),
    purchasePricePerKg: Number(purchasePricePerKg),
    status: 'COMMITTED'
  });

  let totalTons = 0;
  let totalCost = 0;
  farmers.forEach(f => {
    totalTons += Number(f.quantityTons);
    totalCost += (Number(f.quantityTons) * 1000 * Number(f.purchasePricePerKg));
  });

  const avgPurchasePrice = Number((totalCost / (totalTons * 1000)).toFixed(2));
  const grossMargin = Number((batch.buyerSalePricePerKg - (avgPurchasePrice + batch.estimatedLogisticsCostPerKg + batch.estimatedStorageCostPerKg + batch.estimatedPlatformFeePerKg)).toFixed(2));

  const status = totalTons >= batch.targetQuantityTons ? 'READY_TO_FULFILL' : 'GATHERING';

  const updatedStops = farmers.map((f, i) => `Stop ${i + 1}: ${f.farmerLocation} (${f.farmerName} - ${f.quantityTons}T)`);
  updatedStops.push(`Consolidation Hub: Agra Bypass Hub`);
  updatedStops.push(`Destination: ${batch.buyerName}`);

  const updated = db.updateById('aggregationBatches', req.params.id, {
    farmers,
    currentAggregatedTons: totalTons,
    farmerPurchasePriceAvg: avgPurchasePrice,
    estimatedGrossMarginPerKg: grossMargin,
    status,
    collectionRoute: {
      stops: updatedStops,
      totalDistanceKm: 35 + (farmers.length * 15),
      estimatedTransportCostTotal: 18000 + (farmers.length * 4500),
      estimatedCostPerKg: batch.estimatedLogisticsCostPerKg
    }
  });

  res.json(updated);
});

// ---------------------------------------------
// 10. COLD STORAGE MODULE & INVENTORY
// ---------------------------------------------

app.get('/api/storage', (req, res) => {
  const storages = db.find('coldStorages');
  res.json(storages);
});

app.get('/api/storage/:id', (req, res) => {
  const storage = db.findById('coldStorages', req.params.id);
  if (!storage) return res.status(404).json({ error: 'Storage facility not found' });
  res.json(storage);
});

// Book cold storage space
app.post('/api/storage/book', authMiddleware, (req, res) => {
  const { storageId, cropName, variety, quantityTons, durationMonths } = req.body;
  const storage = db.findById('coldStorages', storageId);
  if (!storage) return res.status(404).json({ error: 'Storage not found' });

  const months = Number(durationMonths) || 3;
  const qty = Number(quantityTons) || 10;
  const totalCost = qty * storage.storageChargePerMonthPerTon * months;

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
    ratePerTonPerMonth: storage.storageChargePerMonthPerTon,
    totalStorageCharge: totalCost,
    status: 'ACTIVE',
    receiptNumber: `AICL-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString()
  };

  db.insert('storageBookings', newBooking);

  // Update storage capacity
  db.updateById('coldStorages', storageId, {
    occupiedCapacityTons: storage.occupiedCapacityTons + qty,
    availableCapacityTons: Math.max(0, storage.availableCapacityTons - qty),
    utilizationPercent: Math.round(((storage.occupiedCapacityTons + qty) / storage.totalCapacityTons) * 100)
  });

  res.status(201).json(newBooking);
});

app.get('/api/storage/bookings/my', authMiddleware, (req, res) => {
  const bookings = db.find('storageBookings', b => b.farmerId === req.user.id);
  res.json(bookings);
});

// Storage Decision Analysis: "Sell Now vs Store & Sell Later"
app.post('/api/storage/scenario', (req, res) => {
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

app.get('/api/transporters', (req, res) => {
  const transporters = db.find('transporters');
  res.json(transporters);
});

app.post('/api/transporters/calculate-route', (req, res) => {
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

app.get('/api/market-prices', (req, res) => {
  const { crop, district } = req.query;
  let prices = db.find('marketPrices');

  if (crop) {
    prices = prices.filter(p => p.cropName.toLowerCase() === crop.toLowerCase());
  }
  if (district) {
    prices = prices.filter(p => p.district.toLowerCase() === district.toLowerCase());
  }

  res.json(prices);
});

// ---------------------------------------------
// 13. SUPPLY & DEMAND FORECASTING & AI LAYER
// ---------------------------------------------

app.get('/api/forecasts/regional', (req, res) => {
  const forecasts = db.find('regionalSupplyForecasts');
  res.json(forecasts);
});

app.post('/api/forecasts/predict-yield', (req, res) => {
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

app.post('/api/forecasts/cv-quality', (req, res) => {
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

app.get('/api/admin/stats', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only' });
  }

  const users = db.find('users');
  const listings = db.find('farmerListings');
  const requirements = db.find('buyerRequirements');
  const batches = db.find('aggregationBatches');
  const orders = db.find('orders');
  const storages = db.find('coldStorages');

  const totalGMV = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const activeBatchesCount = batches.filter(b => b.status !== 'COMPLETED').length;

  res.json({
    totalUsers: users.length,
    usersByRole: {
      farmer: users.filter(u => u.role === 'farmer').length,
      aggregator: users.filter(u => u.role === 'aggregator').length,
      buyer: users.filter(u => u.role === 'buyer').length,
      cold_storage: users.filter(u => u.role === 'cold_storage').length,
      transporter: users.filter(u => u.role === 'transporter').length,
      admin: users.filter(u => u.role === 'admin').length
    },
    activeListings: listings.filter(l => l.status === 'ACTIVE').length,
    openRequirements: requirements.filter(r => r.status === 'OPEN').length,
    activeBatches: activeBatchesCount,
    totalOrders: orders.length,
    totalGMV,
    totalColdStorageCapacityTons: storages.reduce((sum, s) => sum + s.totalCapacityTons, 0),
    occupiedColdStorageCapacityTons: storages.reduce((sum, s) => sum + s.occupiedCapacityTons, 0)
  });
});

app.get('/api/admin/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only' });
  }

  const users = db.find('users').map(u => {
    const { password: _, ...userSafe } = u;
    return userSafe;
  });
  res.json(users);
});

app.put('/api/admin/users/:id/verify', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only' });
  }

  const user = db.findById('users', req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const updated = db.updateById('users', req.params.id, {
    verified: !user.verified
  });

  const { password: _, ...userSafe } = updated;
  res.json(userSafe);
});

// Configure Subscription Plans
app.get('/api/admin/plans', (req, res) => {
  const plans = db.find('subscriptionPlans');
  res.json(plans);
});

app.put('/api/admin/plans/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only' });
  }

  const updated = db.updateById('subscriptionPlans', req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Plan not found' });
  res.json(updated);
});

// Reset demo database to initial clean state
app.post('/api/admin/reset-demo', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only' });
  }

  db.reset();
  res.json({ message: 'Database reset to default seed data successfully.' });
});

// ---------------------------------------------
// 15. NOTIFICATIONS
// ---------------------------------------------

app.get('/api/notifications', authMiddleware, (req, res) => {
  const notifs = db.find('notifications', n => n.userId === req.user.id || n.userId === 'all');
  res.json(notifs);
});

app.put('/api/notifications/:id/read', authMiddleware, (req, res) => {
  const updated = db.updateById('notifications', req.params.id, { read: true });
  res.json(updated);
});

// ---------------------------------------------
// 16. REVIEWS & TRUST
// ---------------------------------------------

app.get('/api/reviews', (req, res) => {
  const { targetUserId } = req.query;
  let reviews = db.find('reviews');
  if (targetUserId) {
    reviews = reviews.filter(r => r.targetUserId === targetUserId);
  }
  res.json(reviews);
});

app.post('/api/reviews', authMiddleware, (req, res) => {
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

  db.insert('reviews', newReview);
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

app.listen(PORT, () => {
  console.log(`🚀 KisanConnect API Server running on http://localhost:${PORT}`);
});
