-- 008_two_way_offers_negotiation.sql
-- Two-way Farmer <-> Buyer offers, structured negotiation history, and inventory reservation

-- 1. Extend offers table with initiator, recipient, terms, target_date, negotiation_history, and last_action
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS initiator_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS initiator_role VARCHAR(32),
  ADD COLUMN IF NOT EXISTS recipient_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS recipient_role VARCHAR(32),
  ADD COLUMN IF NOT EXISTS pickup_terms VARCHAR(255),
  ADD COLUMN IF NOT EXISTS target_date DATE,
  ADD COLUMN IF NOT EXISTS negotiation_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_action_by VARCHAR(64),
  ADD COLUMN IF NOT EXISTS last_action_role VARCHAR(32);

-- Backfill existing offers if missing
UPDATE offers
SET 
  initiator_id = COALESCE(initiator_id, seller_id),
  initiator_role = COALESCE(initiator_role, seller_role, 'farmer'),
  recipient_id = COALESCE(recipient_id, buyer_id),
  recipient_role = COALESCE(recipient_role, 'buyer'),
  last_action_by = COALESCE(last_action_by, initiator_id, seller_id),
  last_action_role = COALESCE(last_action_role, initiator_role, seller_role, 'farmer')
WHERE initiator_id IS NULL;

-- 2. Extend farmer_listings to track reserved and confirmed quantities
ALTER TABLE farmer_listings
  ADD COLUMN IF NOT EXISTS reserved_quantity_tons NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmed_quantity_tons NUMERIC(10,2) DEFAULT 0;

-- 3. Extend buyer_requirements to track confirmed procurement
ALTER TABLE buyer_requirements
  ADD COLUMN IF NOT EXISTS confirmed_procured_tons NUMERIC(10,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_offers_initiator ON offers(initiator_id);
CREATE INDEX IF NOT EXISTS idx_offers_recipient ON offers(recipient_id);
