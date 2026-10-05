-- 004_email_otp.sql: Support Email Verification OTPs
-- Increases otps identifier column to VARCHAR(255) to support both email addresses and phone numbers

ALTER TABLE otps ALTER COLUMN phone TYPE VARCHAR(255);
