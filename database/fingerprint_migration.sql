-- Add fingerprint column to spectator_scores table
-- Run this in Supabase SQL Editor

ALTER TABLE spectator_scores
ADD COLUMN IF NOT EXISTS fingerprint TEXT;

-- Add unique constraint to prevent duplicate votes from same device for same team
CREATE UNIQUE INDEX IF NOT EXISTS idx_spectator_unique_vote
ON spectator_scores(team_id, nomination_id, fingerprint);

COMMENT ON COLUMN spectator_scores.fingerprint IS 'Device fingerprint для ограничения голосов (один голос за команду с устройства)';
