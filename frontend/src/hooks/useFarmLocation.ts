import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';

export interface FarmLocationCoords {
  lat: number;
  lon: number;
}

export interface FarmLocationData {
  village: string;
  district: string;
  state: string;
  country: string;
  displayName: string;
  coords: FarmLocationCoords | null;
  source: 'gps' | 'saved_profile' | 'manual' | 'default';
}

export type LocationPermissionStatus = 'prompt' | 'granted' | 'denied' | 'unavailable' | 'loading';

const STORAGE_KEY_LOCATION = 'kisanos_farm_location';
const STORAGE_KEY_PERMISSION = 'kisanos_location_permission_state';

const DEFAULT_LOCATION: FarmLocationData = {
  village: 'Khandauli',
  district: 'Agra',
  state: 'Uttar Pradesh',
  country: 'India',
  displayName: 'Khandauli, Agra, UP',
  coords: { lat: 27.1767, lon: 78.0081 },
  source: 'default'
};

/**
 * Reverse geocode latitude/longitude to village, district, state
 * Uses BigDataCloud client reverse geocoding (fast, free, rural-friendly)
 */
async function reverseGeocodeCoords(lat: number, lon: number): Promise<{ village: string; district: string; state: string; country: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      { signal: controller.signal }
    );
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const village = data.locality || data.city || '';
      // Extract district if available in administrative hierarchy
      let district = '';
      if (Array.isArray(data.localityInfo?.administrative)) {
        const distObj = data.localityInfo.administrative.find((a: any) =>
          a.description?.toLowerCase().includes('district') || a.name?.toLowerCase().includes('district')
        );
        if (distObj) {
          district = distObj.name.replace(/ district/i, '');
        }
      }
      if (!district) {
        district = data.city || 'Agra';
      }

      const state = data.principalSubdivision || 'Uttar Pradesh';
      const country = data.countryName || 'India';

      return { village, district, state, country };
    }
  } catch (e) {
    console.warn('[useFarmLocation] Reverse geocoding fetch error:', e);
  }

  // Graceful fallback if offline
  return {
    village: '',
    district: 'Agra',
    state: 'Uttar Pradesh',
    country: 'India'
  };
}

