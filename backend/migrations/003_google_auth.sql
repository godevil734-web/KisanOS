-- 003_google_auth.sql: Support Google Authentication & Avatar
-- Adds google_id and avatar_url to users table for Google Sign-in and OTP 2FA

-- 1. Add google_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);

-- 2. Add avatar_url column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 3. Unique index on google_id where not null to prevent duplicate account links
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
