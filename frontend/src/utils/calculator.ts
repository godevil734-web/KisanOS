import { SAMPLE_CROPS, SampleCropItem } from '../data/sampleMarketData';

export interface TakeHomeCalculation {
  crop: SampleCropItem;
  quantityQ: number;
  distanceKm: number;
  buyerPricePerQ: number;
  transportPerQ: number;
  handlingPerQ: number;
  netPerQ: number;
  totalGross: number;
  totalTransport: number;
  totalHandling: number;
  totalNet: number;
  // Sell now vs Store comparison
  sellNowNetPerQ: number;
  sellNowTotal: number;
  storeEstCostPerQ: number;
  storeEstOffSeasonPricePerQ: number;
  storeEstNetPerQ: number;
  storeEstTotalNet: number;
  storeDownsidePricePerQ: number;
  storeDownsideNetPerQ: number;
  storeDownsideTotalNet: number;
}

/**
 * Pure calculation function for take-home realization.
 * buyer price − transport − handling = net per quintal and total.
 */
export function calculateTakeHome(
  cropId: string,
  quantityQ: number,
  distanceKm: number
): TakeHomeCalculation {
  const crop = SAMPLE_CROPS.find(c => c.id === cropId) || SAMPLE_CROPS[0];
  const qty = Math.max(1, Math.round(quantityQ || 1));
  const dist = Math.max(1, Math.round(distanceKm || 1));

  const buyerPricePerQ = crop.samplePricePerQ;

  // Transport deduction: base handling + linear distance rate (₹2.0/km/Q, min ₹40)
  const transportPerQ = Math.round(Math.max(40, 40 + dist * 2));
  
  // Standard farm-gate handling & weighment deduction: flat ₹45/Q
  const handlingPerQ = 45;

  const netPerQ = Math.max(0, buyerPricePerQ - transportPerQ - handlingPerQ);
  const totalGross = buyerPricePerQ * qty;
  const totalTransport = transportPerQ * qty;
  const totalHandling = handlingPerQ * qty;
  const totalNet = netPerQ * qty;

  // Storage comparison figures (labeled as estimates, not promises)
  const storeEstCostPerQ = 260; // Estimated 3-month cold storage rent + preservation handling
  const storeEstOffSeasonPricePerQ = Math.round(buyerPricePerQ * 1.25); // ~25% off-season benchmark
  const storeEstNetPerQ = Math.max(0, storeEstOffSeasonPricePerQ - storeEstCostPerQ - handlingPerQ - transportPerQ);
  const storeEstTotalNet = storeEstNetPerQ * qty;

  // Downside scenario: if price drops by ~10%
  const storeDownsidePricePerQ = Math.round(buyerPricePerQ * 0.90);
  const storeDownsideNetPerQ = Math.max(0, storeDownsidePricePerQ - storeEstCostPerQ - handlingPerQ - transportPerQ);
  const storeDownsideTotalNet = storeDownsideNetPerQ * qty;

  return {
    crop,
    quantityQ: qty,
    distanceKm: dist,
    buyerPricePerQ,
    transportPerQ,
    handlingPerQ,
    netPerQ,
    totalGross,
    totalTransport,
    totalHandling,
    totalNet,
    sellNowNetPerQ: netPerQ,
    sellNowTotal: totalNet,
    storeEstCostPerQ,
    storeEstOffSeasonPricePerQ,
    storeEstNetPerQ,
    storeEstTotalNet,
    storeDownsidePricePerQ,
    storeDownsideNetPerQ,
    storeDownsideTotalNet,
  };
}