export function useFarmLocation(user?: any) {
  const [location, setLocation] = useState<FarmLocationData>(() => {
    // 1. Check user profile if already present
    if (user?.farmerProfile?.farmLocation || user?.location) {
      const locStr = user.farmerProfile?.farmLocation || user.location;
      const parts = locStr.split(',').map((s: string) => s.trim());
      const coords = user.farmerProfile?.coordinates || null;
      return {
        village: user.village || parts[0] || 'Khandauli',
        district: user.district || parts[1] || 'Agra',
        state: user.state || parts[2] || 'Uttar Pradesh',
        country: 'India',
        displayName: locStr,
        coords: coords ? { lat: Number(coords.lat), lon: Number(coords.lon) } : { lat: 27.1767, lon: 78.0081 },
        source: 'saved_profile'
      };
    }

    // 2. Check local storage
    try {
      const cached = localStorage.getItem(STORAGE_KEY_LOCATION);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.displayName) return parsed;
      }
    } catch {}

    return DEFAULT_LOCATION;
  });

  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PERMISSION);
      if (saved === 'granted' || saved === 'denied') return saved;
    } catch {}
    return 'prompt';
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Sync when user prop loads with saved profile data
  useEffect(() => {
    if (user?.farmerProfile?.farmLocation || user?.location) {
      const locStr = user.farmerProfile?.farmLocation || user.location;
      const parts = locStr.split(',').map((s: string) => s.trim());
      const coords = user.farmerProfile?.coordinates || null;
      setLocation(prev => {
        // Only update if currently default or if profile has fresher data
        if (prev.source === 'default' || prev.source === 'saved_profile') {
          return {
            village: user.village || parts[0] || prev.village,
            district: user.district || parts[1] || prev.district,
            state: user.state || parts[2] || prev.state,
            country: 'India',
            displayName: locStr,
            coords: coords ? { lat: Number(coords.lat), lon: Number(coords.lon) } : prev.coords,
            source: 'saved_profile'
          };
        }
        return prev;
      });
    }
  }, [user]);

  /**
   * Request GPS Geolocation from browser
   */
  const requestGpsLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setPermissionStatus('unavailable');
      setErrorMessage('आपका ब्राउज़र जीपीएस लोकेशन का समर्थन नहीं करता है (Geolocation not supported).');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (!isMounted.current) return;
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        try {
          const geo = await reverseGeocodeCoords(lat, lon);
          const parts = [geo.village, geo.district, geo.state].filter(Boolean);
          const displayName = parts.length > 0 ? parts.join(', ') : `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`;

          const newLoc: FarmLocationData = {
            village: geo.village,
            district: geo.district,
            state: geo.state,
            country: geo.country,
            displayName,
            coords: { lat, lon },
            source: 'gps'
          };

          setLocation(newLoc);
          setPermissionStatus('granted');
          setIsLoading(false);

          try {
            localStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(newLoc));
            localStorage.setItem(STORAGE_KEY_PERMISSION, 'granted');
          } catch {}

          // Automatically persist to farmer profile if logged in
          if (user?.id) {
            setIsSaving(true);
            api.updateFarmerProfile({
              village: geo.village,
              district: geo.district,
              state: geo.state,
              farmLocation: displayName,
              latitude: lat,
              longitude: lon
            }).catch(err => {
              console.warn('[useFarmLocation] Auto-save profile error:', err);
            }).finally(() => {
              if (isMounted.current) setIsSaving(false);
            });
          }

        } catch (err: any) {
          if (!isMounted.current) return;
          setIsLoading(false);
          setErrorMessage('स्थान का नाम पहचानने में समस्या आई, अक्षांश/देशांतर सुरक्षित कर लिया गया है।');
        }
      },
      (error) => {
        if (!isMounted.current) return;
        setIsLoading(false);
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionStatus('denied');
          setErrorMessage('स्थान अनुमति अस्वीकृत कर दी गई है। आप नीचे से मैन्युअल रूप से अपना गांव/जिला चुन सकते हैं।');
          try {
            localStorage.setItem(STORAGE_KEY_PERMISSION, 'denied');
          } catch {}
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setPermissionStatus('unavailable');
          setErrorMessage('जीपीएस सिग्नल उपलब्ध नहीं है। कृपया मैन्युअल रूप से जिला चुनें।');
        } else if (error.code === error.TIMEOUT) {
          setPermissionStatus('unavailable');
          setErrorMessage('लोकेशन अनुरोध का समय समाप्त हो गया। कृपया पुनः प्रयास करें या मैन्युअल भरें।');
        } else {
          setPermissionStatus('unavailable');
          setErrorMessage('लोकेशन प्राप्त नहीं हो सकी। कृपया मैन्युअल चयन करें।');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 600000 // 10 minutes cache
      }
    );
  }, [user]);

  /**
   * Save a manually selected farm location
   */
  const setManualLocation = useCallback(async (details: { village: string; district: string; state: string; lat?: number; lon?: number }) => {
    setIsSaving(true);
    setErrorMessage(null);

    const parts = [details.village, details.district, details.state].filter(Boolean);
    const displayName = parts.join(', ');

    // Fallback coordinates for common districts or keep existing
    let coords: FarmLocationCoords = location.coords || { lat: 27.1767, lon: 78.0081 };
    if (details.lat && details.lon) {
      coords = { lat: details.lat, lon: details.lon };
    }

    const newLoc: FarmLocationData = {
      village: details.village,
      district: details.district,
      state: details.state,
      country: 'India',
      displayName,
      coords,
      source: 'manual'
    };

    setLocation(newLoc);
    try {
      localStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(newLoc));
    } catch {}

    if (user?.id) {
      try {
        await api.updateFarmerProfile({
          village: details.village,
          district: details.district,
          state: details.state,
          farmLocation: displayName,
          latitude: coords.lat,
          longitude: coords.lon
        });
      } catch (err: any) {
        console.warn('[useFarmLocation] Failed to save manual location in profile:', err);
      }
    }

    if (isMounted.current) {
      setIsSaving(false);
    }
  }, [user, location.coords]);

  return {
    location,
    permissionStatus,
    isLoading,
    isSaving,
    errorMessage,
    requestGpsLocation,
    setManualLocation
  };
}
