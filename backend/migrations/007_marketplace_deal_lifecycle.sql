-- 007_marketplace_deal_lifecycle.sql
-- Completes Offer -> Acceptance / Counter / Rejection -> Deal lifecycle

-- 1. Extend offers table with counter-offer, deal linkage, and update timestamps
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS offered_price_per_kg NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS deal_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS counter_price_per_kg NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS counter_quantity_tons NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS counter_message TEXT,
  ADD COLUMN IF NOT EXISTS counter_by VARCHAR(64),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill offered_price_per_kg from farmer_expected_price_per_kg or buyer_offered_price_per_kg if null
UPDATE offers 
SET offered_price_per_kg = COALESCE(farmer_expected_price_per_kg, buyer_offered_price_per_kg, 0)
WHERE offered_price_per_kg IS NULL;

CREATE INDEX IF NOT EXISTS idx_offers_buyer_id ON offers(buyer_id);
CREATE INDEX IF NOT EXISTS idx_offers_seller_id ON offers(seller_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_listing_id ON offers(listing_id);

-- 2. Extend orders (Deals) table with explicit linkages & quality grade
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS offer_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS listing_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS requirement_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS agreed_price_per_kg NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS quality_grade VARCHAR(64),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill agreed_price_per_kg from unit_price_per_kg if null
UPDATE orders 
SET agreed_price_per_kg = unit_price_per_kg
WHERE agreed_price_per_kg IS NULL AND unit_price_per_kg IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_offer_id ON orders(offer_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_listing_id ON orders(listing_id);

-- 3. Extend audit_log table so system/actor events can be recorded from any user
ALTER TABLE audit_log ALTER COLUMN admin_id DROP NOT NULL;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_id VARCHAR(64);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_role VARCHAR(32);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON audit_log(actor_id);

-- 4. Extend farmer_listings and buyer_requirements with updated_at
ALTER TABLE farmer_listings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE buyer_requirements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
