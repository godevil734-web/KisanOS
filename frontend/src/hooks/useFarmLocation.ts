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
  source: 'gps' | 'saved_profile' | 'manual' | 'default' | 'ip';
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

function isDummyAgraDemo(loc?: any): boolean {
  if (!loc) return false;
  const str = typeof loc === 'string' ? loc.toLowerCase() : (loc.displayName || loc.farmLocation || loc.location || '').toLowerCase();
  return str.includes('khandauli') || (str.includes('agra') && !str.includes('firozabad') && !str.includes('fatehabad'));
}

/**
 * High-reliability reverse geocoding:
 * Calls KisanOS backend API /api/location/reverse-geocode first (immune to browser CSP),
 * with client fallbacks if offline.
 */
async function reverseGeocodeCoords(lat: number, lon: number): Promise<{ village: string; district: string; state: string; country: string; displayName: string }> {
  // 1. Call KisanConnect backend reverse-geocode (fast, same-origin, bypasses browser CSP)
  try {
    const res = await api.reverseGeocode(lat, lon);
    if (res?.success && res.location) {
      return {
        village: res.location.village || '',
        district: res.location.district || 'Agra',
        state: res.location.state || 'Uttar Pradesh',
        country: res.location.country || 'India',
        displayName: res.location.displayName || `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`
      };
    }
  } catch (backendErr) {
    console.warn('[useFarmLocation] Backend reverse geocode failed, trying client fallback:', backendErr);
  }

  // 2. Client fallback via BigDataCloud
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      { signal: controller.signal }
    );
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const village = data.locality || data.city || '';
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
      const parts = [village, district, state].filter(Boolean);
      const displayName = parts.length > 0 ? parts.join(', ') : `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`;

      return { village, district, state, country, displayName };
    }
  } catch (e) {
    console.warn('[useFarmLocation] Client reverse geocoding fetch error:', e);
  }

  // 3. Graceful fallback
  return {
    village: '',
    district: 'Agra',
    state: 'Uttar Pradesh',
    country: 'India',
    displayName: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`
  };
}

export function useFarmLocation(user?: any) {
  const [location, setLocation] = useState<FarmLocationData>(() => {
    // 1. Check local storage FIRST if user previously set or detected a real location
    try {
      const cached = localStorage.getItem(STORAGE_KEY_LOCATION);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.displayName && parsed?.coords?.lat && parsed?.coords?.lon && parsed.source && parsed.source !== 'default' && !isDummyAgraDemo(parsed)) {
          return parsed;
        }
      }
    } catch {}

    // 2. Check user profile if present and NOT dummy demo location
    if (user?.farmerProfile?.farmLocation || user?.location) {
      const locStr = user.farmerProfile?.farmLocation || user.location;
      if (!isDummyAgraDemo(locStr)) {
        const parts = locStr.split(',').map((s: string) => s.trim());
        const coords = user.farmerProfile?.coordinates || null;
        return {
          village: user.village || parts[0] || '',
          district: user.district || parts[1] || 'Agra',
          state: user.state || parts[2] || 'Uttar Pradesh',
          country: 'India',
          displayName: locStr,
          coords: coords ? { lat: Number(coords.lat), lon: Number(coords.lon) } : { lat: 27.1767, lon: 78.0081 },
          source: 'saved_profile'
        };
      }
    }

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

  // Sync when user prop loads with saved profile data (only if not dummy demo location)
  useEffect(() => {
    if (user?.farmerProfile?.farmLocation || user?.location) {
      const locStr = user.farmerProfile?.farmLocation || user.location;
      if (!isDummyAgraDemo(locStr)) {
        const parts = locStr.split(',').map((s: string) => s.trim());
        const coords = user.farmerProfile?.coordinates || null;
        setLocation(prev => {
          if (prev.source === 'default' || prev.source === 'ip') {
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
    }
  }, [user]);

  /**
   * Helper: perform IP / Edge detection fallback
   */
  const detectIpLocation = useCallback(async (): Promise<boolean> => {
    try {
      const res = await api.detectLocation();
      if (!isMounted.current) return false;
      if (res?.success && res.location?.coords) {
        const detectedLoc: FarmLocationData = {
          village: res.location.village || '',
          district: res.location.district || 'Agra',
          state: res.location.state || 'Uttar Pradesh',
          country: res.location.country || 'India',
          displayName: res.location.displayName,
          coords: res.location.coords,
          source: 'ip'
        };
        setLocation(detectedLoc);
        try {
          localStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(detectedLoc));
        } catch {}
        return true;
      }
    } catch (e) {
      console.warn('[useFarmLocation] IP detect failed:', e);
    }
    return false;
  }, []);

  /**
   * Request GPS Geolocation from browser
   * If GPS times out, fails, or is denied, AUTOMATICALLY falls back to IP/Edge detection!
   */
  const requestGpsLocation = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    // If browser doesn't support geolocation at all, use IP
    if (!navigator.geolocation) {
      const ipSuccess = await detectIpLocation();
      if (!isMounted.current) return;
      setIsLoading(false);
      if (!ipSuccess) {
        setErrorMessage('स्थान प्राप्त नहीं हो सका। कृपया मैन्युअल रूप से अपना जिला चुनें।');
      }
      return;
    }

    let resolved = false;

    // Timeout safety timer
    const safetyTimer = setTimeout(async () => {
      if (!resolved && isMounted.current) {
        console.warn('[useFarmLocation] GPS wait threshold reached, triggering edge IP fallback');
        const ipSuccess = await detectIpLocation();
        if (isMounted.current) {
          setIsLoading(false);
          if (ipSuccess) {
            setErrorMessage(null);
          }
        }
      }
    }, 4500);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        resolved = true;
        clearTimeout(safetyTimer);
        if (!isMounted.current) return;
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        try {
          const geo = await reverseGeocodeCoords(lat, lon);
          const newLoc: FarmLocationData = {
            village: geo.village,
            district: geo.district,
            state: geo.state,
            country: geo.country,
            displayName: geo.displayName,
            coords: { lat, lon },
            source: 'gps'
          };

          setLocation(newLoc);
          setPermissionStatus('granted');
          setIsLoading(false);
          setErrorMessage(null);

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
              farmLocation: geo.displayName,
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
          await detectIpLocation();
          setIsLoading(false);
        }
      },
      async (error) => {
        resolved = true;
        clearTimeout(safetyTimer);
        if (!isMounted.current) return;

        console.warn('[useFarmLocation] Geolocation error:', error.message, 'Falling back to IP detection');
        // When GPS permission is denied or times out, ALWAYS automatically fallback to IP!
        const ipSuccess = await detectIpLocation();
        setIsLoading(false);

        if (ipSuccess) {
          setErrorMessage(null);
        } else {
          if (error.code === error.PERMISSION_DENIED) {
            setPermissionStatus('denied');
            setErrorMessage('स्थान अनुमति अस्वीकृत है। नीचे त्वरित बटन से अपना जिला चुनें।');
          } else {
            setPermissionStatus('unavailable');
            setErrorMessage('जीपीएस सिग्नल उपलब्ध नहीं है। नीचे से अपना जिला चुनें।');
          }
        }
      },
      {
        enableHighAccuracy: false, // Allows instantaneous WiFi / cell-tower / CoreLocation position without waiting for satellite fix
        timeout: 4000,
        maximumAge: 300000
      }
    );
  }, [user, detectIpLocation]);

  /**
   * Automatic background location detection on initial mount
   * If location is default demo or dummy Agra, detect real location!
   */
  useEffect(() => {
    let cancel = false;
    const needsDetection =
      location.source === 'default' ||
      isDummyAgraDemo(location) ||
      !location.coords;

    if (needsDetection) {
      // First try silent fast geolocation if browser already granted permission
      if (navigator.geolocation && permissionStatus === 'granted') {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            if (cancel || !isMounted.current) return;
            const geo = await reverseGeocodeCoords(pos.coords.latitude, pos.coords.longitude);
            const newLoc: FarmLocationData = {
              village: geo.village,
              district: geo.district,
              state: geo.state,
              country: geo.country,
              displayName: geo.displayName,
              coords: { lat: pos.coords.latitude, lon: pos.coords.longitude },
              source: 'gps'
            };
            setLocation(newLoc);
            try {
              localStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(newLoc));
            } catch {}
          },
          () => {
            if (!cancel && isMounted.current) {
              detectIpLocation();
            }
          },
          { enableHighAccuracy: false, timeout: 3000, maximumAge: 300000 }
        );
      } else {
        // Run edge IP detection
        detectIpLocation();
      }
    }
    return () => {
      cancel = true;
    };
  }, [detectIpLocation]);

  /**
   * Save a manually selected farm location
   * Geocodes district/state to real coordinates so weather forecast updates accurately!
   */
  const setManualLocation = useCallback(async (details: { village: string; district: string; state: string; lat?: number; lon?: number }) => {
    setIsSaving(true);
    setErrorMessage(null);

    const parts = [details.village, details.district, details.state].filter(Boolean);
    const displayName = parts.join(', ');

    // 1. Resolve coordinates from explicit input or via backend geocoding API
    let coords: FarmLocationCoords = location.coords || { lat: 27.1767, lon: 78.0081 };
    if (details.lat && details.lon) {
      coords = { lat: details.lat, lon: details.lon };
    } else {
      try {
        const queryStr = [details.village, details.district, details.state].filter(Boolean).join(', ');
        const geoRes = await api.geocodeLocation(queryStr);
        if (geoRes?.success && geoRes.location?.coords) {
          coords = geoRes.location.coords;
        }
      } catch (err) {
        console.warn('[useFarmLocation] Geocoding manual location error, using closest benchmark:', err);
      }
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
