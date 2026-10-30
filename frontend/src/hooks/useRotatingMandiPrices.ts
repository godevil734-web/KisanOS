import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api, MandiPriceRecord } from '../services/api';

export interface MandiCropPriceData {
  cropName: string;
  modalPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  mandiName: string;
  district: string;
  state: string;
  marketDate: string;
  priceUnit: string;
  priceStatus: 'VERIFIED' | 'UNAVAILABLE' | 'FETCHING';
  mspBenchmark?: number | null;
  mspDiff?: number | null;
  trend?: 'up' | 'down' | 'stable' | null;
}

const ROTATION_INTERVAL_MS = 5000;
const REFRESH_INTERVAL_MS = 30000;

export function useRotatingMandiPrices(
  registeredCrops: string[] = [],
  locationState: string = 'Uttar Pradesh',
  locationDistrict: string = 'Agra'
) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [priceMap, setPriceMap] = useState<Record<string, MandiCropPriceData>>({});
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  const inFlightRef = useRef<boolean>(false);
  const isMounted = useRef<boolean>(true);

  // Keep index within bounds if registered crops array changes
  useEffect(() => {
    if (registeredCrops.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= registeredCrops.length) {
      setCurrentIndex(0);
    }
  }, [registeredCrops.length, currentIndex]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Fetch verified mandi prices for all registered crops
   * Respects in-flight locking and maintains previously fetched data
   */
  const fetchAllCropPrices = useCallback(async (isManual: boolean = false) => {
    if (registeredCrops.length === 0) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    if (isManual) setIsRefreshing(true);

    try {
      const stateToQuery = locationState || 'Uttar Pradesh';
      const districtToQuery = locationDistrict || 'Agra';

      const results: Record<string, MandiCropPriceData> = {};

      // Fetch prices in parallel for all registered crops of this farmer
      await Promise.all(
        registeredCrops.map(async (crop) => {
          try {
            const res = await api.getMandiPrices({
              state: stateToQuery,
              district: districtToQuery,
              commodity: crop,
              refresh: isManual
            });

            if (res && Array.isArray(res.records) && res.records.length > 0) {
              // Find matching record, prioritizing farmer's district if possible
              let matchedRec: MandiPriceRecord | undefined = res.records.find(
                (r: MandiPriceRecord) => (r.district || '').toLowerCase() === districtToQuery.toLowerCase()
              );
              if (!matchedRec) {
                matchedRec = res.records[0];
              }

              results[crop] = {
                cropName: crop,
                modalPrice: Number(matchedRec.modalPrice) || null,
                minPrice: Number(matchedRec.minPrice) || null,
                maxPrice: Number(matchedRec.maxPrice) || null,
                mandiName: matchedRec.market || 'सरकारी मंडी',
                district: matchedRec.district || districtToQuery,
                state: matchedRec.state || stateToQuery,
                marketDate: matchedRec.arrivalDate || res.reportDate || '30/10/2026',
                priceUnit: '₹/क्विंटल',
                priceStatus: 'VERIFIED',
                mspBenchmark: null,
                mspDiff: null,
                trend: null // Only reported when authentic historical data exists
              };
            } else {
              // No verified price found for this specific crop
              results[crop] = {
                cropName: crop,
                modalPrice: null,
                minPrice: null,
                maxPrice: null,
                mandiName: 'मंडी में आवक नहीं',
                district: districtToQuery,
                state: stateToQuery,
                marketDate: res?.reportDate || 'आज',
                priceUnit: '₹/क्विंटल',
                priceStatus: 'UNAVAILABLE'
              };
            }
          } catch (err: any) {
            console.debug(`[useRotatingMandiPrices] Price check error for ${crop}:`, err.message);
            // If already cached from earlier fetch, retain previous valid price
            results[crop] = priceMap[crop] || {
              cropName: crop,
              modalPrice: null,
              minPrice: null,
              maxPrice: null,
              mandiName: 'कनेक्शन त्रुटि',
              district: districtToQuery,
              state: stateToQuery,
              marketDate: 'अनुपलब्ध',
              priceUnit: '₹/क्विंटल',
              priceStatus: 'UNAVAILABLE'
            };
          }
        })
      );

      if (isMounted.current) {
        setPriceMap(prev => ({ ...prev, ...results }));
        setLastFetchTime(new Date());
      }
    } finally {
      inFlightRef.current = false;
      if (isMounted.current) {
        setIsRefreshing(false);
      }
    }
  }, [registeredCrops, locationState, locationDistrict, priceMap]);

  // Initial fetch and 30-second polling interval
  useEffect(() => {
    if (registeredCrops.length === 0) return;

    // Fetch immediately on mount / crop list change
    fetchAllCropPrices(false);

    // Refresh every 30 seconds while dashboard is open and visible
    const timer30s = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) {
        return; // Pause refresh when browser tab is inactive
      }
      fetchAllCropPrices(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(timer30s);
    };
  }, [registeredCrops, locationState, locationDistrict, fetchAllCropPrices]);

  // 5-second rotation timer (Separated strictly from network fetching!)
  useEffect(() => {
    if (registeredCrops.length <= 1) return;

    const timer5s = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) {
        return; // Pause rotation when browser tab is inactive
      }
      setCurrentIndex(prev => (prev + 1) % registeredCrops.length);
    }, ROTATION_INTERVAL_MS);

    return () => {
      clearInterval(timer5s);
    };
  }, [registeredCrops.length]);

  // Current crop and its mandi data
  const currentCrop = registeredCrops[currentIndex] || '';
  const currentPriceData: MandiCropPriceData | null = useMemo(() => {
    if (!currentCrop) return null;
    return priceMap[currentCrop] || {
      cropName: currentCrop,
      modalPrice: null,
      minPrice: null,
      maxPrice: null,
      mandiName: 'लोड हो रहा है...',
      district: locationDistrict,
      state: locationState,
      marketDate: 'आज',
      priceUnit: '₹/क्विंटल',
      priceStatus: 'FETCHING'
    };
  }, [currentCrop, priceMap, locationDistrict, locationState]);

  // Manual navigation controls
  const nextCrop = useCallback(() => {
    if (registeredCrops.length <= 1) return;
    setCurrentIndex(prev => (prev + 1) % registeredCrops.length);
  }, [registeredCrops.length]);

  const prevCrop = useCallback(() => {
    if (registeredCrops.length <= 1) return;
    setCurrentIndex(prev => (prev - 1 + registeredCrops.length) % registeredCrops.length);
  }, [registeredCrops.length]);

  const selectCrop = useCallback((index: number) => {
    if (index >= 0 && index < registeredCrops.length) {
      setCurrentIndex(index);
    }
  }, [registeredCrops.length]);

  return {
    currentIndex,
    totalCrops: registeredCrops.length,
    currentCrop,
    currentPriceData,
    priceMap,
    isRefreshing,
    lastFetchTime,
    nextCrop,
    prevCrop,
    selectCrop,
    refreshPrices: () => fetchAllCropPrices(true)
  };
}
