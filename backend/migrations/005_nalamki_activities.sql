-- 005_nalamki_activities.sql: NaLamKI / ITU-T Digital Farm Activity & Electronic Field Record
-- Implements Annex A.16 Activity standard for agricultural operations tracking & traceability

CREATE TABLE IF NOT EXISTS farm_activities (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type_uri VARCHAR(128) NOT NULL,
  type_label VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  bbch_stage VARCHAR(64),
  conditions JSONB DEFAULT '{"temperature": 25, "humidity": 60, "soilMoisture": 40}'::jsonb,
  geometry JSONB DEFAULT '{"type": "Point", "coordinates": [78.0081, 27.1767]}'::jsonb,
  farmer_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  farmer_name VARCHAR(255),
  listing_id VARCHAR(64) REFERENCES farmer_listings(id) ON DELETE SET NULL,
  crop_name VARCHAR(128),
  variety VARCHAR(128),
  batch_id VARCHAR(64) REFERENCES aggregation_batches(id) ON DELETE SET NULL,
  resources JSONB DEFAULT '[]'::jsonb,
  inputs_outputs JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_farmer ON farm_activities(farmer_id);
CREATE INDEX IF NOT EXISTS idx_activities_listing ON farm_activities(listing_id);
CREATE INDEX IF NOT EXISTS idx_activities_batch ON farm_activities(batch_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON farm_activities(type_uri);
CREATE INDEX IF NOT EXISTS idx_activities_status ON farm_activities(status);
