-- 002_audit_log_and_admin.sql: Admin upgrades and audit log table
-- Creates audit_log table and adds rejection_reason column to users table

-- 1. Add rejection_reason column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
  id VARCHAR(64) PRIMARY KEY,
  admin_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(64) NOT NULL,
  target_user_id VARCHAR(64),
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying and audit trail display
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_target_user ON audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin_id ON audit_log(admin_id);

-- Enable Row Level Security (no public policies, accessible only by server role)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
