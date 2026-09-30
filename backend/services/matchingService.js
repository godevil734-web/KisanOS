/**
 * KisanConnect Transparent Matching Engine
 * Sections 17 & 18 of Product Spec
 * 
 * Crop Match:        25%
 * Quality Match:     20%
 * Quantity Match:    15%
 * Location Match:    15%
 * Date Match:        10%
 * Price Match:       10%
 * Variety Match:      5%
 * Total:            100%
 */

function calculateMatch(listing, requirement) {
  let score = 0;
  const breakdown = [];
  const reasons = [];

  // 1. Crop Match (25%)
  const isCropMatch = listing.cropName.toLowerCase() === requirement.cropName.toLowerCase() ||
                      (listing.cropId && requirement.cropId && listing.cropId === requirement.cropId);
  
  if (isCropMatch) {
    score += 25;
    breakdown.push({ factor: 'Crop Match', weight: 25, earned: 25, status: 'MATCH' });
    reasons.push(`✓ Exact Crop Match (${listing.cropName})`);
  } else {
    // If crops do not match at all, compatibility is zero
    return {
      score: 0,
      breakdown: [{ factor: 'Crop Match', weight: 25, earned: 0, status: 'NO_MATCH' }],
      reasons: ['✗ Incompatible Crop'],
      isViable: false
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
  const reqGrade = (requirement.gradeRequired || 'Grade A').toUpperCase();
  const listGrade = (listing.grade || 'Grade A').toUpperCase();

  if (listGrade === reqGrade) {
    qualityScore += 12;
    reasons.push(`✓ Grade Alignment (${listGrade})`);
  } else if (listGrade === 'GRADE A' && reqGrade === 'GRADE B') {
    qualityScore += 12; // Premium grade satisfies standard grade
    reasons.push(`✓ Superior Grade (${listGrade} for requested ${reqGrade})`);
  } else {
    qualityScore += 6;
    reasons.push(`~ Different Grade (${listGrade} vs requested ${reqGrade})`);
  }

  // Check size range compatibility if specified
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
  // Farmer can fulfill partially or completely
  let quantityScore = 0;
  const reqQty = Number(requirement.quantityTons) || 1;
  const listQty = Number(listing.quantityTons) || 1;
  const fulfillmentRatio = Math.min(listQty / reqQty, 1.0);

  if (listQty >= reqQty) {
    quantityScore = 15;
    reasons.push(`✓ Full Quantity Capacity (${listQty}T satisfies 100% of ${reqQty}T)`);
  } else {
    // Partial fulfillment (great for aggregators or partial orders)
    quantityScore = Math.max(5, Math.round(fulfillmentRatio * 15));
    reasons.push(`✓ Partial Fulfillment (${listQty}T supplies ${Math.round(fulfillmentRatio * 100)}% of bulk need)`);
  }
  score += quantityScore;
  breakdown.push({ factor: 'Quantity Compatibility', weight: 15, earned: quantityScore, status: listQty >= reqQty ? 'FULL' : 'PARTIAL' });

  // 5. Location Match (15%)
  // Simple heuristic based on region strings or distance
  let locationScore = 15;
  const reqLoc = (requirement.location || '').toLowerCase();
  const listLoc = (listing.farmerLocation || '').toLowerCase();

  if (reqLoc.includes('agra') && listLoc.includes('agra')) {
    locationScore = 15;
    reasons.push('✓ Same District (<25 km distance)');
  } else if ((reqLoc.includes('agra') || reqLoc.includes('delhi')) && (listLoc.includes('mathura') || listLoc.includes('firozabad') || listLoc.includes('agra'))) {
    locationScore = 12;
    reasons.push('✓ Immediate Agri Belt (<75 km transport corridor)');
  } else {
    locationScore = 8;
    reasons.push('~ Inter-district transport required (>100 km)');
  }
  score += locationScore;
  breakdown.push({ factor: 'Location Proximity', weight: 15, earned: locationScore, status: locationScore >= 12 ? 'MATCH' : 'PARTIAL' });

  // 6. Date Match (10%)
  let dateScore = 10;
  const reqDate = new Date(requirement.requiredDate || '2026-10-15');
  const availDate = new Date(listing.availableDate || listing.harvestDate || '2026-09-25');

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
    reasons.push(`✓ Buyer offer (₹${offeredPrice}/kg) meets/exceeds farmer expectation (₹${expectedPrice}/kg)`);
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
    isViable: score >= 60,
    offeredPrice,
    expectedPrice
  };
}

module.exports = { calculateMatch };
