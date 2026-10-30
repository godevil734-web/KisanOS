/**
 * Hyperlocal Weather & Agricultural Forecast Service using Open-Meteo API
 * Zero-friction background weather fetch & farm intelligence for rural farmers.
 * Defaults to Agra / Western UP coordinates: lat 27.1767, lon 78.0081
 */

const FALLBACK_WEATHER = {
  temperature: 28,
  humidity: 65,
  soilMoisture: 42,
  windSpeedKmh: 8,
  condition: 'साफ आसमान',
  conditionEn: 'Clear sky',
  icon: '☀️',
  precipitationMm: 0,
  source: 'SEASONAL_ESTIMATE_FALLBACK',
  fetchedAt: new Date().toISOString()
};

// In-memory forecast cache (TTL = 10 minutes)
const forecastCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * WMO Weather interpretation codes
 */
function interpretWeatherCode(code) {
  const c = Number(code);
  if (c === 0) return { en: 'Clear sky', hi: 'साफ आसमान', icon: '☀️' };
  if (c === 1) return { en: 'Mainly clear', hi: 'मुख्यतः साफ', icon: '🌤️' };
  if (c === 2) return { en: 'Partly cloudy', hi: 'आंशिक बादल', icon: '⛅' };
  if (c === 3) return { en: 'Overcast', hi: 'घने बादल', icon: '☁️' };
  if (c === 45 || c === 48) return { en: 'Fog / Mist', hi: 'कोहरा / धुंध', icon: '🌫️' };
  if (c === 51 || c === 53 || c === 55) return { en: 'Light Drizzle', hi: 'हल्की बूंदाबांदी', icon: '🌦️' };
  if (c === 56 || c === 57) return { en: 'Freezing Drizzle', hi: 'शीत बूंदाबांदी', icon: '❄️' };
  if (c === 61 || c === 63) return { en: 'Moderate Rain', hi: 'हल्की से मध्यम बारिश', icon: '🌧️' };
  if (c === 65) return { en: 'Heavy Rain', hi: 'भारी बारिश', icon: '🌧️' };
  if (c === 71 || c === 73 || c === 75) return { en: 'Snowfall', hi: 'बर्फबारी', icon: '❄️' };
  if (c === 77) return { en: 'Snow grains', hi: 'ओले / हिम कण', icon: '🌨️' };
  if (c === 80 || c === 81) return { en: 'Rain Showers', hi: 'बारिश की बौछारें', icon: '🌦️' };
  if (c === 82) return { en: 'Violent Showers', hi: 'तूफानी बौछारें', icon: '⛈️' };
  if (c === 95) return { en: 'Thunderstorm', hi: 'गरज-चमक के साथ तूफान', icon: '⛈️' };
  if (c === 96 || c === 99) return { en: 'Thunderstorm with Hail', hi: 'ओलावृष्टि के साथ आंधी', icon: '⛈️' };
  return { en: 'Fair', hi: 'सामान्य मौसम', icon: '🌤️' };
}

/**
 * Get simple current hyperlocal weather (used by field logs and legacy endpoints)
 */
async function getHyperlocalWeather(lat = 27.1767, lon = 78.0081) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,precipitation,weather_code`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[WEATHER] Open-Meteo HTTP ${res.status}, using seasonal fallback`);
      return FALLBACK_WEATHER;
    }

    const data = await res.json();
    const current = data.current || {};
    const weatherInfo = interpretWeatherCode(current.weather_code ?? 0);

    return {
      temperature: Math.round(current.temperature_2m ?? 28),
      humidity: Math.round(current.relative_humidity_2m ?? 65),
      soilMoisture: 42, // Optimal benchmark for irrigated Indo-Gangetic plains
      windSpeedKmh: Math.round(current.wind_speed_10m ?? 8),
      pressureHpa: Math.round(current.surface_pressure ?? 1010),
      precipitationMm: current.precipitation ?? 0,
      condition: weatherInfo.hi,
      conditionEn: weatherInfo.en,
      icon: weatherInfo.icon,
      source: 'OPEN_METEO_LIVE',
      fetchedAt: new Date().toISOString()
    };
  } catch (err) {
    console.warn('[WEATHER] Open-Meteo timeout or network error, applying fallback:', err.message);
    return FALLBACK_WEATHER;
  }
}

/**
 * Generate farm-focused weather advisories from forecast metrics
 */
