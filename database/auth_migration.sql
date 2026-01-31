-- Authentication tables for judges and admin
-- Run this after the main schema.sql

-- Judges authentication table
CREATE TABLE IF NOT EXISTS judge_auth (
  id TEXT PRIMARY KEY CHECK (id IN ('1', '2', '3')),
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin authentication table
CREATE TABLE IF NOT EXISTS admin_auth (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial row for admin (password: admin123)
-- You can change this password in Supabase dashboard
INSERT INTO admin_auth (id, password)
VALUES (1, 'admin123')
ON CONFLICT (id) DO NOTHING;

-- Insert initial judges (all passwords: judge123)
-- You can change these passwords in Supabase dashboard
INSERT INTO judge_auth (id, password, name) VALUES
('1', 'judge123', 'Судья 1'),
('2', 'judge123', 'Судья 2'),
('3', 'judge123', 'Судья 3')
ON CONFLICT (id) DO NOTHING;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_judge_auth_id ON judge_auth(id);

-- Trigger for judge_auth table
CREATE TRIGGER update_judge_auth_updated_at
  BEFORE UPDATE ON judge_auth
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for admin_auth table
CREATE TRIGGER update_admin_auth_updated_at
  BEFORE UPDATE ON admin_auth
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE judge_auth IS 'Аутентификация судей (ID: 1, 2, 3)';
COMMENT ON TABLE admin_auth IS 'Аутентификация администратора';
