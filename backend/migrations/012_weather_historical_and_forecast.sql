-- Migration 012: Weather Historical Observations, Segregated Forecasts, and Disaster Alerts
-- Establishes authentic meteorological data foundations for KisanOS price and yield forecasting.

-- 1. Historical Observed Weather Table
CREATE TABLE IF NOT EXISTS weather_historical_observations (
  id VARCHAR(64) PRIMARY KEY,
  location_id VARCHAR(100) NOT NULL,
  location_type VARCHAR(50) NOT NULL DEFAULT 'DISTRICT_CENTROID', -- 'MANDI', 'FARM_FIELD', 'DISTRICT_CENTROID', 'GRID_CELL'
  state VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL,
  latitude NUMERIC(7,4) NOT NULL,
  longitude NUMERIC(7,4) NOT NULL,
  observation_date DATE NOT NULL,
  rainfall_mm NUMERIC(8,2), -- NULL = unmeasured / not available; 0.00 = measured zero
  temp_min_c NUMERIC(5,2),
  temp_max_c NUMERIC(5,2),
  temp_mean_c NUMERIC(5,2),
  relative_humidity_mean_pct NUMERIC(5,2),
  wind_speed_max_kmh NUMERIC(5,2),
  soil_moisture_0_to_7cm_m3m3 NUMERIC(6,4),
  soil_moisture_7_to_28cm_m3m3 NUMERIC(6,4),
  et0_evapotranspiration_mm NUMERIC(6,2),
  weather_condition VARCHAR(100),
  source VARCHAR(150) NOT NULL,
  raw_payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Canonical unique constraint per location per calendar date
CREATE UNIQUE INDEX IF NOT EXISTS idx_weather_hist_loc_date 
ON weather_historical_observations (location_id, observation_date);

-- Spatial and lookup indexes
CREATE INDEX IF NOT EXISTS idx_weather_hist_coords 
ON weather_historical_observations (latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_weather_hist_district_date 
ON weather_historical_observations (LOWER(state), LOWER(district), observation_date);

CREATE INDEX IF NOT EXISTS idx_weather_hist_date 
ON weather_historical_observations (observation_date);

-- 2. Weather Forecast Records Table (Strict ML Data Leakage Separation)
CREATE TABLE IF NOT EXISTS weather_forecast_records (
  id VARCHAR(64) PRIMARY KEY,
  location_id VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL,
  latitude NUMERIC(7,4) NOT NULL,
  longitude NUMERIC(7,4) NOT NULL,
  forecast_issued_at TIMESTAMPTZ NOT NULL, -- Timestamp when the forecast was issued
  target_timestamp TIMESTAMPTZ NOT NULL,   -- Target timestamp being forecasted
  forecast_horizon_hours INT NOT NULL,      -- Horizon in hours (e.g. 24, 48, 72, 168)
  temperature_c NUMERIC(5,2),
  temperature_min_c NUMERIC(5,2),
  temperature_max_c NUMERIC(5,2),
  precipitation_mm NUMERIC(8,2),
  precipitation_probability_pct NUMERIC(5,2),
  relative_humidity_pct NUMERIC(5,2),
  wind_speed_kmh NUMERIC(5,2),
  soil_moisture_m3m3 NUMERIC(6,4),
  condition VARCHAR(100),
  source VARCHAR(150) NOT NULL,
  raw_payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint guarantees exact forecast issued at a specific time for a target time
CREATE UNIQUE INDEX IF NOT EXISTS idx_weather_forecast_unique 
ON weather_forecast_records (location_id, forecast_issued_at, target_timestamp, source);

CREATE INDEX IF NOT EXISTS idx_weather_forecast_target 
ON weather_forecast_records (location_id, target_timestamp);

CREATE INDEX IF NOT EXISTS idx_weather_forecast_issued 
ON weather_forecast_records (forecast_issued_at);

-- 3. Official Disaster & Extreme Weather Alerts Table
CREATE TABLE IF NOT EXISTS weather_disaster_alerts (
  id VARCHAR(64) PRIMARY KEY,
  source_agency VARCHAR(100) NOT NULL,   -- 'IMD', 'CWC', 'NDMA', 'UPSDMA', etc.
  source_alert_id VARCHAR(150) NOT NULL, -- Native bulletin/alert UUID or serial
  state VARCHAR(100) NOT NULL,
  district VARCHAR(100) DEFAULT NULL,    -- NULL indicates state-wide warning
  alert_type VARCHAR(100) NOT NULL,      -- 'HEAVY_RAINFALL', 'FLOOD', 'HEATWAVE', 'COLDWAVE', 'FROST', 'HAILSTORM', 'CYCLONE', 'DROUGHT'
  severity VARCHAR(30) NOT NULL,         -- 'YELLOW_WATCH', 'ORANGE_ALERT', 'RED_WARNING'
  headline VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ NOT NULL,
  affected_regions TEXT[] DEFAULT NULL,
  source_url VARCHAR(300) DEFAULT NULL,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint prevents double-counting alert updates from official feeds
CREATE UNIQUE INDEX IF NOT EXISTS idx_weather_alerts_agency_id 
ON weather_disaster_alerts (source_agency, source_alert_id);

CREATE INDEX IF NOT EXISTS idx_weather_alerts_lookup 
ON weather_disaster_alerts (state, district, effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_weather_alerts_type_severity 
ON weather_disaster_alerts (alert_type, severity);

-- 4. Row Level Security Policies
ALTER TABLE weather_historical_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_forecast_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_disaster_alerts ENABLE ROW LEVEL SECURITY;

-- Backend Service Role has exclusive write access
DROP POLICY IF EXISTS "Service role write historical weather" ON weather_historical_observations;
CREATE POLICY "Service role write historical weather" 
ON weather_historical_observations FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role write weather forecasts" ON weather_forecast_records;
CREATE POLICY "Service role write weather forecasts" 
ON weather_forecast_records FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role write weather alerts" ON weather_disaster_alerts;
CREATE POLICY "Service role write weather alerts" 
ON weather_disaster_alerts FOR ALL TO service_role USING (true);

-- Public Read: Restricted to public/non-private location types (MANDI, DISTRICT_CENTROID, GRID_CELL)
-- FARM_FIELD coordinates are strictly protected from public anonymous scraping
DROP POLICY IF EXISTS "Public read public weather locations" ON weather_historical_observations;
CREATE POLICY "Public read public weather locations" 
ON weather_historical_observations FOR SELECT 
USING (location_type IN ('MANDI', 'DISTRICT_CENTROID', 'GRID_CELL'));

DROP POLICY IF EXISTS "Public read public weather forecasts" ON weather_forecast_records;
CREATE POLICY "Public read public weather forecasts" 
ON weather_forecast_records FOR SELECT 
USING (location_id NOT LIKE 'field:%');

-- Public Read for official disaster alerts
DROP POLICY IF EXISTS "Public read weather alerts" ON weather_disaster_alerts;
CREATE POLICY "Public read weather alerts" 
ON weather_disaster_alerts FOR SELECT USING (true);
