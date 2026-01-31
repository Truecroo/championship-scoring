-- ============================================
-- PASSWORD HASHING MIGRATION
-- ============================================
-- This script hashes existing plaintext passwords with bcrypt
-- Run this AFTER enabling RLS

-- ============================================
-- IMPORTANT: Follow These Steps in Order
-- ============================================
-- 1. Enable pgcrypto extension (for password hashing)
-- 2. Hash existing default passwords
-- 3. Change to YOUR secure passwords
-- 4. Verify hashing works

-- ============================================
-- Step 1: Enable pgcrypto Extension
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- Step 2: Hash Default Passwords
-- ============================================

-- Hash judge passwords (currently 'judge123')
UPDATE judge_auth
SET password = crypt('judge123', gen_salt('bf'))
WHERE id IN ('1', '2', '3')
  AND password = 'judge123';

-- Hash admin password (currently 'admin123')
UPDATE admin_auth
SET password = crypt('admin123', gen_salt('bf'))
WHERE id = 1
  AND password = 'admin123';

-- ============================================
-- Step 3: Change to YOUR Secure Passwords
-- ============================================
-- CRITICAL: Replace these with your actual passwords!
-- Uncomment and modify the lines below:

/*
-- Example: Change judge passwords
UPDATE judge_auth
SET password = crypt('YourSecureJudgePassword1', gen_salt('bf'))
WHERE id = '1';

UPDATE judge_auth
SET password = crypt('YourSecureJudgePassword2', gen_salt('bf'))
WHERE id = '2';

UPDATE judge_auth
SET password = crypt('YourSecureJudgePassword3', gen_salt('bf'))
WHERE id = '3';

-- Example: Change admin password
UPDATE admin_auth
SET password = crypt('YourSecureAdminPassword', gen_salt('bf'))
WHERE id = 1;
*/

-- ============================================
-- Step 4: Verify Passwords Are Hashed
-- ============================================

-- Check that passwords start with $2 (bcrypt hash indicator)
SELECT
  id,
  name,
  CASE
    WHEN password LIKE '$2%' THEN '✓ Hashed'
    ELSE '✗ Plaintext (INSECURE!)'
  END as password_status,
  LENGTH(password) as password_length
FROM judge_auth
ORDER BY id;

SELECT
  id,
  CASE
    WHEN password LIKE '$2%' THEN '✓ Hashed'
    ELSE '✗ Plaintext (INSECURE!)'
  END as password_status,
  LENGTH(password) as password_length
FROM admin_auth;

-- Expected output:
-- password_status: ✓ Hashed
-- password_length: ~60 characters

-- ============================================
-- Step 5: Test Password Verification
-- ============================================
-- Test that you can verify passwords using Supabase's crypt function

-- Test judge password verification (replace 'judge123' with your actual password)
SELECT
  id,
  name,
  password = crypt('judge123', password) as password_matches
FROM judge_auth
WHERE id = '1';

-- Expected: password_matches = true

-- Test admin password verification (replace 'admin123' with your actual password)
SELECT
  id,
  password = crypt('admin123', password) as password_matches
FROM admin_auth
WHERE id = 1;

-- Expected: password_matches = true

-- ============================================
-- Rollback (if needed)
-- ============================================
-- If something goes wrong, you can restore plaintext passwords
-- WARNING: Only use this for testing/debugging!

/*
UPDATE judge_auth SET password = 'judge123' WHERE id = '1';
UPDATE judge_auth SET password = 'judge123' WHERE id = '2';
UPDATE judge_auth SET password = 'judge123' WHERE id = '3';
UPDATE admin_auth SET password = 'admin123' WHERE id = 1;
*/

-- ============================================
-- Security Notes
-- ============================================
-- 1. Bcrypt hashes are ~60 characters long
-- 2. Each hash is unique (even for same password due to salt)
-- 3. Backend compares passwords using bcrypt.compare()
-- 4. Never store or transmit plaintext passwords
-- 5. Change default passwords IMMEDIATELY after migration

COMMENT ON EXTENSION pgcrypto IS 'Cryptographic functions for password hashing';
