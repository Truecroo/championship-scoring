-- Штрафные баллы для команд (например -0.2 за музыку)
-- Запустить в Supabase Dashboard → SQL Editor

ALTER TABLE teams ADD COLUMN IF NOT EXISTS penalty NUMERIC(4,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN teams.penalty IS 'Штраф (отрицательное число, вычитается из итогового балла судей)';
