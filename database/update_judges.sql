-- Обновление имён судей в judge_auth
-- Судья 1 -> Алинучи, Судья 2 -> Эмиль, Судья 3 -> Алина Черновская

UPDATE judge_auth SET name = 'Алинучи' WHERE id = '1';
UPDATE judge_auth SET name = 'Эмиль' WHERE id = '2';
UPDATE judge_auth SET name = 'Алина Черновская' WHERE id = '3';

-- Проверка
SELECT id, name FROM judge_auth ORDER BY id;
