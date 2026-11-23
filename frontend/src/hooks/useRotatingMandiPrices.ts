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

export function useRotatingMandiPrices(
  registeredCrops: string[] = [],
  locationState: string = 'Uttar Pradesh',
  locationDistrict: string = 'Agra'
) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [priceMap, setPriceMap] = useState<Record<string, MandiCropPriceData>>({});
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  const inFlightRef = useRef<boolean>(false);
  const isMounted = useRef<boolean>(true);
  const hasInitializedRef = useRef<boolean>(false);

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
    if (isManual) {
      setIsRefreshing(true);
      setRefreshError(null);
    }

    try {
      const stateToQuery = locationState || 'Uttar Pradesh';
      const districtToQuery = locationDistrict || 'Agra';

      const results: Record<string, MandiCropPriceData> = {};
      let anyErrorOccurred = false;

      // Fetch prices in 1 single unified call for the state & district instead of hammering N parallel requests
      const res = await api.getMandiPrices({
        state: stateToQuery,
        district: districtToQuery === 'all' ? undefined : districtToQuery,
        refresh: isManual
      }).catch(err => {
        console.debug('[useRotatingMandiPrices] Unified fetch error, retrying with state only:', err.message);
        return api.getMandiPrices({ state: stateToQuery }).catch(() => null);
      });

      const allRecords: MandiPriceRecord[] = (res && Array.isArray(res.records)) ? res.records : [];
      const reportDate = res?.reportDate || 'आज';

      for (const crop of registeredCrops) {
        const cropLower = crop.toLowerCase().trim();
        // Match by commodity name or variety, prioritizing farmer's district
        let matchedRec: MandiPriceRecord | undefined = allRecords.find(
          (r: MandiPriceRecord) =>
            (r.commodity || '').toLowerCase().includes(cropLower) &&
            (r.district || '').toLowerCase() === districtToQuery.toLowerCase()
        );

        if (!matchedRec) {
          matchedRec = allRecords.find((r: MandiPriceRecord) =>
            (r.commodity || '').toLowerCase().includes(cropLower)
          );
        }

        if (matchedRec) {
          results[crop] = {
            cropName: crop,
            modalPrice: Number(matchedRec.modalPrice) || null,
            minPrice: Number(matchedRec.minPrice) || null,
            maxPrice: Number(matchedRec.maxPrice) || null,
            mandiName: matchedRec.market || 'सरकारी मंडी',
            district: matchedRec.district || districtToQuery,
            state: matchedRec.state || stateToQuery,
            marketDate: matchedRec.arrivalDate || reportDate,
            priceUnit: '₹/क्विंटल',
            priceStatus: 'VERIFIED',
            mspBenchmark: null,
            mspDiff: null,
            trend: null
          };
        } else {
          results[crop] = priceMap[crop] || {
            cropName: crop,
            modalPrice: null,
            minPrice: null,
            maxPrice: null,
            mandiName: 'मंडी में आवक नहीं',
            district: districtToQuery,
            state: stateToQuery,
            marketDate: reportDate,
            priceUnit: '₹/क्विंटल',
            priceStatus: 'UNAVAILABLE'
          };
        }
      }

      if (isMounted.current) {
        setPriceMap(prev => ({ ...prev, ...results }));
        setLastFetchTime(new Date());
        if (anyErrorOccurred && isManual) {
          setRefreshError('कुछ फसलों के ताज़ा भाव लोड नहीं हो सके, पिछले भाव सुरक्षित हैं।');
        } else if (isManual) {
          setRefreshError(null);
        }
      }
    } catch (err: any) {
      if (isMounted.current && isManual) {
        setRefreshError('मंडी भाव रीफ्रेश करने में असमर्थ। पूर्व भाव सुरक्षित हैं।');
      }
    } finally {
      inFlightRef.current = false;
      if (isMounted.current) {
        setIsRefreshing(false);
      }
    }
  }, [registeredCrops, locationState, locationDistrict, priceMap]);

  // Fetch ONCE on farmer login / dashboard initialization (NO 30s background polling)
  useEffect(() => {
    if (registeredCrops.length === 0) return;
    if (hasInitializedRef.current) return;

    hasInitializedRef.current = true;
    fetchAllCropPrices(false);
  }, [registeredCrops, fetchAllCropPrices]);

  // 5-second rotation timer (Cycles through existing in-memory price map with ZERO API requests)
  useEffect(() => {
    if (registeredCrops.length <= 1) return;

    const timer5s = setInterval(() => {
      // Pause rotation when browser tab is inactive or hidden
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      setCurrentIndex(prev => (prev + 1) % registeredCrops.length);
    }, ROTATION_INTERVAL_MS);

    return () => {
      clearInterval(timer5s);
    };
  }, [registeredCrops.length]);

  // Current crop and its mandi data (read purely from in-memory priceMap)
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
    refreshError,
    lastFetchTime,
    nextCrop,
    prevCrop,
    selectCrop,
    refreshPrices: () => fetchAllCropPrices(true)
  };
}