function generateFarmAdvisories({ next24hMaxRainProb, next24hPrecipitation, next24hMaxWind, maxTempNext7Days, sevenDayPrecipitationSum }) {
  const advisories = [];

  // 1. Irrigation Advisory
  if (next24hMaxRainProb >= 40 || next24hPrecipitation >= 2) {
    advisories.push({
      id: 'irrigation',
      category: 'सिंचाई (Irrigation)',
      status: 'warning',
      badge: 'सिंचाई टालें (Delay Irrigation)',
      title: 'बारिश की संभावना: सिंचाई स्थगित करने पर विचार करें',
      recommendation: `अगले 24 घंटों में बारिश की संभावना ${next24hMaxRainProb}% है (${next24hPrecipitation}mm अनुमानित)। अनावश्यक सिंचाई से बचें ताकि जलभराव और खाद का बहाव न हो।`,
      recommendationEn: `Rain probability is ${next24hMaxRainProb}% (${next24hPrecipitation}mm). Consider delaying irrigation to prevent nutrient leaching and waterlogging.`
    });
  } else if (maxTempNext7Days >= 36) {
    advisories.push({
      id: 'irrigation',
      category: 'सिंचाई (Irrigation)',
      status: 'info',
      badge: 'नमी निगरानी (Moisture Check)',
      title: 'उच्च तापमान: फसलों की पानी की मांग बढ़ेगी',
      recommendation: 'तापमान 36°C से ऊपर रहने का अनुमान है। खेत की नमी की नियमित जांच करें और शाम के समय हल्की सिंचाई करें।',
      recommendationEn: 'Temperatures expected above 36°C. Monitor soil moisture regularly and apply evening irrigation if necessary.'
    });
  } else {
    advisories.push({
      id: 'irrigation',
      category: 'सिंचाई (Irrigation)',
      status: 'success',
      badge: 'सामान्य चक्र (Normal Schedule)',
      title: 'सिंचाई के लिए सामान्य परिस्थितियां',
      recommendation: 'मौसम अनुकूल है। फसल की वृद्धि अवस्था और मिट्टी के प्रकार के अनुसार निर्धारित सिंचाई जारी रखें।',
      recommendationEn: 'Favorable weather. Maintain standard irrigation schedule based on crop growth stage.'
    });
  }

  // 2. Spraying Advisory (Foliar nutrients & pest management)
  if (next24hMaxWind >= 16) {
    advisories.push({
      id: 'spraying',
      category: 'कीटनाशक व छिड़काव (Spraying)',
      status: 'danger',
      badge: 'छिड़काव से बचें (Avoid Spray)',
      title: 'तेज़ हवा: किसी भी प्रकार के छिड़काव से बचें',
      recommendation: `हवा की गति ${Math.round(next24hMaxWind)} km/h रहने की संभावना है। तेज़ हवा में छिड़काव करने से घोल उड़कर बर्बाद होगा और असर नहीं होगा।`,
      recommendationEn: `Wind speeds reach ${Math.round(next24hMaxWind)} km/h. High wind causes severe drift and reduces chemical efficacy.`
    });
  } else if (next24hMaxRainProb >= 50) {
    advisories.push({
      id: 'spraying',
      category: 'कीटनाशक व छिड़काव (Spraying)',
      status: 'warning',
      badge: 'छिड़काव टालें (Delay Spray)',
      title: 'वर्षा की आशंका: छिड़काव टालना बेहतर रहेगा',
      recommendation: 'बारिश के कारण पत्तियों पर पड़ा छिड़काव धुल सकता है। बारिश थमने और पत्तियां सूखने के बाद ही छिड़काव करें।',
      recommendationEn: 'Rain within 24h will wash off spray deposits. Postpone foliar applications until foliage is dry.'
    });
  } else {
    advisories.push({
      id: 'spraying',
      category: 'कीटनाशक व छिड़काव (Spraying)',
      status: 'success',
      badge: 'छिड़काव अनुकूल (Good for Spray)',
      title: 'छिड़काव के लिए परिस्थितियां अनुकूल',
      recommendation: 'हवा शांत है (< 15 km/h) और बारिश की संभावना नहीं है। सुबह 8 से 11 बजे या शाम 4 बजे के बाद छिड़काव सर्वोत्तम रहेगा।',
      recommendationEn: 'Calm winds and clear skies. Optimal spraying window is 8-11 AM or after 4 PM.'
    });
  }

  // 3. Harvesting & Drainage Advisory
  if (sevenDayPrecipitationSum >= 30) {
    advisories.push({
      id: 'drainage',
      category: 'जल निकासी व कटाई (Drainage & Harvest)',
      status: 'warning',
      badge: 'जल निकासी जांचें (Check Drainage)',
      title: 'आगामी दिनों में भारी बारिश: जल निकासी तैयार रखें',
      recommendation: `आगामी 7 दिनों में कुल ${Math.round(sevenDayPrecipitationSum)}mm तक बारिश का अनुमान है। खेतों की मेड़ और पानी निकासी की नालियां दुरुस्त कर लें।`,
      recommendationEn: `Cumulative 7-day rainfall around ${Math.round(sevenDayPrecipitationSum)}mm. Clear field drain channels to prevent standing water.`
    });
  } else {
    advisories.push({
      id: 'drainage',
      category: 'जल निकासी व कटाई (Drainage & Harvest)',
      status: 'success',
      badge: 'खुला मौसम (Clear Conditions)',
      title: 'कटाई एवं खलिहान कार्य के लिए अनुकूल मौसम',
      recommendation: 'आने वाले सप्ताह में मौसम प्रायः सूखा और साफ रहेगा। पकी हुई फसलों की कटाई और भंडारण की तैयारी सुरक्षित रूप से की जा सकती है।',
      recommendationEn: 'Dry conditions expected. Ideal for harvesting mature crops, thrashing, and sun-drying produce.'
    });
  }

  return advisories;
}

