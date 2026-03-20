-- Обновляем features для nice-guy: добавляем exercises и author_chat
-- Текущее значение: {"test": true, "portrait": true, "free_chat": true}
-- Новое значение: все фичи включены
UPDATE programs
SET features = '{"free_chat": true, "exercises": true, "test": true, "portrait": true, "author_chat": true}'::jsonb
WHERE slug = 'nice-guy';
