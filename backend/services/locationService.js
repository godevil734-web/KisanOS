/**
 * KisanConnect Geographic Distance & Proximity Engine
 * Implements deterministic Haversine calculations, nearby filtering,
 * geocoding, reverse-geocoding, and IP/header based location detection.
 */

// Earth radius in kilometers
const EARTH_RADIUS_KM = 6371.0088;

/**
 * Known coordinate benchmarks for regional agrarian hubs & Indian districts
 * Used for fast lookup, distance calculation, and zero-network fallback.
 */
const KNOWN_COORDINATES = {
  // Uttar Pradesh
  'kushinagar': { lat: 26.7410, lon: 83.8890, district: 'Kushinagar', state: 'Uttar Pradesh' },
  'kushinagar mandi': { lat: 26.7410, lon: 83.8890, district: 'Kushinagar', state: 'Uttar Pradesh' },
  'kasya': { lat: 26.7450, lon: 83.8920, district: 'Kushinagar', state: 'Uttar Pradesh' },
  'padrauna': { lat: 26.9025, lon: 83.9822, district: 'Kushinagar', state: 'Uttar Pradesh' },
  'deoria': { lat: 26.5050, lon: 83.7790, district: 'Deoria', state: 'Uttar Pradesh' },
  'gorakhpur': { lat: 26.7606, lon: 83.3732, district: 'Gorakhpur', state: 'Uttar Pradesh' },
  'agra': { lat: 27.1767, lon: 78.0081, district: 'Agra', state: 'Uttar Pradesh' },
  'khandauli': { lat: 27.2842, lon: 78.0931, district: 'Agra', state: 'Uttar Pradesh' },
  'fatehabad': { lat: 27.0253, lon: 78.3090, district: 'Agra', state: 'Uttar Pradesh' },
  'firozabad': { lat: 27.1592, lon: 78.3957, district: 'Firozabad', state: 'Uttar Pradesh' },
  'mathura': { lat: 27.4924, lon: 77.6737, district: 'Mathura', state: 'Uttar Pradesh' },
  'aligarh': { lat: 27.8974, lon: 78.0880, district: 'Aligarh', state: 'Uttar Pradesh' },
  'hathras': { lat: 27.5968, lon: 78.0519, district: 'Hathras', state: 'Uttar Pradesh' },
  'mainpuri': { lat: 27.2344, lon: 79.0289, district: 'Mainpuri', state: 'Uttar Pradesh' },
  'etah': { lat: 27.6318, lon: 78.6669, district: 'Etah', state: 'Uttar Pradesh' },
  'meerut': { lat: 28.9845, lon: 77.7064, district: 'Meerut', state: 'Uttar Pradesh' },
  'muzaffarnagar': { lat: 29.4727, lon: 77.7085, district: 'Muzaffarnagar', state: 'Uttar Pradesh' },
  'bulandshahr': { lat: 28.4069, lon: 77.8498, district: 'Bulandshahr', state: 'Uttar Pradesh' },
  'bareilly': { lat: 28.3670, lon: 79.4304, district: 'Bareilly', state: 'Uttar Pradesh' },
  'moradabad': { lat: 28.8386, lon: 78.7733, district: 'Moradabad', state: 'Uttar Pradesh' },
  'rampur': { lat: 28.8154, lon: 79.0257, district: 'Rampur', state: 'Uttar Pradesh' },
  'shahjahanpur': { lat: 27.8804, lon: 79.9122, district: 'Shahjahanpur', state: 'Uttar Pradesh' },
  'lucknow': { lat: 26.8467, lon: 80.9462, district: 'Lucknow', state: 'Uttar Pradesh' },
  'kanpur': { lat: 26.4499, lon: 80.3319, district: 'Kanpur Nagar', state: 'Uttar Pradesh' },
  'varanasi': { lat: 25.3176, lon: 82.9739, district: 'Varanasi', state: 'Uttar Pradesh' },
  'prayagraj': { lat: 25.4358, lon: 81.8463, district: 'Prayagraj', state: 'Uttar Pradesh' },
  'allahabad': { lat: 25.4358, lon: 81.8463, district: 'Prayagraj', state: 'Uttar Pradesh' },
  'ayodhya': { lat: 26.7922, lon: 82.1998, district: 'Ayodhya', state: 'Uttar Pradesh' },
  'barabanki': { lat: 26.9274, lon: 81.1834, district: 'Barabanki', state: 'Uttar Pradesh' },
  'sitapur': { lat: 27.5684, lon: 80.6829, district: 'Sitapur', state: 'Uttar Pradesh' },
  'lakhimpur': { lat: 27.9460, lon: 80.7786, district: 'Lakhimpur Kheri', state: 'Uttar Pradesh' },
  'badaun': { lat: 28.0381, lon: 79.1264, district: 'Budaun', state: 'Uttar Pradesh' },
  'sambhal': { lat: 28.5847, lon: 78.5714, district: 'Sambhal', state: 'Uttar Pradesh' },
  'jhansi': { lat: 25.4484, lon: 78.5685, district: 'Jhansi', state: 'Uttar Pradesh' },
  'saharanpur': { lat: 29.9671, lon: 77.5510, district: 'Saharanpur', state: 'Uttar Pradesh' },
  'bijnor': { lat: 29.3732, lon: 78.1358, district: 'Bijnor', state: 'Uttar Pradesh' },

  // Delhi / NCR
  'delhi': { lat: 28.6139, lon: 77.2090, district: 'New Delhi', state: 'Delhi' },
  'new delhi': { lat: 28.6139, lon: 77.2090, district: 'New Delhi', state: 'Delhi' },
  'azadpur': { lat: 28.7165, lon: 77.1752, district: 'North Delhi', state: 'Delhi' },
  'noida': { lat: 28.5355, lon: 77.3910, district: 'Gautam Buddha Nagar', state: 'Uttar Pradesh' },
  'greater noida': { lat: 28.4744, lon: 77.5040, district: 'Gautam Buddha Nagar', state: 'Uttar Pradesh' },
  'okhla': { lat: 28.5300, lon: 77.2700, district: 'South East Delhi', state: 'Delhi' },
  'ghaziabad': { lat: 28.6692, lon: 77.4538, district: 'Ghaziabad', state: 'Uttar Pradesh' },
  'gurugram': { lat: 28.4595, lon: 77.0266, district: 'Gurugram', state: 'Haryana' },
  'gurgaon': { lat: 28.4595, lon: 77.0266, district: 'Gurugram', state: 'Haryana' },
  'faridabad': { lat: 28.4089, lon: 77.3178, district: 'Faridabad', state: 'Haryana' },

  // Punjab
  'ludhiana': { lat: 30.9010, lon: 75.8573, district: 'Ludhiana', state: 'Punjab' },
  'amritsar': { lat: 31.6340, lon: 74.8723, district: 'Amritsar', state: 'Punjab' },
  'jalandhar': { lat: 31.3260, lon: 75.5762, district: 'Jalandhar', state: 'Punjab' },
  'patiala': { lat: 30.3398, lon: 76.3869, district: 'Patiala', state: 'Punjab' },
  'bathinda': { lat: 30.2110, lon: 74.9455, district: 'Bathinda', state: 'Punjab' },
  'sangrur': { lat: 30.2458, lon: 75.8421, district: 'Sangrur', state: 'Punjab' },
  'firozpur': { lat: 30.9237, lon: 74.6138, district: 'Firozpur', state: 'Punjab' },
  'hoshiarpur': { lat: 31.5273, lon: 75.9142, district: 'Hoshiarpur', state: 'Punjab' },

  // Haryana
  'karnal': { lat: 29.6857, lon: 76.9905, district: 'Karnal', state: 'Haryana' },
  'kurukshetra': { lat: 29.9695, lon: 76.8783, district: 'Kurukshetra', state: 'Haryana' },
  'ambala': { lat: 30.3782, lon: 76.7767, district: 'Ambala', state: 'Haryana' },
  'panipat': { lat: 29.3909, lon: 76.9635, district: 'Panipat', state: 'Haryana' },
  'sonipat': { lat: 28.9931, lon: 77.0151, district: 'Sonipat', state: 'Haryana' },
  'rohtak': { lat: 28.8955, lon: 76.6066, district: 'Rohtak', state: 'Haryana' },
  'hisar': { lat: 29.1492, lon: 75.7217, district: 'Hisar', state: 'Haryana' },
  'sirsa': { lat: 29.5349, lon: 75.0290, district: 'Sirsa', state: 'Haryana' },

  // Rajasthan
  'jaipur': { lat: 26.9124, lon: 75.7873, district: 'Jaipur', state: 'Rajasthan' },
  'jodhpur': { lat: 26.2389, lon: 73.0243, district: 'Jodhpur', state: 'Rajasthan' },
  'kota': { lat: 25.2138, lon: 75.8648, district: 'Kota', state: 'Rajasthan' },
  'bikaner': { lat: 28.0229, lon: 73.3119, district: 'Bikaner', state: 'Rajasthan' },
  'sri ganganagar': { lat: 29.9038, lon: 73.8772, district: 'Sri Ganganagar', state: 'Rajasthan' },
  'alwar': { lat: 27.5530, lon: 76.6346, district: 'Alwar', state: 'Rajasthan' },
  'bharatpur': { lat: 27.2152, lon: 77.5030, district: 'Bharatpur', state: 'Rajasthan' },

  // Madhya Pradesh
  'indore': { lat: 22.7196, lon: 75.8577, district: 'Indore', state: 'Madhya Pradesh' },
  'bhopal': { lat: 23.2599, lon: 77.4126, district: 'Bhopal', state: 'Madhya Pradesh' },
  'ujjain': { lat: 23.1765, lon: 75.7885, district: 'Ujjain', state: 'Madhya Pradesh' },
  'gwalior': { lat: 26.2183, lon: 78.1828, district: 'Gwalior', state: 'Madhya Pradesh' },
  'jabalpur': { lat: 23.1815, lon: 79.9864, district: 'Jabalpur', state: 'Madhya Pradesh' },
  'ratlam': { lat: 23.3315, lon: 75.0367, district: 'Ratlam', state: 'Madhya Pradesh' },

  // Maharashtra
  'nashik': { lat: 19.9975, lon: 73.7898, district: 'Nashik', state: 'Maharashtra' },
  'pune': { lat: 18.5204, lon: 73.8567, district: 'Pune', state: 'Maharashtra' },
  'nagpur': { lat: 21.1458, lon: 79.0882, district: 'Nagpur', state: 'Maharashtra' },
  'ahmednagar': { lat: 19.0948, lon: 74.7480, district: 'Ahmednagar', state: 'Maharashtra' },
  'solapur': { lat: 17.6599, lon: 75.9064, district: 'Solapur', state: 'Maharashtra' },
  'kolhapur': { lat: 16.7050, lon: 74.2433, district: 'Kolhapur', state: 'Maharashtra' },
  'mumbai': { lat: 19.0760, lon: 72.8777, district: 'Mumbai', state: 'Maharashtra' },

  // Bihar
  'patna': { lat: 25.5941, lon: 85.1376, district: 'Patna', state: 'Bihar' },
  'muzaffarpur': { lat: 26.1209, lon: 85.3647, district: 'Muzaffarpur', state: 'Bihar' },
  'gaya': { lat: 24.7914, lon: 85.0002, district: 'Gaya', state: 'Bihar' },
  'bhagalpur': { lat: 25.2425, lon: 86.9842, district: 'Bhagalpur', state: 'Bihar' },
  'begusarai': { lat: 25.4182, lon: 86.1272, district: 'Begusarai', state: 'Bihar' },

  // Gujarat
  'ahmedabad': { lat: 23.0225, lon: 72.5714, district: 'Ahmedabad', state: 'Gujarat' },
  'surat': { lat: 21.1702, lon: 72.8311, district: 'Surat', state: 'Gujarat' },
  'rajkot': { lat: 22.3039, lon: 70.8022, district: 'Rajkot', state: 'Gujarat' },
  'vadodara': { lat: 22.3072, lon: 73.1812, district: 'Vadodara', state: 'Gujarat' },

  // South / Other
  'hyderabad': { lat: 17.3850, lon: 78.4867, district: 'Hyderabad', state: 'Telangana' },
  'bengaluru': { lat: 12.9716, lon: 77.5946, district: 'Bengaluru Urban', state: 'Karnataka' },
  'bangalore': { lat: 12.9716, lon: 77.5946, district: 'Bengaluru Urban', state: 'Karnataka' },
  'chennai': { lat: 13.0827, lon: 80.2707, district: 'Chennai', state: 'Tamil Nadu' },
  'kolkata': { lat: 22.5726, lon: 88.3639, district: 'Kolkata', state: 'West Bengal' }
};

