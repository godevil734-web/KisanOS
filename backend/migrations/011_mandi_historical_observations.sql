-- Migration 011: Mandi Historical Observations Normalized Table
-- Stores discrete, authentic historical observation records from official government sources (data.gov.in / Agmarknet).

CREATE TABLE IF NOT EXISTS mandi_historical_observations (
  id VARCHAR(64) PRIMARY KEY,
  state VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL,
  market VARCHAR(150) NOT NULL,
  commodity VARCHAR(100) NOT NULL,
  variety VARCHAR(100) DEFAULT NULL,
  grade VARCHAR(50) DEFAULT NULL,
  observation_date DATE NOT NULL,
  min_price_per_quintal NUMERIC(10,2),
  max_price_per_quintal NUMERIC(10,2),
  modal_price_per_quintal NUMERIC(10,2) NOT NULL,
  modal_price_per_kg NUMERIC(8,2) NOT NULL,
  raw_arrivals_value VARCHAR(50) DEFAULT NULL,
  raw_arrivals_unit VARCHAR(50) DEFAULT NULL,
  arrival_quantity_tonnes NUMERIC(10,2) DEFAULT NULL,
  source VARCHAR(200) NOT NULL,
  raw_payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index enforces observation identity across the 6 dimensions
CREATE UNIQUE INDEX IF NOT EXISTS idx_mandi_hist_unique_observation 
ON mandi_historical_observations (state, district, market, commodity, variety, observation_date) 
NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_mandi_hist_crop_date 
ON mandi_historical_observations (commodity, observation_date);

CREATE INDEX IF NOT EXISTS idx_mandi_hist_district_crop 
ON mandi_historical_observations (district, commodity);

-- Enable RLS
ALTER TABLE mandi_historical_observations ENABLE ROW LEVEL SECURITY;

-- Allow public read access
DROP POLICY IF EXISTS "Public read historical observations" ON mandi_historical_observations;
CREATE POLICY "Public read historical observations" 
ON mandi_historical_observations FOR SELECT USING (true);

-- Restrict write/insert/update/delete to service role
DROP POLICY IF EXISTS "Service role write historical observations" ON mandi_historical_observations;
CREATE POLICY "Service role write historical observations" 
ON mandi_historical_observations FOR ALL TO service_role USING (true);

