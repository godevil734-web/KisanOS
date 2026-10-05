/**
 * Hyperlocal Weather Service using Open-Meteo API
 * Zero-friction background weather fetch for rural farmers.
 * Defaults to Agra / Western UP coordinates: lat 27.1767, lon 78.0081
 */

const FALLBACK_WEATHER = {
  temperature: 28,
  humidity: 65,
  soilMoisture: 42,
  windSpeedKmh: 8,
  source: 'SEASONAL_ESTIMATE_FALLBACK'
};

async function getHyperlocalWeather(lat = 27.1767, lon = 78.0081) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[WEATHER] Open-Meteo HTTP ${res.status}, using seasonal fallback`);
      return FALLBACK_WEATHER;
    }

    const data = await res.json();
    const current = data.current || {};

    return {
      temperature: Math.round(current.temperature_2m ?? 28),
      humidity: Math.round(current.relative_humidity_2m ?? 65),
      soilMoisture: 42, // Optimal benchmark for irrigated Western UP soils
      windSpeedKmh: Math.round(current.wind_speed_10m ?? 8),
      pressureHpa: Math.round(current.surface_pressure ?? 1010),
      source: 'OPEN_METEO_LIVE',
      fetchedAt: new Date().toISOString()
    };
  } catch (err) {
    console.warn('[WEATHER] Open-Meteo timeout or network error, applying fallback:', err.message);
    return FALLBACK_WEATHER;
  }
}

module.exports = {
  getHyperlocalWeather,
  FALLBACK_WEATHER
};
