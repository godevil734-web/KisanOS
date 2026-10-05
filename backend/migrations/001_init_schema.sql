-- 001_init_schema.sql: KisanConnect Relational Schema for Supabase PostgreSQL
-- All tables have Row Level Security enabled with no public policies.

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(32) UNIQUE,
  username VARCHAR(64) UNIQUE,
  password VARCHAR(255),
  role VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  phone_verified BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  auth_methods JSONB DEFAULT '["phone"]'::jsonb,
  location VARCHAR(255),
  rating NUMERIC(3,2) DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  completed_orders INTEGER DEFAULT 0,
  is_demo BOOLEAN DEFAULT FALSE,
  farmer_profile JSONB,
  aggregator_profile JSONB,
  buyer_profile JSONB,
  business_profile JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 2. Crops Catalog
CREATE TABLE IF NOT EXISTS crops (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  category VARCHAR(64),
  default_unit VARCHAR(32),
  varieties JSONB,
  standard_grades JSONB,
  storage_type VARCHAR(64),
  key_quality_params JSONB,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Farmer Listings
CREATE TABLE IF NOT EXISTS farmer_listings (
  id VARCHAR(64) PRIMARY KEY,
  farmer_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  farmer_name VARCHAR(255),
  farmer_phone VARCHAR(32),
  crop_id VARCHAR(64),
  crop_name VARCHAR(128) NOT NULL,
  variety VARCHAR(128),
  grade VARCHAR(32),
  quantity_tons NUMERIC(10,2) NOT NULL,
  expected_price_per_kg NUMERIC(10,2) NOT NULL,
  harvest_date DATE,
  location VARCHAR(255),
  images JSONB DEFAULT '[]'::jsonb,
  storage_requirement VARCHAR(64),
  status VARCHAR(32) DEFAULT 'ACTIVE',
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_crop ON farmer_listings(crop_name);
CREATE INDEX IF NOT EXISTS idx_listings_farmer ON farmer_listings(farmer_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON farmer_listings(status);

-- 4. Buyer Requirements
CREATE TABLE IF NOT EXISTS buyer_requirements (
  id VARCHAR(64) PRIMARY KEY,
  buyer_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  buyer_name VARCHAR(255),
  buyer_company VARCHAR(255),
  crop_id VARCHAR(64),
  crop_name VARCHAR(128) NOT NULL,
  variety VARCHAR(128),
  quantity_tons NUMERIC(10,2) NOT NULL,
  unit VARCHAR(32) DEFAULT 'tonnes',
  grade_required VARCHAR(32),
  size_min_mm NUMERIC(10,2),
  size_max_mm NUMERIC(10,2),
  max_moisture NUMERIC(5,2),
  max_defects NUMERIC(5,2),
  location VARCHAR(255),
  required_date DATE,
  offered_price_per_kg NUMERIC(10,2) NOT NULL,
  delivery_type VARCHAR(64),
  status VARCHAR(32) DEFAULT 'OPEN',
  special_requirements TEXT,
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reqs_crop ON buyer_requirements(crop_name);
CREATE INDEX IF NOT EXISTS idx_reqs_buyer ON buyer_requirements(buyer_id);
CREATE INDEX IF NOT EXISTS idx_reqs_status ON buyer_requirements(status);

-- 5. Aggregation Batches
CREATE TABLE IF NOT EXISTS aggregation_batches (
  id VARCHAR(64) PRIMARY KEY,
  aggregator_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  aggregator_name VARCHAR(255),
  buyer_requirement_id VARCHAR(64),
  buyer_name VARCHAR(255),
  crop_name VARCHAR(128) NOT NULL,
  variety VARCHAR(128),
  target_quantity_tons NUMERIC(10,2) NOT NULL,
  current_aggregated_tons NUMERIC(10,2) DEFAULT 0,
  status VARCHAR(32) DEFAULT 'GATHERING',
  buyer_sale_price_per_kg NUMERIC(10,2),
  estimated_logistics_cost_per_kg NUMERIC(10,2),
  estimated_storage_cost_per_kg NUMERIC(10,2),
  estimated_platform_fee_per_kg NUMERIC(10,2),
  farmer_purchase_price_avg NUMERIC(10,2),
  estimated_gross_margin_per_kg NUMERIC(10,2),
  farmers JSONB DEFAULT '[]'::jsonb,
  collection_route JSONB,
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_agg ON aggregation_batches(aggregator_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON aggregation_batches(status);

-- 6. Cold Storages
CREATE TABLE IF NOT EXISTS cold_storages (
  id VARCHAR(64) PRIMARY KEY,
  owner_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  total_capacity_tons NUMERIC(10,2),
  occupied_capacity_tons NUMERIC(10,2),
  available_capacity_tons NUMERIC(10,2),
  utilization_percent NUMERIC(5,2),
  storage_charge_per_month_per_ton NUMERIC(10,2),
  supported_crops JSONB,
  facilities JSONB,
  status VARCHAR(32) DEFAULT 'ACTIVE',
  manager_contact VARCHAR(32),
  inventory JSONB,
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Storage Bookings
CREATE TABLE IF NOT EXISTS storage_bookings (
  id VARCHAR(64) PRIMARY KEY,
  storage_id VARCHAR(64) REFERENCES cold_storages(id) ON DELETE CASCADE,
  storage_name VARCHAR(255),
  farmer_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  farmer_name VARCHAR(255),
  crop_name VARCHAR(128),
  variety VARCHAR(128),
  quantity_tons NUMERIC(10,2),
  entry_date DATE,
  expected_release_date DATE,
  duration_months INTEGER,
  rate_per_ton_per_month NUMERIC(10,2),
  total_storage_charge NUMERIC(12,2),
  status VARCHAR(32) DEFAULT 'ACTIVE',
  receipt_number VARCHAR(64),
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storage_bookings_farmer ON storage_bookings(farmer_id);
CREATE INDEX IF NOT EXISTS idx_storage_bookings_storage ON storage_bookings(storage_id);

-- 8. Transporters
CREATE TABLE IF NOT EXISTS transporters (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  transporter_name VARCHAR(255),
  company_name VARCHAR(255),
  base_location VARCHAR(255),
  rating NUMERIC(3,2) DEFAULT 0,
  total_trips_completed INTEGER DEFAULT 0,
  vehicles JSONB,
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Transporter Bookings
CREATE TABLE IF NOT EXISTS transporter_bookings (
  id VARCHAR(64) PRIMARY KEY,
  transporter_id VARCHAR(64) REFERENCES transporters(id) ON DELETE CASCADE,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id VARCHAR(64),
  origin VARCHAR(255),
  destination VARCHAR(255),
  crop_name VARCHAR(128),
  quantity_tons NUMERIC(10,2),
  pickup_date DATE,
  total_amount NUMERIC(12,2),
  status VARCHAR(32) DEFAULT 'REQUESTED',
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  price_per_month NUMERIC(10,2),
  price_per_year NUMERIC(10,2),
  max_aggregation_capacity_tons NUMERIC(10,2),
  allowed_crops JSONB,
  analytics_access BOOLEAN DEFAULT FALSE,
  storage_access BOOLEAN DEFAULT FALSE,
  demand_alerts BOOLEAN DEFAULT FALSE,
  priority_matching BOOLEAN DEFAULT FALSE,
  supply_forecasting_access BOOLEAN DEFAULT FALSE,
  badge VARCHAR(64),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Offers & Negotiation
CREATE TABLE IF NOT EXISTS offers (
  id VARCHAR(64) PRIMARY KEY,
  requirement_id VARCHAR(64),
  listing_id VARCHAR(64),
  buyer_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  buyer_name VARCHAR(255),
  seller_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  seller_name VARCHAR(255),
  seller_role VARCHAR(32),
  crop_name VARCHAR(128),
  variety VARCHAR(128),
  quantity_tons NUMERIC(10,2),
  buyer_offered_price_per_kg NUMERIC(10,2),
  farmer_expected_price_per_kg NUMERIC(10,2),
  status VARCHAR(32) DEFAULT 'PENDING',
  delivery_terms TEXT,
  message TEXT,
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offers_buyer ON offers(buyer_id);
CREATE INDEX IF NOT EXISTS idx_offers_seller ON offers(seller_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);

-- 12. Orders & Escrow
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) PRIMARY KEY,
  order_number VARCHAR(64) UNIQUE,
  buyer_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  buyer_name VARCHAR(255),
  seller_type VARCHAR(32),
  seller_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  seller_name VARCHAR(255),
  crop_name VARCHAR(128),
  variety VARCHAR(128),
  quantity_tons NUMERIC(10,2),
  unit_price_per_kg NUMERIC(10,2),
  produce_total NUMERIC(12,2),
  logistics_cost NUMERIC(12,2),
  platform_fee NUMERIC(12,2),
  total_amount NUMERIC(12,2),
  pickup_location VARCHAR(255),
  delivery_location VARCHAR(255),
  transporter_id VARCHAR(64),
  transporter_name VARCHAR(255),
  status VARCHAR(32) DEFAULT 'CREATED',
  payment_status VARCHAR(64) DEFAULT 'PENDING',
  estimated_delivery_date DATE,
  timeline JSONB DEFAULT '[]'::jsonb,
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- 13. Market Prices
CREATE TABLE IF NOT EXISTS market_prices (
  id VARCHAR(64) PRIMARY KEY,
  crop_name VARCHAR(128) NOT NULL,
  variety VARCHAR(128),
  mandi VARCHAR(255),
  district VARCHAR(128),
  state VARCHAR(128),
  date DATE,
  min_price NUMERIC(10,2),
  max_price NUMERIC(10,2),
  modal_price NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_prices_crop ON market_prices(crop_name);
CREATE INDEX IF NOT EXISTS idx_market_prices_district ON market_prices(district);

-- 14. Regional Supply Forecasts
CREATE TABLE IF NOT EXISTS regional_supply_forecasts (
  id VARCHAR(64) PRIMARY KEY,
  region VARCHAR(255) NOT NULL,
  crop VARCHAR(128) NOT NULL,
  estimated_supply_tons NUMERIC(12,2),
  estimated_demand_tons NUMERIC(12,2),
  potential_balance NUMERIC(12,2),
  balance_type VARCHAR(64),
  harvest_window VARCHAR(128),
  confidence_score TEXT,
  cold_storage_buffer_tons NUMERIC(12,2),
  recommendation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64),
  title VARCHAR(255),
  message TEXT,
  type VARCHAR(64),
  read BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- 16. Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(64) PRIMARY KEY,
  target_user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  reviewer_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  reviewer_name VARCHAR(255),
  reviewer_role VARCHAR(32),
  order_id VARCHAR(64),
  rating NUMERIC(3,2) NOT NULL,
  comment TEXT,
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_user_id);

-- 17. Persistent OTPs (with expiry)
CREATE TABLE IF NOT EXISTS otps (
  phone VARCHAR(32) PRIMARY KEY,
  code VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otps_expiry ON otps(expires_at);

-- 18. Persistent Rate Limits (Fixed-window atomic counter)
CREATE TABLE IF NOT EXISTS rate_limits (
  key VARCHAR(255) PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- Express server connects as database owner, so it has access.
-- Direct unauthenticated API requests are completely locked.
-- =========================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregation_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE cold_storages ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transporters ENABLE ROW LEVEL SECURITY;
ALTER TABLE transporter_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_supply_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
