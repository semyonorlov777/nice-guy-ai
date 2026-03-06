-- Добавляет колонку portrait_prompt в таблицу programs
-- Выполнить ДО деплоя нового кода
ALTER TABLE programs ADD COLUMN IF NOT EXISTS portrait_prompt TEXT;