// In-memory cache for reverse geocoding to prevent repeat lookups
const reverseGeocodeCache = new Map();
const geocodeCache = new Map();

/**
 * Degrees to Radians
 */
function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculate great-circle distance between two GPS coordinates using Haversine formula
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} distance in kilometers rounded to 1 decimal place
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) {
    return 25.0; // Sensible regional average default when coordinates are unknown
  }

  const dLat = toRadians(nLat2 - nLat1);
  const dLon = toRadians(nLon2 - nLon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(nLat1)) * Math.cos(toRadians(nLat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return Number(distance.toFixed(1));
}

/**
 * Resolve GPS coordinates from explicit fields or location string lookup
 */
function resolveCoordinates(obj = {}) {
  const lat = obj.latitude ?? obj.deliveryLatitude ?? obj.delivery_latitude ?? obj.lat;
  const lon = obj.longitude ?? obj.deliveryLongitude ?? obj.delivery_longitude ?? obj.lon;

  if (lat !== undefined && lat !== null && lon !== undefined && lon !== null && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
    return { lat: Number(lat), lon: Number(lon), isExact: true };
  }

  // Lookup by location string
  const locStr = (obj.location || obj.farmerLocation || obj.deliveryLocation || obj.address || '').toLowerCase();
  for (const [key, coords] of Object.entries(KNOWN_COORDINATES)) {
    if (locStr.includes(key)) {
      return { lat: coords.lat, lon: coords.lon, isExact: false };
    }
  }

  // Default to central agrarian benchmark (Kushinagar / Agra belt)
  return { lat: 26.7410, lon: 83.8890, isExact: false };
}

/**
 * Find nearby entities within maxDistanceKm
 */
function filterByDistance(originEntity, candidateList = [], maxDistanceKm = null) {
  const originCoords = resolveCoordinates(originEntity);

  return candidateList.map(item => {
    const itemCoords = resolveCoordinates(item);
    const distanceKm = calculateDistanceKm(originCoords.lat, originCoords.lon, itemCoords.lat, itemCoords.lon);
    return {
      ...item,
      distanceKm
    };
  }).filter(item => {
    if (maxDistanceKm === null || maxDistanceKm === undefined || maxDistanceKm <= 0) return true;
    return item.distanceKm <= maxDistanceKm;
  }).sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Find nearest known benchmark district by coordinates
 */
function findNearestBenchmark(lat, lon) {
  let closest = null;
  let minDistance = Infinity;

  for (const [name, coord] of Object.entries(KNOWN_COORDINATES)) {
    const d = calculateDistanceKm(lat, lon, coord.lat, coord.lon);
    if (d < minDistance) {
      minDistance = d;
      closest = { name, ...coord, distanceKm: d };
    }
  }

  return closest || {
    name: 'agra',
    lat: 27.1767,
    lon: 78.0081,
    district: 'Agra',
    state: 'Uttar Pradesh',
    distanceKm: 0
  };
}

/**
 * High-reliability Reverse Geocoding with fallback chain:
 * 1. Cache
 * 2. BigDataCloud API
 * 3. OpenStreetMap Nominatim API
 * 4. Deterministic nearest benchmark from KNOWN_COORDINATES
 */
async function reverseGeocode(lat, lon) {
  const nLat = Number(lat);
  const nLon = Number(lon);
  if (isNaN(nLat) || isNaN(nLon)) {
    return {
      village: 'Khandauli',
      district: 'Agra',
      state: 'Uttar Pradesh',
      country: 'India',
      displayName: 'Khandauli, Agra, Uttar Pradesh',
      coords: { lat: 27.1767, lon: 78.0081 },
      source: 'default'
    };
  }

  const cacheKey = `${nLat.toFixed(3)},${nLon.toFixed(3)}`;
  if (reverseGeocodeCache.has(cacheKey)) {
    return reverseGeocodeCache.get(cacheKey);
  }

  // 1. Try BigDataCloud
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${nLat}&longitude=${nLon}&localityLanguage=en`,
      { signal: controller.signal }
    );
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const village = data.locality || data.city || '';
      let district = '';

      if (Array.isArray(data.localityInfo?.administrative)) {
        const distObj = data.localityInfo.administrative.find(a =>
          a.description?.toLowerCase().includes('district') || a.name?.toLowerCase().includes('district')
        );
        if (distObj) {
          district = distObj.name.replace(/ district/i, '');
        }
      }
      if (!district) {
        district = data.city || '';
      }

      const state = data.principalSubdivision || 'Uttar Pradesh';
      const country = data.countryName || 'India';
      const parts = [village, district, state].filter(Boolean);
      const displayName = parts.length > 0 ? parts.join(', ') : `${nLat.toFixed(2)}°N, ${nLon.toFixed(2)}°E`;

      const result = {
        village,
        district: district || 'Agra',
        state,
        country,
        displayName,
        coords: { lat: nLat, lon: nLon },
        source: 'reverse_geocode'
      };

      reverseGeocodeCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    // continue to Nominatim
  }

  // 2. Try Nominatim
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${nLat}&lon=${nLon}&zoom=14&addressdetails=1`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'KisanOS-Location-Service/1.0' }
      }
    );
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const village = addr.village || addr.suburb || addr.town || addr.hamlet || '';
      const district = (addr.state_district || addr.county || addr.city || '').replace(/ district/i, '');
      const state = addr.state || 'Uttar Pradesh';
      const country = addr.country || 'India';
      const parts = [village, district, state].filter(Boolean);
      const displayName = parts.length > 0 ? parts.join(', ') : `${nLat.toFixed(2)}°N, ${nLon.toFixed(2)}°E`;

      const result = {
        village,
        district: district || 'Agra',
        state,
        country,
        displayName,
        coords: { lat: nLat, lon: nLon },
        source: 'nominatim'
      };

      reverseGeocodeCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    // continue to benchmark fallback
  }

  // 3. Fallback to Nearest Benchmark
  const nearest = findNearestBenchmark(nLat, nLon);
  const result = {
    village: '',
    district: nearest.district,
    state: nearest.state,
    country: 'India',
    displayName: `${nearest.district}, ${nearest.state}`,
    coords: { lat: nLat, lon: nLon },
    source: 'nearest_benchmark'
  };

  reverseGeocodeCache.set(cacheKey, result);
  return result;
}

