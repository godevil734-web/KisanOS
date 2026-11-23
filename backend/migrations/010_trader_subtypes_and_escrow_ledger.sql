-- 010_trader_subtypes_and_escrow_ledger.sql
-- Phase 2: Schema extension for Trader Subtypes, Escrow/Payment Ledger, Quality Inspection, and Procurement Allocations

-- 1. Extend users table for Trader & Buyer Subtypes
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS trader_subtype VARCHAR(32) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS apmc_license_number VARCHAR(64) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mandi_name VARCHAR(128) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS company_type VARCHAR(64) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tax_id_gst VARCHAR(32) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_trader_subtype ON users(trader_subtype);
CREATE INDEX IF NOT EXISTS idx_users_mandi_name ON users(mandi_name);

-- 2. Double-Entry Payment & Escrow Transactions Ledger
CREATE TABLE IF NOT EXISTS payment_transactions (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payer_id VARCHAR(64) NOT NULL REFERENCES users(id),
  payee_id VARCHAR(64) NOT NULL REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL,
  transaction_type VARCHAR(32) NOT NULL, -- 'ESCROW_DEPOSIT', 'FARMER_PAYOUT', 'AGGREGATOR_COMMISSION', 'TRANSPORTER_FREIGHT', 'PLATFORM_FEE', 'REFUND', 'DISPUTE_HOLD'
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'ESCROWED', 'SETTLED', 'DISPUTED', 'REFUNDED'
  payment_gateway_ref VARCHAR(128),
  bank_reference VARCHAR(128),
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pay_tx_order ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_pay_tx_payer ON payment_transactions(payer_id);
CREATE INDEX IF NOT EXISTS idx_pay_tx_payee ON payment_transactions(payee_id);
CREATE INDEX IF NOT EXISTS idx_pay_tx_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_pay_tx_type ON payment_transactions(transaction_type);

-- 3. Digital Weighbridge & Quality Inspection (QC) Slips
CREATE TABLE IF NOT EXISTS inspection_slips (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  inspector_id VARCHAR(64) REFERENCES users(id),
  inspector_name VARCHAR(255),
  weighbridge_gross_kg NUMERIC(10,2),
  weighbridge_tare_kg NUMERIC(10,2),
  net_weight_kg NUMERIC(10,2) NOT NULL,
  moisture_percent NUMERIC(5,2),
  foreign_matter_percent NUMERIC(5,2),
  quality_grade_verified VARCHAR(32),
  deduction_kg NUMERIC(10,2) DEFAULT 0,
  slip_images JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  status VARCHAR(32) DEFAULT 'VERIFIED', -- 'PENDING', 'VERIFIED', 'DISPUTED', 'REJECTED'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_order ON inspection_slips(order_id);
CREATE INDEX IF NOT EXISTS idx_inspection_inspector ON inspection_slips(inspector_id);
CREATE INDEX IF NOT EXISTS idx_inspection_status ON inspection_slips(status);

-- 4. Multi-Farmer Procurement Allocations Join Table
CREATE TABLE IF NOT EXISTS procurement_allocations (
  id VARCHAR(64) PRIMARY KEY,
  plan_id VARCHAR(64) NOT NULL REFERENCES procurement_plans(id) ON DELETE CASCADE,
  listing_id VARCHAR(64) NOT NULL REFERENCES farmer_listings(id),
  farmer_id VARCHAR(64) NOT NULL REFERENCES users(id),
  farmer_name VARCHAR(255),
  allocated_quantity_tons NUMERIC(10,2) NOT NULL,
  agreed_farmer_price_per_kg NUMERIC(10,2) NOT NULL,
  status VARCHAR(32) DEFAULT 'COMMITTED', -- 'COMMITTED', 'DISPATCHED', 'SETTLED', 'CANCELLED'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proc_alloc_plan ON procurement_allocations(plan_id);
CREATE INDEX IF NOT EXISTS idx_proc_alloc_listing ON procurement_allocations(listing_id);
CREATE INDEX IF NOT EXISTS idx_proc_alloc_farmer ON procurement_allocations(farmer_id);
CREATE INDEX IF NOT EXISTS idx_proc_alloc_status ON procurement_allocations(status);

-- 5. Enable Row Level Security (RLS) on new tables
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_allocations ENABLE ROW LEVEL SECURITY;

