-- Таблица аутентификации модератора
-- Запустить в Supabase Dashboard → SQL Editor

-- 1. Создаём таблицу
CREATE TABLE IF NOT EXISTS moderator_auth (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Вставляем модератора с паролем по умолчанию
INSERT INTO moderator_auth (id, password)
VALUES (1, 'moderator123')
ON CONFLICT (id) DO NOTHING;

-- 3. Хэшируем пароль bcrypt (ОБЯЗАТЕЛЬНО выполнить!)
-- Для этого нужно расширение pgcrypto (уже должно быть включено)
UPDATE moderator_auth
SET password = crypt('moderator123', gen_salt('bf'))
WHERE id = 1 AND password = 'moderator123';

-- 4. Включаем RLS
ALTER TABLE moderator_auth ENABLE ROW LEVEL SECURITY;

-- 5. Политики: только service_role может читать/писать
CREATE POLICY "moderator_auth_select_service" ON moderator_auth
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "moderator_auth_all_service" ON moderator_auth
  FOR ALL USING (auth.role() = 'service_role');

-- Проверка:
-- SELECT id, length(password) as pwd_length FROM moderator_auth;
-- Пароль должен быть ~60 символов (bcrypt hash), не 'moderator123'
