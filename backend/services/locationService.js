/**
 * KisanConnect Geographic Distance & Proximity Engine
 * Implements deterministic Haversine calculations and nearby filtering.
 */

// Earth radius in kilometers
const EARTH_RADIUS_KM = 6371.0088;

/**
 * Known coordinate benchmarks for regional agrarian hubs (fallback when exact GPS is omitted)
 */
const KNOWN_COORDINATES = {
  'kushinagar': { lat: 26.7410, lon: 83.8890 },
  'kushinagar mandi': { lat: 26.7410, lon: 83.8890 },
  'kasya': { lat: 26.7450, lon: 83.8920 },
  'padrauna': { lat: 26.9025, lon: 83.9822 },
  'gorakhpur': { lat: 26.7606, lon: 83.3732 },
  'agra': { lat: 27.1767, lon: 78.0081 },
  'khandauli': { lat: 27.2842, lon: 78.0931 },
  'fatehabad': { lat: 27.0253, lon: 78.3090 },
  'firozabad': { lat: 27.1592, lon: 78.3957 },
  'mathura': { lat: 27.4924, lon: 77.6737 },
  'delhi': { lat: 28.6139, lon: 77.2090 },
  'azadpur': { lat: 28.7165, lon: 77.1752 }
};

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
  const locStr = (obj.location || obj.farmerLocation || obj.deliveryLocation || '').toLowerCase();
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

module.exports = {
  calculateDistanceKm,
  resolveCoordinates,
  filterByDistance,
  KNOWN_COORDINATES
};
