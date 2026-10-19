-- Migration 009: System Settings and Farmer Dashboard Appearance Manager
-- Persists global application settings such as active dashboard theme and layout.

CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100)
);

-- Seed default farmer dashboard appearance setting
-- Preserves Classic Original Dashboard as the default active design
INSERT INTO system_settings (key, value, updated_at, updated_by)
VALUES (
  'farmer_dashboard_appearance',
  '{"activeDesignId": "classic_standard", "theme": "classic", "layout": "standard"}'::jsonb,
  CURRENT_TIMESTAMP,
  'system'
)
ON CONFLICT (key) DO NOTHING;
