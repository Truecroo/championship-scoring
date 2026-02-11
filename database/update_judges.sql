-- Обновление судей на новый состав
-- Алинучи, Эмиль, Алина Черновская

-- Удаляем старых судей
DELETE FROM judges;

-- Добавляем новых судей
INSERT INTO judges (name, password) VALUES
  ('Алинучи', '$2a$10$defaultpasswordhash1'),
  ('Эмиль', '$2a$10$defaultpasswordhash2'),
  ('Алина Черновская', '$2a$10$defaultpasswordhash3');

-- Проверка
SELECT id, name FROM judges ORDER BY id;
