-- Добавляет колонку features (JSONB) в programs для динамической навигации
ALTER TABLE programs ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '{}';

UPDATE programs SET features = '{"test": true, "portrait": true, "free_chat": true}' WHERE slug = 'nice-guy';
