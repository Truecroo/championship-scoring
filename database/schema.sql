-- Championship Scoring System Database Schema for Supabase (PostgreSQL)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Nominations table (номинации)
CREATE TABLE IF NOT EXISTS nominations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams table (команды)
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  nomination_id UUID NOT NULL REFERENCES nominations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scores table (оценки судей)
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  judge_id TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  nomination_id UUID NOT NULL REFERENCES nominations(id) ON DELETE CASCADE,
  choreography_score NUMERIC(4,2) NOT NULL CHECK (choreography_score >= 0.1 AND choreography_score <= 10),
  choreography_comment TEXT,
  technique_score NUMERIC(4,2) NOT NULL CHECK (technique_score >= 0.1 AND technique_score <= 10),
  technique_comment TEXT,
  artistry_score NUMERIC(4,2) NOT NULL CHECK (artistry_score >= 0.1 AND artistry_score <= 10),
  artistry_comment TEXT,
  overall_score NUMERIC(4,2) NOT NULL CHECK (overall_score >= 0.1 AND overall_score <= 10),
  overall_comment TEXT,
  weighted_average NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(judge_id, team_id)
);

-- Spectator scores table (зрительские голоса)
CREATE TABLE IF NOT EXISTS spectator_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  nomination_id UUID NOT NULL REFERENCES nominations(id) ON DELETE CASCADE,
  score NUMERIC(4,2) NOT NULL CHECK (score >= 0.1 AND score <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Current team table (текущая команда для зрителей)
CREATE TABLE IF NOT EXISTS current_team (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  nomination_id UUID REFERENCES nominations(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial row for current_team
INSERT INTO current_team (id, team_id, nomination_id)
VALUES (1, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_teams_nomination ON teams(nomination_id);
CREATE INDEX IF NOT EXISTS idx_scores_team ON scores(team_id);
CREATE INDEX IF NOT EXISTS idx_scores_nomination ON scores(nomination_id);
CREATE INDEX IF NOT EXISTS idx_scores_judge ON scores(judge_id);
CREATE INDEX IF NOT EXISTS idx_spectator_scores_team ON spectator_scores(team_id);
CREATE INDEX IF NOT EXISTS idx_spectator_scores_nomination ON spectator_scores(nomination_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for scores table
CREATE TRIGGER update_scores_updated_at
  BEFORE UPDATE ON scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for current_team table
CREATE TRIGGER update_current_team_updated_at
  BEFORE UPDATE ON current_team
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (опционально, можно включить позже)
-- ALTER TABLE nominations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE spectator_scores ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE current_team ENABLE ROW LEVEL SECURITY;

-- Create policies (если включен RLS)
-- CREATE POLICY "Allow all operations for now" ON nominations FOR ALL USING (true);
-- CREATE POLICY "Allow all operations for now" ON teams FOR ALL USING (true);
-- CREATE POLICY "Allow all operations for now" ON scores FOR ALL USING (true);
-- CREATE POLICY "Allow all operations for now" ON spectator_scores FOR ALL USING (true);
-- CREATE POLICY "Allow all operations for now" ON current_team FOR ALL USING (true);

COMMENT ON TABLE nominations IS 'Номинации чемпионата';
COMMENT ON TABLE teams IS 'Команды участников';
COMMENT ON TABLE scores IS 'Оценки судей с весами: Хореография 45%, Техника 35%, Артистизм 15%, Общее 5%';
COMMENT ON TABLE spectator_scores IS 'Зрительские голоса';
COMMENT ON TABLE current_team IS 'Текущая команда для зрительского голосования';
