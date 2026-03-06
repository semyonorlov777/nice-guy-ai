-- Добавляет колонку chapter_title в таблицу exercises
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS chapter_title text;
