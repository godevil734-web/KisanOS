-- 006_supply_network_restructure.sql: Complete Supply Network Restructure
-- Adds buyer_type, lot thresholds, coordinates, and procurement_plans table

-- 1. Extend buyer_requirements table
ALTER TABLE buyer_requirements 
  ADD COLUMN IF NOT EXISTS buyer_type VARCHAR(32) NOT NULL DEFAULT 'bulk',
  ADD COLUMN IF NOT EXISTS required_quantity_kg NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS minimum_direct_farmer_lot_kg NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aggregation_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS delivery_latitude NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS delivery_longitude NUMERIC(10,6);

-- Backfill required_quantity_kg if null
UPDATE buyer_requirements 
SET required_quantity_kg = quantity_tons * 1000 
WHERE required_quantity_kg IS NULL AND quantity_tons IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reqs_buyer_type ON buyer_requirements(buyer_type);
CREATE INDEX IF NOT EXISTS idx_reqs_aggregation ON buyer_requirements(aggregation_allowed);

-- 2. Extend farmer_listings table
ALTER TABLE farmer_listings 
  ADD COLUMN IF NOT EXISTS quantity_kg NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,6);

-- Backfill quantity_kg if null
UPDATE farmer_listings 
SET quantity_kg = quantity_tons * 1000 
WHERE quantity_kg IS NULL AND quantity_tons IS NOT NULL;

-- 3. Extend users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS buyer_type VARCHAR(32),
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,6);

-- 4. Create procurement_plans table for Aggregator workflow
CREATE TABLE IF NOT EXISTS procurement_plans (
  id VARCHAR(64) PRIMARY KEY,
  aggregator_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aggregator_name VARCHAR(255),
  buyer_requirement_id VARCHAR(64) REFERENCES buyer_requirements(id) ON DELETE SET NULL,
  buyer_name VARCHAR(255),
  buyer_company VARCHAR(255),
  crop_name VARCHAR(128) NOT NULL,
  variety VARCHAR(128),
  target_quantity_kg NUMERIC(12,2) NOT NULL,
  planned_quantity_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  selected_farmers JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_procurement_cost NUMERIC(12,2) DEFAULT 0,
  indicative_buyer_price_per_kg NUMERIC(10,2) DEFAULT 0,
  estimated_logistics_cost NUMERIC(12,2) DEFAULT 0,
  estimated_gross_margin NUMERIC(12,2) DEFAULT 0,
  estimated_net_margin NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  batch_id VARCHAR(64) REFERENCES aggregation_batches(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_aggregator ON procurement_plans(aggregator_id);
CREATE INDEX IF NOT EXISTS idx_plans_requirement ON procurement_plans(buyer_requirement_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON procurement_plans(status);

-- Enable RLS on new table
ALTER TABLE procurement_plans ENABLE ROW LEVEL SECURITY;
