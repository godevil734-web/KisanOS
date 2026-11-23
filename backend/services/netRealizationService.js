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

const COMMODITY_SYNONYMS = {
  potato: ['potato', 'aalu', 'alu', 'potatoes'],
  tomato: ['tomato', 'tamatar', 'tomatoes'],
  onion: ['onion', 'pyaz', 'piaz', 'onions'],
  wheat: ['wheat', 'gehu', 'gehun'],
  mustard: ['mustard', 'sarson', 'rai'],
  rice: ['rice', 'paddy', 'dhan', 'paddy(common)'],
  paddy: ['paddy', 'dhan', 'rice', 'paddy(common)'],
  maize: ['maize', 'makka', 'corn'],
  cotton: ['cotton', 'kapas'],
  soybean: ['soybean', 'soyabean'],
  chilli: ['chilli', 'chili', 'mirch', 'chili red'],
  garlic: ['garlic', 'lahsun'],
  ginger: ['ginger', 'adrak', 'ginger(green)']
};

/**
 * Fetch live Mandi modal benchmark price and authentic APMC deductions
 * @param {Object} params
 * @param {string} params.cropName
 * @param {string} [params.state]
 * @param {string} [params.district]
 */
async function getMandiModalBenchmark({ cropName, state = 'Uttar Pradesh', district = null }) {
  const { pool } = require('../db');

  if (!cropName) {
    return { available: false, reason: 'Crop name is required' };
  }

  const cleanCrop = cropName.trim().toLowerCase();
  let searchTerms = [cleanCrop];
  for (const [canonical, syns] of Object.entries(COMMODITY_SYNONYMS)) {
    if (syns.some(s => cleanCrop.includes(s) || s.includes(cleanCrop))) {
      searchTerms = [...new Set([canonical, ...syns, cleanCrop])];
      break;
    }
  }

  const ilikeClauses = searchTerms.map((_, i) => `rec->>'commodity' ILIKE $${i + 2}`).join(' OR ');
  const params = [state || 'Uttar Pradesh', ...searchTerms.map(t => `%${t}%`)];

  let query = `
    SELECT 
      rec->>'commodity' as commodity,
      rec->>'market' as market,
      rec->>'district' as district,
      rec->>'state' as state,
      rec->>'modalPrice' as modal_price,
      rec->>'modalPricePerKg' as modal_price_per_kg,
      rec->>'minPricePerKg' as min_price_per_kg,
      rec->>'maxPricePerKg' as max_price_per_kg,
      rec->>'arrivalDate' as arrival_date
    FROM mandi_price_snapshots,
    LATERAL jsonb_array_elements(data->'records') rec
    WHERE (state ILIKE $1 OR $1 IS NULL)
      AND (${ilikeClauses})
  `;

  if (district && district.trim()) {
    params.push(`%${district.trim()}%`);
    query += ` ORDER BY CASE WHEN rec->>'district' ILIKE $${params.length} THEN 0 ELSE 1 END, rec->>'arrivalDate' DESC LIMIT 5`;
  } else {
    query += ` ORDER BY rec->>'arrivalDate' DESC LIMIT 5`;
  }

  try {
    const { rows } = await pool.query(query, params);

    let bestMatch = rows && rows.length > 0 ? rows[0] : null;

    if (!bestMatch) {
      const fbParams = searchTerms.map(t => `%${t}%`);
      const fbClauses = searchTerms.map((_, i) => `rec->>'commodity' ILIKE $${i + 1}`).join(' OR ');
      const fbQuery = `
        SELECT 
          rec->>'commodity' as commodity,
          rec->>'market' as market,
          rec->>'district' as district,
          rec->>'state' as state,
          rec->>'modalPrice' as modal_price,
          rec->>'modalPricePerKg' as modal_price_per_kg,
          rec->>'minPricePerKg' as min_price_per_kg,
          rec->>'maxPricePerKg' as max_price_per_kg,
          rec->>'arrivalDate' as arrival_date
        FROM mandi_price_snapshots,
        LATERAL jsonb_array_elements(data->'records') rec
        WHERE (${fbClauses})
        ORDER BY rec->>'arrivalDate' DESC LIMIT 1
      `;
      const fbRes = await pool.query(fbQuery, fbParams);
      if (fbRes.rows && fbRes.rows.length > 0) {
        bestMatch = fbRes.rows[0];
      }
    }

    if (!bestMatch) {
      return { available: false, reason: `No mandi snapshot found for ${cropName}` };
    }

    const modalPricePerKg = Number(bestMatch.modal_price_per_kg) || (Number(bestMatch.modal_price) / 100) || 15.0;
    const minPricePerKg = Number(bestMatch.min_price_per_kg) || modalPricePerKg * 0.92;
    const maxPricePerKg = Number(bestMatch.max_price_per_kg) || modalPricePerKg * 1.08;

    // Authentic APMC Mandi Deductions:
    const apmcCessPerKg = Number((modalPricePerKg * 0.015).toFixed(2));
    const transportToMandiPerKg = 0.10;
    const hammaliLoadingPerKg = 0.25;
    const weighmentPerKg = 0.05;

    const totalMandiDeductionsPerKg = Number((apmcCessPerKg + transportToMandiPerKg + hammaliLoadingPerKg + weighmentPerKg).toFixed(2));
    const netMandiRealizationPerKg = Number((modalPricePerKg - totalMandiDeductionsPerKg).toFixed(2));

    return {
      available: true,
      commodity: bestMatch.commodity,
      market: bestMatch.market,
      district: bestMatch.district,
      state: bestMatch.state,
      arrivalDate: bestMatch.arrival_date,
      modalPricePerKg: Number(modalPricePerKg.toFixed(2)),
      minPricePerKg: Number(minPricePerKg.toFixed(2)),
      maxPricePerKg: Number(maxPricePerKg.toFixed(2)),
      mandiDeductions: {
        transportToMandiPerKg,
        apmcCessPerKg,
        hammaliLoadingPerKg,
        weighmentPerKg,
        totalMandiDeductionsPerKg
      },
      netMandiRealizationPerKg
    };
  } catch (err) {
    console.error('[MANDI BENCHMARK] Query error:', err.message);
    return { available: false, reason: err.message };
  }
}

