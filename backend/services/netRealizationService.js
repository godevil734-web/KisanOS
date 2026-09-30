/**
 * Net Realization & Storage Decision Calculator
 * Sections 19 & 24 of Product Spec
 */

/**
 * Calculate net realization for a farmer selling to a specific buyer or requirement
 * @param {Object} params 
 * @param {number} params.buyerPricePerKg - Gross offer by buyer
 * @param {number} params.distanceKm - Estimated distance from farm to delivery point
 * @param {number} params.transportRatePerTonKm - Transport rate (defaults to ~₹3.5/ton-km or ~₹0.0035/kg-km)
 * @param {boolean} params.buyerPicksUp - If buyer arranges and pays transport
 * @param {number} params.loadingCostPerKg - Labor and bagging cost (default ~₹0.20/kg)
 * @param {number} params.storageCostPerKg - Storage cost if produce is currently in cold store
 * @param {number} params.mandiTaxOrPlatformFeePerKg - Platform or cess fee (~₹0.10/kg)
 */
function calculateNetRealization({
  buyerPricePerKg,
  distanceKm = 30,
  transportRatePerTonKm = 3.5,
  buyerPicksUp = false,
  loadingCostPerKg = 0.20,
  storageCostPerKg = 0,
  platformFeePerKg = 0.10
}) {
  const buyerPrice = Number(buyerPricePerKg) || 0;
  
  // Transport cost per kg:
  // If buyer picks up at farm gate, transport cost to farmer is ₹0
  let transportCostPerKg = 0;
  if (!buyerPicksUp) {
    // Distance in km * (rate per ton / 1000)
    transportCostPerKg = Number(((distanceKm * transportRatePerTonKm) / 1000).toFixed(2));
  }

  const totalDeductions = Number((transportCostPerKg + loadingCostPerKg + storageCostPerKg + platformFeePerKg).toFixed(2));
  const estimatedNetRealization = Number((buyerPrice - totalDeductions).toFixed(2));

  return {
    buyerPrice,
    transportCostPerKg,
    loadingCostPerKg,
    storageCostPerKg,
    platformFeePerKg,
    totalDeductions,
    estimatedNetRealization,
    isEstimate: true,
    disclaimer: 'Estimated net realization based on indicative transport distances and local handling averages. Actual costs may vary upon dispatch.'
  };
}

/**
 * Compare "Sell Now" vs "Cold Store & Sell Later"
 * Section 24 of Product Spec
 */
function calculateStorageScenario({
  currentOfferPricePerKg = 18.0,
  expectedFuturePricePerKg = 22.5,
  storageDurationMonths = 3,
  storageChargePerMonthPerKg = 0.45, // ₹450 / ton / month
  handlingAndLoadingPerKg = 0.35,
  estimatedWeightLossPercent = 2.5 // typical physiological loss of weight (PLW) in cold storage
}) {
  const currentNet = Number(currentOfferPricePerKg.toFixed(2));
  
  const totalStorageCharge = Number((storageDurationMonths * storageChargePerMonthPerKg).toFixed(2));
  const totalIncurredCost = Number((totalStorageCharge + handlingAndLoadingPerKg).toFixed(2));
  
  // Adjusted future gross accounting for weight loss
  const effectiveFutureGross = Number((expectedFuturePricePerKg * (1 - (estimatedWeightLossPercent / 100))).toFixed(2));
  const estimatedFutureNetRealization = Number((effectiveFutureGross - totalIncurredCost).toFixed(2));
  const netGainOrLoss = Number((estimatedFutureNetRealization - currentNet).toFixed(2));

  return {
    scenarioType: 'ESTIMATED_SCENARIO',
    currentOfferPricePerKg: currentNet,
    storageDurationMonths,
    storageChargeTotal: totalStorageCharge,
    handlingCost: handlingAndLoadingPerKg,
    weightLossAllowancePercent: estimatedWeightLossPercent,
    expectedFutureGrossPerKg: expectedFuturePricePerKg,
    effectiveFutureGrossPerKg: effectiveFutureGross,
    estimatedFutureNetRealization,
    netGainOrLossPerKg: netGainOrLoss,
    recommendation: netGainOrLoss > 1.0 
      ? 'Favorable storage opportunity (+₹' + netGainOrLoss + '/kg projected gain)'
      : 'Marginal benefit. Selling now carries lower market price volatility risk.',
    disclaimer: 'Never guaranteed. Future agricultural commodity realizations fluctuate based on regional arrivals, seasonal conditions, and terminal demand.'
  };
}

module.exports = {
  calculateNetRealization,
  calculateStorageScenario
};