/**
 * Forward Geocoding: resolve location / district name to coordinates
 */
async function geocode(query) {
  if (!query || typeof query !== 'string') {
    return {
      lat: 27.1767,
      lon: 78.0081,
      district: 'Agra',
      state: 'Uttar Pradesh',
      country: 'India',
      displayName: 'Khandauli, Agra, Uttar Pradesh'
    };
  }

  const cleanQuery = query.toLowerCase().trim();
  if (geocodeCache.has(cleanQuery)) {
    return geocodeCache.get(cleanQuery);
  }

  // 1. Direct match in KNOWN_COORDINATES
  for (const [name, coord] of Object.entries(KNOWN_COORDINATES)) {
    if (cleanQuery.includes(name) || name.includes(cleanQuery)) {
      const res = {
        lat: coord.lat,
        lon: coord.lon,
        district: coord.district,
        state: coord.state,
        country: 'India',
        displayName: `${coord.district}, ${coord.state}`
      };
      geocodeCache.set(cleanQuery, res);
      return res;
    }
  }

  // 2. Try Nominatim Geocoder
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&countrycodes=in&limit=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'KisanOS-Location-Service/1.0' }
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const resObj = {
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          district: item.name || query,
          state: 'India',
          country: 'India',
          displayName: item.display_name || query
        };
        geocodeCache.set(cleanQuery, resObj);
        return resObj;
      }
    }
  } catch (err) {
    // fallback
  }

  // 3. Fallback to default UP agrarian benchmark
  const fallback = {
    lat: 27.1767,
    lon: 78.0081,
    district: 'Agra',
    state: 'Uttar Pradesh',
    country: 'India',
    displayName: 'Khandauli, Agra, Uttar Pradesh'
  };
  geocodeCache.set(cleanQuery, fallback);
  return fallback;
}

