import { useState, useEffect, useMemo, useRef } from 'react';
import { api, FarmerCropRecord } from '../services/api';

/**
 * Standardize common crop names and Hindi/Hinglish aliases to canonical English names
 */
const CROP_NAME_MAPPINGS: Record<string, string> = {
  'aloo': 'Potato',
  'alu': 'Potato',
  'potato': 'Potato',
  'potatoes': 'Potato',
  'tamatar': 'Tomato',
  'tomato': 'Tomato',
  'tomatoes': 'Tomato',
  'pyaz': 'Onion',
  'pyaaz': 'Onion',
  'onion': 'Onion',
  'onions': 'Onion',
  'gehu': 'Wheat',
  'gehoon': 'Wheat',
  'wheat': 'Wheat',
  'dhan': 'Paddy',
  'dhaan': 'Paddy',
  'chawal': 'Paddy',
  'rice': 'Paddy',
  'paddy': 'Paddy',
  'sarson': 'Mustard',
  'mustard': 'Mustard',
  'makka': 'Maize',
  'makai': 'Maize',
  'corn': 'Maize',
  'maize': 'Maize',
  'chana': 'Gram',
  'gram': 'Gram',
  'chhola': 'Gram',
  'soyabean': 'Soyabean',
  'soybean': 'Soyabean',
  'kapas': 'Cotton',
  'cotton': 'Cotton',
  'ganna': 'Sugarcane',
  'sugarcane': 'Sugarcane',
  'lahsun': 'Garlic',
  'garlic': 'Garlic',
  'adrak': 'Ginger',
  'ginger': 'Ginger',
  'mirch': 'Green Chilli',
  'hari mirch': 'Green Chilli',
  'green chilli': 'Green Chilli',
  'chilli': 'Green Chilli',
  'gobhi': 'Cauliflower',
  'phool gobhi': 'Cauliflower',
  'cauliflower': 'Cauliflower',
  'patta gobhi': 'Cabbage',
  'cabbage': 'Cabbage',
  'baingan': 'Brinjal',
  'brinjal': 'Brinjal',
  'eggplant': 'Brinjal',
  'bhindi': 'Bhindi(Ladies Finger)',
  'okra': 'Bhindi(Ladies Finger)',
  'kheera': 'Cucumbar(Kheera)',
  'cucumber': 'Cucumbar(Kheera)',
  'lauki': 'Bottle gourd',
  'karela': 'Bitter gourd',
  'kaddu': 'Pumpkin',
  'palak': 'Spinach',
  'kela': 'Banana',
  'banana': 'Banana',
  'seb': 'Apple',
  'apple': 'Apple',
  'papita': 'Papaya',
  'papaya': 'Papaya'
};

export function canonicalizeCropName(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const clean = raw.trim().toLowerCase();
  if (CROP_NAME_MAPPINGS[clean]) {
    return CROP_NAME_MAPPINGS[clean];
  }
  // Title case fallback
  return raw.charAt(0).toUpperCase() + raw.slice(1).trim();
}

export function useFarmerRegisteredCrops(user?: any, listings: any[] = []) {
  const [cropRecords, setCropRecords] = useState<FarmerCropRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Fetch farmer field crop records if user is logged in
  useEffect(() => {
    if (!user?.id) return;
    let cancel = false;

    setLoading(true);
    api.getFarmerCropRecords()
      .then(res => {
        if (!cancel && isMounted.current && res.success && Array.isArray(res.crops)) {
          setCropRecords(res.crops);
        }
      })
      .catch(err => {
        // Silent fallback - user might not have added crop records yet
        console.debug('[useFarmerRegisteredCrops] crop records fetch note:', err.message);
      })
      .finally(() => {
        if (!cancel && isMounted.current) {
          setLoading(false);
        }
      });

    return () => {
      cancel = true;
    };
  }, [user?.id]);

  // Extract unique canonical registered crops across listings, crop records, and profile
  const registeredCrops = useMemo(() => {
    const rawCrops: string[] = [];

    // 1. From active or historical listings of this farmer
    if (Array.isArray(listings)) {
      listings.forEach(l => {
        if (l?.cropName) rawCrops.push(l.cropName);
        if (l?.crop_name) rawCrops.push(l.crop_name);
      });
    }

    // 2. From farmer crop records (fields)
    if (Array.isArray(cropRecords)) {
      cropRecords.forEach(c => {
        if (c?.cropName) rawCrops.push(c.cropName);
        if (c?.crop) rawCrops.push(c.crop);
      });
    }

    // 3. From user profile mainCrops
    if (Array.isArray(user?.farmerProfile?.mainCrops)) {
      rawCrops.push(...user.farmerProfile.mainCrops);
    } else if (Array.isArray(user?.mainCrops)) {
      rawCrops.push(...user.mainCrops);
    }

    // Deduplicate and canonicalize
    const canonicalSet = new Set<string>();
    rawCrops.forEach(raw => {
      const canonical = canonicalizeCropName(raw);
      if (canonical && canonical.toLowerCase() !== 'all' && canonical.toLowerCase() !== 'any') {
        canonicalSet.add(canonical);
      }
    });

    return Array.from(canonicalSet);
  }, [listings, cropRecords, user]);

  return {
    registeredCrops,
    hasCrops: registeredCrops.length > 0,
    loading
  };
}
