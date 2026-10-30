import { useState, useEffect, useCallback, useRef } from 'react';
import { api, FarmWeatherResponse } from '../services/api';

const WEATHER_CACHE_KEY = 'kisanos_cached_farm_weather';

export function useFarmWeather(lat: number = 27.1767, lon: number = 78.0081, locationName?: string) {
  const [weather, setWeather] = useState<FarmWeatherResponse | null>(() => {
    try {
      const cached = localStorage.getItem(WEATHER_CACHE_KEY);
      if (cached) {
        const parsed: FarmWeatherResponse = JSON.parse(cached);
        return {
          ...parsed,
          isStale: true,
          staleReason: 'पहले से लोड किया गया डेटा (Cached snapshot)'
        };
      }
    } catch {}
    return null;
  });

  const [loading, setLoading] = useState<boolean>(!weather);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(weather?.fetchedAt ? new Date(weather.fetchedAt) : null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchWeather = useCallback(async (isManualRefresh: boolean = false) => {
    if (isManualRefresh) {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await api.getWeatherForecast({ lat, lon });
      if (!isMounted.current) return;

      if (data && data.current) {
        setWeather(data);
        setLastUpdated(new Date());
        try {
          localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
        } catch {}
      } else {
        throw new Error('अमान्य मौसम डेटा प्राप्त हुआ (Invalid weather response)');
      }
    } catch (err: any) {
      if (!isMounted.current) return;
      console.warn('[useFarmWeather] Fetch error:', err.message);
      setError(err.message || 'मौसम डेटा लोड करने में असमर्थ');

      // Keep previous valid data marked as stale if available
      setWeather(prev => {
        if (prev) {
          return {
            ...prev,
            isStale: true,
            staleReason: 'नेटवर्क समस्या के कारण पुराना मान्य डेटा दिखाया जा रहा है'
          };
        }
        return null;
      });
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [lat, lon]);

  // Fetch when lat/lon changes
  useEffect(() => {
    fetchWeather(false);
  }, [fetchWeather]);

  return {
    weather,
    loading,
    error,
    isStale: weather?.isStale || false,
    staleReason: weather?.staleReason,
    lastUpdated,
    refreshWeather: () => fetchWeather(true)
  };
}
