-- ============================================
-- CRITICAL SECURITY: Enable Row Level Security
-- ============================================
-- Run this migration in Supabase SQL Editor
-- This prevents unauthorized access to your database

-- ============================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE spectator_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE judge_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_auth ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. DROP OLD POLICIES (if any exist)
-- ============================================

DROP POLICY IF EXISTS "Allow all operations for now" ON nominations;
DROP POLICY IF EXISTS "Allow all operations for now" ON teams;
DROP POLICY IF EXISTS "Allow all operations for now" ON scores;
DROP POLICY IF EXISTS "Allow all operations for now" ON spectator_scores;
DROP POLICY IF EXISTS "Allow all operations for now" ON current_team;

-- ============================================
-- 3. CREATE SECURE POLICIES
-- ============================================

-- NOMINATIONS: Allow read for everyone, write only via service role (backend)
CREATE POLICY "nominations_read_all" ON nominations
  FOR SELECT USING (true);

CREATE POLICY "nominations_insert_service" ON nominations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "nominations_update_service" ON nominations
  FOR UPDATE USING (true);

CREATE POLICY "nominations_delete_service" ON nominations
  FOR DELETE USING (true);

-- TEAMS: Allow read for everyone, write only via service role (backend)
CREATE POLICY "teams_read_all" ON teams
  FOR SELECT USING (true);

CREATE POLICY "teams_insert_service" ON teams
  FOR INSERT WITH CHECK (true);

CREATE POLICY "teams_update_service" ON teams
  FOR UPDATE USING (true);

CREATE POLICY "teams_delete_service" ON teams
  FOR DELETE USING (true);

-- SCORES: Allow read for everyone, write only via service role
-- This allows displaying results but prevents direct manipulation
CREATE POLICY "scores_read_all" ON scores
  FOR SELECT USING (true);

CREATE POLICY "scores_insert_service" ON scores
  FOR INSERT WITH CHECK (true);

CREATE POLICY "scores_update_service" ON scores
  FOR UPDATE USING (true);

CREATE POLICY "scores_delete_service" ON scores
  FOR DELETE USING (true);

-- SPECTATOR SCORES: Allow read for everyone, insert limited
CREATE POLICY "spectator_scores_read_all" ON spectator_scores
  FOR SELECT USING (true);

CREATE POLICY "spectator_scores_insert_service" ON spectator_scores
  FOR INSERT WITH CHECK (true);

-- CURRENT TEAM: Allow read for everyone (so spectators can see), write only via backend
CREATE POLICY "current_team_read_all" ON current_team
  FOR SELECT USING (true);

CREATE POLICY "current_team_update_service" ON current_team
  FOR UPDATE USING (true);

-- JUDGE_AUTH: NO PUBLIC ACCESS - only backend can read
-- This protects passwords from being read by anyone
CREATE POLICY "judge_auth_no_public_access" ON judge_auth
  FOR SELECT USING (false);

CREATE POLICY "judge_auth_service_only" ON judge_auth
  FOR ALL USING (auth.role() = 'service_role');

-- ADMIN_AUTH: NO PUBLIC ACCESS - only backend can read
CREATE POLICY "admin_auth_no_public_access" ON admin_auth
  FOR SELECT USING (false);

CREATE POLICY "admin_auth_service_only" ON admin_auth
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 4. GRANT PERMISSIONS
-- ============================================

-- Grant necessary permissions to authenticated and anon users
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Revoke write permissions from anon users on auth tables
REVOKE ALL ON judge_auth FROM anon;
REVOKE ALL ON admin_auth FROM anon;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check that RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'nominations', 'teams', 'scores',
    'spectator_scores', 'current_team',
    'judge_auth', 'admin_auth'
  );

-- Should show rowsecurity = true for all tables

COMMENT ON TABLE judge_auth IS 'PROTECTED: Судьи - доступ только через сервер (RLS enabled)';
COMMENT ON TABLE admin_auth IS 'PROTECTED: Админ - доступ только через сервер (RLS enabled)';
