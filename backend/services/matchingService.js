/**
 * KisanConnect Transparent Matching Engine
 * Restructured with:
 * STEP 1: Eligibility Filtering (Buyer Type, Minimum Direct Lot, Aggregation Allowed)
 * STEP 2: Preserved 100% Weighted Compatibility Scoring (Crop, Variety, Quality, Volume, Geo-Distance, Price, Schedule)
 */

const { calculateDistanceKm, resolveCoordinates } = require('./locationService');

/**
 * STEP 1: Evaluate eligibility before scoring
 * @param {Object} listing - Farmer listing object
 * @param {Object} requirement - Buyer requirement object
 * @returns {Object} eligibility assessment
 */
function evaluateEligibility(listing, requirement) {
  const buyerType = (requirement.buyerType || requirement.buyer_type || 'bulk').toLowerCase();
  const reqQtyKg = Number(requirement.requiredQuantityKg || (requirement.quantityTons * 1000)) || 1000;
  const minDirectLotKg = Number(requirement.minimumDirectFarmerLotKg || 0);
  const aggregationAllowed = requirement.aggregationAllowed !== false && requirement.aggregation_allowed !== false;
  const farmerQtyKg = Number(listing.quantityKg || (listing.quantityTons * 1000)) || 1000;

  // 1. Crop Match is an absolute prerequisite
  const isCropMatch = (listing.cropName || '').toLowerCase() === (requirement.cropName || '').toLowerCase() ||
                      (listing.cropId && requirement.cropId && listing.cropId === requirement.cropId);

  if (!isCropMatch) {
    return {
      eligible: false,
      visibleToFarmer: false,
      visibleToAggregator: false,
      reason: 'INCOMPATIBLE_CROP',
      routeType: 'NONE',
      message: 'Incompatible crop type'
    };
  }

  // 2. LOCAL BUYER
  if (buyerType === 'local') {
    if (minDirectLotKg > 0 && farmerQtyKg < minDirectLotKg) {
      return {
        eligible: false,
        visibleToFarmer: false,
        visibleToAggregator: false,
        reason: 'BELOW_LOCAL_MINIMUM_LOT',
        routeType: 'NONE',
        message: `Quantity (${(farmerQtyKg / 1000).toFixed(1)}T) is below buyer's minimum lot (${(minDirectLotKg / 1000).toFixed(1)}T)`
      };
    }
    return {
      eligible: true,
      visibleToFarmer: true,
      visibleToAggregator: false,
      isDirectBulk: false,
      requiresAggregation: false,
      reason: 'LOCAL_DIRECT_MATCH',
      routeType: 'direct_local',
      message: 'Eligible for direct local procurement'
    };
  }

  // 3. BULK BUYER
  if (buyerType === 'bulk') {
    // Large enough farmer meets or exceeds the minimum direct farmer lot
    if (farmerQtyKg >= minDirectLotKg) {
      return {
        eligible: true,
        visibleToFarmer: true,
        visibleToAggregator: false, // Large farmer does not need an aggregator to sell
        isDirectBulk: true,
        requiresAggregation: false,
        reason: 'DIRECT_BULK_QUALIFIED',
        routeType: 'direct_bulk',
        message: 'Qualified for direct bulk procurement contract'
      };
    }

    // Farmer supply is below the direct procurement minimum
    if (aggregationAllowed) {
      return {
        eligible: true,
        visibleToFarmer: true, // Visible as Aggregator Opportunity
        visibleToAggregator: true, // Visible to aggregator to assemble into a plan
        isDirectBulk: false,
        requiresAggregation: true,
        reason: 'AGGREGATOR_OPPORTUNITY',
        routeType: 'aggregator_pooled',
        message: `Your supply (${(farmerQtyKg / 1000).toFixed(1)}T) is below buyer's direct minimum (${(minDirectLotKg / 1000).toFixed(1)}T). Sell via local aggregator.`
      };
    } else {
      // Below direct minimum and buyer prohibited aggregation
      return {
        eligible: false,
        visibleToFarmer: false,
        visibleToAggregator: false,
        isDirectBulk: false,
        requiresAggregation: false,
        reason: 'BELOW_MINIMUM_NO_AGGREGATION',
        routeType: 'none',
        message: 'Supply is below minimum direct lot and aggregation is prohibited'
      };
    }
  }

  return {
    eligible: true,
    visibleToFarmer: true,
    visibleToAggregator: false,
    reason: 'STANDARD_MATCH',
    routeType: 'DIRECT_STANDARD',
    message: 'Standard procurement match'
  };
}