/**
 * Detect location from HTTP request:
 * 1. Vercel deployment headers: x-vercel-ip-latitude, x-vercel-ip-longitude, x-vercel-ip-city, x-vercel-ip-country-region
 * 2. Cloudflare / Render headers: cf-iplatitude, cf-iplongitude, cf-ipcity, cf-region
 * 3. Client IP lookup via ip-api.com
 * 4. Default Agra agrarian benchmark
 */
async function detectLocationFromReq(req) {
  try {
    const headers = req.headers || {};

    // 1. Check Vercel edge geolocation headers
    const vLat = parseFloat(headers['x-vercel-ip-latitude']);
    const vLon = parseFloat(headers['x-vercel-ip-longitude']);
    const vCity = headers['x-vercel-ip-city'];
    const vRegion = headers['x-vercel-ip-country-region'];
    const vCountry = headers['x-vercel-ip-country'] || 'India';

    if (!isNaN(vLat) && !isNaN(vLon) && vLat !== 0 && vLon !== 0) {
      const cityStr = vCity ? decodeURIComponent(vCity) : '';
      const regionStr = vRegion || '';
      const parts = [cityStr, regionStr, vCountry].filter(Boolean);
      const displayName = parts.length > 0 ? parts.join(', ') : `${vLat.toFixed(2)}°N, ${vLon.toFixed(2)}°E`;

      return {
        village: '',
        district: cityStr || 'Agra',
        state: regionStr || 'Uttar Pradesh',
        country: vCountry,
        displayName,
        coords: { lat: vLat, lon: vLon },
        source: 'vercel_edge_headers'
      };
    }

    // 2. Check Cloudflare headers
    const cfLat = parseFloat(headers['cf-iplatitude']);
    const cfLon = parseFloat(headers['cf-iplongitude']);
    const cfCity = headers['cf-ipcity'];
    const cfRegion = headers['cf-region'];

    if (!isNaN(cfLat) && !isNaN(cfLon) && cfLat !== 0 && cfLon !== 0) {
      return {
        village: '',
        district: cfCity || 'Agra',
        state: cfRegion || 'Uttar Pradesh',
        country: 'India',
        displayName: `${cfCity || 'Agra'}, ${cfRegion || 'India'}`,
        coords: { lat: cfLat, lon: cfLon },
        source: 'cloudflare_headers'
      };
    }

    // 3. Fallback to client IP lookup
    const rawIp = headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
    const cleanIp = rawIp.replace(/^::ffff:/, '');

    const isPrivate =
      !cleanIp ||
      cleanIp === '127.0.0.1' ||
      cleanIp === '::1' ||
      cleanIp.startsWith('10.') ||
      cleanIp.startsWith('192.168.') ||
      cleanIp.startsWith('172.16.');

    if (!isPrivate) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,country,regionName,city,district,lat,lon`, {
          signal: controller.signal
        });
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success' && data.lat && data.lon) {
            const district = data.district || data.city || 'Agra';
            const state = data.regionName || 'Uttar Pradesh';
            const country = data.country || 'India';
            return {
              village: '',
              district,
              state,
              country,
              displayName: `${district}, ${state}`,
              coords: { lat: Number(data.lat), lon: Number(data.lon) },
              source: 'ip_lookup'
            };
          }
        }
      } catch (e) {
        // continue to benchmark
      }
    }
  } catch (err) {
    console.warn('[locationService] detectLocationFromReq error:', err.message);
  }

  // Default agrarian benchmark: Khandauli, Agra, UP
  return {
    village: 'Khandauli',
    district: 'Agra',
    state: 'Uttar Pradesh',
    country: 'India',
    displayName: 'Khandauli, Agra, Uttar Pradesh',
    coords: { lat: 27.1767, lon: 78.0081 },
    source: 'default_benchmark'
  };
}

module.exports = {
  calculateDistanceKm,
  resolveCoordinates,
  filterByDistance,
  reverseGeocode,
  geocode,
  detectLocationFromReq,
  KNOWN_COORDINATES
};
