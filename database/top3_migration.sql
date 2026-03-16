-- Migration: Add Top-3 Final Audience Voting mode
-- Run this on existing database

-- 1. Add voting_mode to current_team singleton
ALTER TABLE current_team
ADD COLUMN IF NOT EXISTS voting_mode TEXT NOT NULL DEFAULT 'live';
-- Values: 'live' (per-team scoring), 'top3' (final top-3 pick), 'closed' (voting disabled)

-- 2. Create top3_votes table
CREATE TABLE IF NOT EXISTS top3_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fingerprint TEXT NOT NULL,
  first_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  second_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  third_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT top3_votes_unique_fingerprint UNIQUE (fingerprint),
  CONSTRAINT top3_votes_distinct_picks CHECK (
    first_team_id != second_team_id
    AND first_team_id != third_team_id
    AND second_team_id != third_team_id
  )
);

CREATE INDEX IF NOT EXISTS idx_top3_votes_fingerprint ON top3_votes(fingerprint);

COMMENT ON TABLE top3_votes IS 'Top-3 финальные голоса зрителей: 1-е место=3 очка, 2-е=2, 3-е=1';
COMMENT ON COLUMN current_team.voting_mode IS 'Режим голосования: live, top3, closed';