/**
 * Get comprehensive weather forecast:
 * - Current weather
 * - Next 24 hours hourly
 * - 7-day daily forecast
 * - Farm-focused weather advisories
 */
async function getComprehensiveWeatherForecast(lat = 27.1767, lon = 78.0081) {
  const normLat = Math.round(Number(lat) * 100) / 100;
  const normLon = Math.round(Number(lon) * 100) / 100;
  const cacheKey = `${normLat}:${normLon}`;
  const now = Date.now();

  const cached = forecastCache.get(cacheKey);
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${normLat}&longitude=${normLon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,surface_pressure` +
      `&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
      `&timezone=Asia%2FKolkata&forecast_days=7`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`);
    }

    const data = await res.json();
    const current = data.current || {};
    const hourly = data.hourly || {};
    const daily = data.daily || {};

    const currentWeatherInfo = interpretWeatherCode(current.weather_code ?? 0);

    // Current weather snapshot
    const currentData = {
      temperature: Math.round(current.temperature_2m ?? 28),
      apparentTemperature: Math.round(current.apparent_temperature ?? current.temperature_2m ?? 28),
      humidity: Math.round(current.relative_humidity_2m ?? 65),
      windSpeedKmh: Math.round(current.wind_speed_10m ?? 8),
      precipitationMm: current.precipitation ?? 0,
      pressureHpa: Math.round(current.surface_pressure ?? 1010),
      soilMoisture: 42,
      condition: currentWeatherInfo.hi,
      conditionEn: currentWeatherInfo.en,
      icon: currentWeatherInfo.icon,
      weatherCode: current.weather_code ?? 0,
      time: current.time || new Date().toISOString()
    };

    // Next 24 hours forecast
    const hourlyTimes = hourly.time || [];
    let startIdx = 0;
    if (current.time) {
      const foundIdx = hourlyTimes.findIndex(t => t.startsWith(current.time.slice(0, 13)));
      if (foundIdx >= 0) startIdx = foundIdx;
    }

    const next24h = [];
    const maxHourlyLimit = Math.min(startIdx + 24, hourlyTimes.length);
    for (let i = startIdx; i < maxHourlyLimit; i++) {
      const code = hourly.weather_code?.[i] ?? 0;
      const info = interpretWeatherCode(code);
      const timeStr = hourlyTimes[i];
      const hourPart = timeStr.includes('T') ? timeStr.split('T')[1].slice(0, 5) : timeStr;

      next24h.push({
        time: timeStr,
        hour: hourPart,
        temperature: Math.round(hourly.temperature_2m?.[i] ?? currentData.temperature),
        humidity: Math.round(hourly.relative_humidity_2m?.[i] ?? currentData.humidity),
        rainProbability: Math.round(hourly.precipitation_probability?.[i] ?? 0),
        precipitationMm: hourly.precipitation?.[i] ?? 0,
        windSpeedKmh: Math.round(hourly.wind_speed_10m?.[i] ?? currentData.windSpeedKmh),
        condition: info.hi,
        conditionEn: info.en,
        icon: info.icon,
        weatherCode: code
      });
    }

    // 7-day daily forecast
    const dailyTimes = daily.time || [];
    const sevenDay = [];
    const dayNamesHi = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
    const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < dailyTimes.length; i++) {
      const code = daily.weather_code?.[i] ?? 0;
      const info = interpretWeatherCode(code);
      const dateObj = new Date(dailyTimes[i]);
      const dayIdx = dateObj.getDay();

      sevenDay.push({
        date: dailyTimes[i],
        dayName: dayNamesHi[dayIdx] || dailyTimes[i],
        dayNameEn: dayNamesEn[dayIdx] || dailyTimes[i],
        maxTemp: Math.round(daily.temperature_2m_max?.[i] ?? 32),
        minTemp: Math.round(daily.temperature_2m_min?.[i] ?? 20),
        precipitationMm: Math.round((daily.precipitation_sum?.[i] ?? 0) * 10) / 10,
        rainProbability: Math.round(daily.precipitation_probability_max?.[i] ?? 0),
        windSpeedKmh: Math.round(daily.wind_speed_10m_max?.[i] ?? 10),
        condition: info.hi,
        conditionEn: info.en,
        icon: info.icon,
        weatherCode: code
      });
    }

    // Calculate aggregated metrics for advisories
    const next24hMaxRainProb = next24h.reduce((m, h) => Math.max(m, h.rainProbability), 0);
    const next24hPrecipitation = Math.round(next24h.reduce((s, h) => s + h.precipitationMm, 0) * 10) / 10;
    const next24hMaxWind = next24h.reduce((m, h) => Math.max(m, h.windSpeedKmh), 0);
    const maxTempNext7Days = sevenDay.reduce((m, d) => Math.max(m, d.maxTemp), currentData.temperature);
    const sevenDayPrecipitationSum = sevenDay.reduce((s, d) => s + d.precipitationMm, 0);

    const advisories = generateFarmAdvisories({
      next24hMaxRainProb,
      next24hPrecipitation,
      next24hMaxWind,
      maxTempNext7Days,
      sevenDayPrecipitationSum
    });

    const result = {
      success: true,
      source: 'OPEN_METEO_LIVE',
      isStale: false,
      coordinates: { lat: normLat, lon: normLon },
      fetchedAt: new Date().toISOString(),
      current: currentData,
      hourly24: next24h,
      daily7: sevenDay,
      advisories,
      disclaimer: 'यह सामान्य मौसम-आधारित सुझाव हैं, किसी विशिष्ट कीट/रोग या फसल के लिए अनिवार्य कृषि सलाह की गारंटी नहीं।'
    };

    forecastCache.set(cacheKey, { timestamp: now, data: result });
    return result;

  } catch (err) {
    console.warn('[WEATHER] Forecast fetch failed, using fallback:', err.message);

    // If cached version exists (even if older than TTL), return it marked as stale
    if (cached) {
      return {
        ...cached.data,
        isStale: true,
        staleReason: 'Upstream network timeout - showing previous valid forecast'
      };
    }

    // Otherwise construct reasonable seasonal fallback with clear indicator
    const fallbackCurrent = {
      temperature: 28,
      apparentTemperature: 29,
      humidity: 65,
      windSpeedKmh: 8,
      precipitationMm: 0,
      pressureHpa: 1012,
      soilMoisture: 42,
      condition: 'साफ मौसम (अनुमानित)',
      conditionEn: 'Fair (Estimated)',
      icon: '🌤️',
      weatherCode: 1,
      time: new Date().toISOString()
    };

    const fallbackResult = {
      success: true,
      source: 'SEASONAL_ESTIMATE_FALLBACK',
      isStale: true,
      coordinates: { lat: normLat, lon: normLon },
      fetchedAt: new Date().toISOString(),
      current: fallbackCurrent,
      hourly24: [],
      daily7: [],
      advisories: [
        {
          id: 'fallback_notice',
          category: 'मौसम सूचना (Weather Status)',
          status: 'info',
          badge: 'अनुमानित डेटा',
          title: 'लाइव मौसम डेटा वर्तमान में अनुपलब्ध है',
          recommendation: 'नेटवर्क संपर्क बहाल होने पर लाइव पूर्वानुमान स्वतः अपडेट हो जाएगा।',
          recommendationEn: 'Live weather service temporarily unreachable. Will refresh automatically.'
        }
      ],
      disclaimer: 'यह सामान्य मौसम-आधारित सुझाव हैं, किसी विशिष्ट कृषि सलाह की गारंटी नहीं।'
    };

    return fallbackResult;
  }
}

module.exports = {
  getHyperlocalWeather,
  getComprehensiveWeatherForecast,
  FALLBACK_WEATHER,
  interpretWeatherCode
};
