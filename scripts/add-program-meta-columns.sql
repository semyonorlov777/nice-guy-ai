-- Добавляет колонки meta_title и meta_description в таблицу programs
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text;