/**
 * 3-Way Comparative Decision Support:
 * Farm-Gate Direct vs Local Mandi Spot vs Cold Store & Deferred Sale
 */
async function calculateFarmer3WayComparison({
  buyerPricePerKg = 18.0,
  cropName = 'Potato',
  state = 'Uttar Pradesh',
  district = null,
  distanceKm = 30,
  buyerPicksUp = false,
  storageDurationMonths = 3,
  coldStorageId = null,
  quantityKg = 1000
}) {
  const { pool } = require('../db');

  // 1. Direct Farm-Gate Realization
  const directRealization = calculateNetRealization({
    buyerPricePerKg,
    distanceKm,
    buyerPicksUp
  });
  const directNetPerKg = directRealization.estimatedNetRealization;
  const directTotalNet = Number((directNetPerKg * (quantityKg || 1000)).toFixed(2));

  // 2. Mandi Modal Benchmark
  const mandiBenchmark = await getMandiModalBenchmark({ cropName, state, district });
  let mandiNetPerKg = 0;
  let mandiTotalNet = 0;
  let spreadDirectVsMandiPerKg = 0;
  let spreadDirectVsMandiPercent = 0;

  if (mandiBenchmark.available) {
    mandiNetPerKg = mandiBenchmark.netMandiRealizationPerKg;
    mandiTotalNet = Number((mandiNetPerKg * (quantityKg || 1000)).toFixed(2));
    spreadDirectVsMandiPerKg = Number((directNetPerKg - mandiNetPerKg).toFixed(2));
    spreadDirectVsMandiPercent = mandiNetPerKg > 0 
      ? Number(((spreadDirectVsMandiPerKg / mandiNetPerKg) * 100).toFixed(1))
      : 0;
  }

  // 3. Cold Store & Deferred Sale
  let storageChargePerMonthPerKg = 0.45;
  let coldStoreName = 'Regional Cold Storage (Agra Cluster)';

  if (coldStorageId) {
    try {
      const csRes = await pool.query('SELECT name, storage_charge_per_month_per_ton FROM cold_storages WHERE id = $1', [coldStorageId]);
      if (csRes.rows && csRes.rows.length > 0) {
        coldStoreName = csRes.rows[0].name;
        const perTon = Number(csRes.rows[0].storage_charge_per_month_per_ton) || 450;
        storageChargePerMonthPerKg = Number((perTon / 1000).toFixed(3));
      }
    } catch (e) {
      // fallback
    }
  }

  const basePriceForProjection = mandiBenchmark.available ? mandiBenchmark.modalPricePerKg : Number(buyerPricePerKg || 18);
  const expectedFuturePricePerKg = Number((basePriceForProjection * 1.25).toFixed(2));

  const storageScenario = calculateStorageScenario({
    currentOfferPricePerKg: directNetPerKg,
    expectedFuturePricePerKg,
    storageDurationMonths,
    storageChargePerMonthPerKg,
    handlingAndLoadingPerKg: 0.35,
    estimatedWeightLossPercent: 2.5
  });

  const storageNetPerKg = storageScenario.estimatedFutureNetRealization;
  const storageTotalNet = Number((storageNetPerKg * (quantityKg || 1000)).toFixed(2));
  const gainVsDirectPerKg = Number((storageNetPerKg - directNetPerKg).toFixed(2));

  return {
    cropName,
    state,
    district,
    quantityKg: Number(quantityKg) || 1000,
    options: {
      direct: {
        label: 'Farm Gate Direct (KisanOS Contract)',
        grossPricePerKg: Number(Number(buyerPricePerKg).toFixed(2)),
        buyerPicksUp,
        deductions: {
          transport: directRealization.transportCostPerKg,
          loading: directRealization.loadingCostPerKg,
          platformFee: directRealization.platformFeePerKg,
          total: directRealization.totalDeductions
        },
        netRealizationPerKg: directNetPerKg,
        totalNetValue: directTotalNet,
        paymentTerms: 'Escrow Secured / Fast Settlement'
      },
      mandiSpot: {
        label: 'Local APMC Mandi Spot',
        available: mandiBenchmark.available,
        market: mandiBenchmark.market,
        district: mandiBenchmark.district,
        arrivalDate: mandiBenchmark.arrivalDate,
        grossPricePerKg: mandiBenchmark.modalPricePerKg || 0,
        minPricePerKg: mandiBenchmark.minPricePerKg || 0,
        maxPricePerKg: mandiBenchmark.maxPricePerKg || 0,
        deductions: mandiBenchmark.mandiDeductions || {},
        netRealizationPerKg: mandiNetPerKg,
        totalNetValue: mandiTotalNet,
        spreadVsDirectPerKg: spreadDirectVsMandiPerKg,
        spreadVsDirectPercent: spreadDirectVsMandiPercent
      },
      coldStorage: {
        label: `Store & Deferred Sale (${storageDurationMonths} Months Carry)`,
        facilityName: coldStoreName,
        storageDurationMonths,
        monthlyChargePerKg: storageChargePerMonthPerKg,
        totalStorageChargePerKg: storageScenario.storageChargeTotal,
        handlingPerKg: storageScenario.handlingCost,
        weightLossPercent: storageScenario.weightLossAllowancePercent,
        projectedGrossFuturePricePerKg: expectedFuturePricePerKg,
        effectiveFutureGrossPerKg: storageScenario.effectiveFutureGrossPerKg,
        netRealizationPerKg: storageNetPerKg,
        totalNetValue: storageTotalNet,
        netGainOrLossVsDirectPerKg: gainVsDirectPerKg,
        recommendation: storageScenario.recommendation
      }
    },
    synthesis: {
      bestOption: storageNetPerKg > directNetPerKg && storageNetPerKg > mandiNetPerKg
        ? 'COLD_STORAGE'
        : directNetPerKg >= mandiNetPerKg ? 'DIRECT_SALE' : 'MANDI_SPOT',
      summaryHi: directNetPerKg >= mandiNetPerKg
        ? `सीधे KisanOS पर बेचने से आपको स्थानीय मंडी की तुलना में ₹${spreadDirectVsMandiPerKg}/kg (+${spreadDirectVsMandiPercent}%) अधिक शुद्ध आय प्राप्त होगी।`
        : `स्थानीय मंडी भाव वर्तमान में अधिक है।`,
      summaryEn: directNetPerKg >= mandiNetPerKg
        ? `Selling direct on KisanOS yields ₹${spreadDirectVsMandiPerKg}/kg (+${spreadDirectVsMandiPercent}%) higher net in-hand realization than local APMC mandi spot.`
        : `Local Mandi spot is currently yielding higher net price.`
    }
  };
}

module.exports = {
  calculateNetRealization,
  calculateStorageScenario,
  getMandiModalBenchmark,
  calculateFarmer3WayComparison
};