/**
 * STEP 2: Preserved 100% Weighted Compatibility Scoring
 * Crop Match:        25%
 * Variety Match:      5%
 * Quality Match:     20%
 * Quantity Match:    15%
 * Location Match:    15%
 * Date Match:        10%
 * Price Match:       10%
 * Total:            100%
 */
function calculateMatch(listing, requirement) {
  const eligibility = evaluateEligibility(listing, requirement);

  let score = 0;
  const breakdown = [];
  const reasons = [];

  // 1. Crop Match (25%)
  const isCropMatch = (listing.cropName || '').toLowerCase() === (requirement.cropName || '').toLowerCase() ||
                      (listing.cropId && requirement.cropId && listing.cropId === requirement.cropId);
  
  if (isCropMatch) {
    score += 25;
    breakdown.push({ factor: 'Crop Match', weight: 25, earned: 25, status: 'MATCH' });
    reasons.push(`✓ Exact Crop Match (${listing.cropName})`);
  } else {
    return {
      score: 0,
      breakdown: [{ factor: 'Crop Match', weight: 25, earned: 0, status: 'NO_MATCH' }],
      reasons: ['✗ Incompatible Crop'],
      isViable: false,
      eligibility,
      distanceKm: 0
    };
  }

  // 2. Variety Match (5%)
  let varietyScore = 0;
  if (!requirement.variety || requirement.variety === 'Any' || requirement.variety === 'All Varieties') {
    varietyScore = 5;
    reasons.push('✓ Any Variety Accepted');
  } else if (listing.variety && listing.variety.toLowerCase().includes(requirement.variety.toLowerCase())) {
    varietyScore = 5;
    reasons.push(`✓ Exact Variety Match (${listing.variety})`);
  } else {
    varietyScore = 2;
    reasons.push(`~ Variety variant (${listing.variety} vs ${requirement.variety})`);
  }
  score += varietyScore;
  breakdown.push({ factor: 'Variety', weight: 5, earned: varietyScore, status: varietyScore === 5 ? 'MATCH' : 'PARTIAL' });

  // 3. Quality Match (20%)
  let qualityScore = 0;
  const reqGrade = (requirement.gradeRequired || requirement.quality_grade || 'Grade A').toUpperCase();
  const listGrade = (listing.grade || 'Grade A').toUpperCase();

  if (listGrade === reqGrade) {
    qualityScore += 12;
    reasons.push(`✓ Grade Alignment (${listGrade})`);
  } else if (listGrade === 'GRADE A' && reqGrade === 'GRADE B') {
    qualityScore += 12;
    reasons.push(`✓ Superior Grade (${listGrade} for requested ${reqGrade})`);
  } else {
    qualityScore += 6;
    reasons.push(`~ Different Grade (${listGrade} vs requested ${reqGrade})`);
  }

  if (requirement.sizeMinMm && listing.sizeMinMm) {
    const minDiff = Math.abs(listing.sizeMinMm - requirement.sizeMinMm);
    if (minDiff <= 5) {
      qualityScore += 8;
      reasons.push(`✓ Calibrated Size (${listing.sizeMinMm}-${listing.sizeMaxMm}mm matches requirement)`);
    } else {
      qualityScore += 4;
      reasons.push(`~ Minor size deviation (${listing.sizeMinMm}-${listing.sizeMaxMm}mm)`);
    }
  } else {
    qualityScore += 8;
  }
  score += qualityScore;
  breakdown.push({ factor: 'Quality Grade & Sizing', weight: 20, earned: qualityScore, status: qualityScore >= 16 ? 'MATCH' : 'PARTIAL' });

  // 4. Quantity Match (15%)
  let quantityScore = 0;
  const reqQty = Number(requirement.quantityTons) || 1;
  const listQty = Number(listing.quantityTons) || 1;
  const fulfillmentRatio = Math.min(listQty / reqQty, 1.0);

  if (listQty >= reqQty) {
    quantityScore = 15;
    reasons.push(`✓ Full Quantity Capacity (${listQty}T satisfies 100% of ${reqQty}T)`);
  } else {
    quantityScore = Math.max(5, Math.round(fulfillmentRatio * 15));
    reasons.push(`✓ Partial Fulfillment (${listQty}T supplies ${Math.round(fulfillmentRatio * 100)}% of need)`);
  }
  score += quantityScore;
  breakdown.push({ factor: 'Quantity Compatibility', weight: 15, earned: quantityScore, status: listQty >= reqQty ? 'FULL' : 'PARTIAL' });

  // 5. Geo-Distance Location Match (15%)
  const originCoords = resolveCoordinates(listing);
  const targetCoords = resolveCoordinates(requirement);
  const distanceKm = calculateDistanceKm(originCoords.lat, originCoords.lon, targetCoords.lat, targetCoords.lon);

  let locationScore = 15;
  if (distanceKm <= 15) {
    locationScore = 15;
    reasons.push(`✓ Immediate Vicinity (${distanceKm} km distance)`);
  } else if (distanceKm <= 35) {
    locationScore = 13;
    reasons.push(`✓ Regional Proximity (${distanceKm} km corridor)`);
  } else if (distanceKm <= 75) {
    locationScore = 10;
    reasons.push(`✓ Agri Belt Corridor (${distanceKm} km transport distance)`);
  } else if (distanceKm <= 150) {
    locationScore = 7;
    reasons.push(`~ Inter-district transit (${distanceKm} km distance)`);
  } else {
    locationScore = 4;
    reasons.push(`~ Long-haul logistics (${distanceKm} km distance)`);
  }
  score += locationScore;
  breakdown.push({ factor: 'Location Proximity', weight: 15, earned: locationScore, status: locationScore >= 12 ? 'MATCH' : 'PARTIAL' });

  // 6. Date Match (10%)
  let dateScore = 10;
  const reqDate = new Date(requirement.requiredDate || requirement.required_by || '2026-10-30');
  const availDate = new Date(listing.availableDate || listing.harvestDate || '2026-10-15');

  if (availDate <= reqDate) {
    dateScore = 10;
    reasons.push('✓ Available on or before required dispatch date');
  } else {
    const daysDiff = (availDate - reqDate) / (1000 * 60 * 60 * 24);
    if (daysDiff <= 5) {
      dateScore = 5;
      reasons.push('~ Available within 5 days of target date');
    } else {
      dateScore = 2;
      reasons.push('✗ Availability date is past deadline');
    }
  }
  score += dateScore;
  breakdown.push({ factor: 'Timeline Alignment', weight: 10, earned: dateScore, status: dateScore === 10 ? 'MATCH' : 'PARTIAL' });

  // 7. Price Match (10%)
  let priceScore = 10;
  const offeredPrice = Number(requirement.offeredPricePerKg) || 20;
  const expectedPrice = Number(listing.expectedPricePerKg) || 18;

  if (expectedPrice <= offeredPrice) {
    priceScore = 10;
    reasons.push(`✓ Buyer offer (₹${offeredPrice}/kg) meets/exceeds expectation (₹${expectedPrice}/kg)`);
  } else {
    const diff = expectedPrice - offeredPrice;
    if (diff <= 2) {
      priceScore = 6;
      reasons.push(`~ Small margin gap: Farmer asks ₹${expectedPrice}, Buyer offers ₹${offeredPrice}`);
    } else {
      priceScore = 2;
      reasons.push(`✗ Price gap: Farmer asks ₹${expectedPrice}, Buyer offers ₹${offeredPrice}`);
    }
  }
  score += priceScore;
  breakdown.push({ factor: 'Price Feasibility', weight: 10, earned: priceScore, status: priceScore === 10 ? 'MATCH' : 'NEGOTIABLE' });

  return {
    score: Math.min(100, score),
    breakdown,
    reasons,
    isViable: score >= 50 && eligibility.eligible,
    eligibility,
    offeredPrice,
    expectedPrice,
    distanceKm
  };
}

module.exports = {
  evaluateEligibility,
  calculateMatch
};
