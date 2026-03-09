-- Миграция: Мульти-чат система
-- Добавляет title и last_message_at в таблицу chats

-- 1. Новые колонки
ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz DEFAULT now();

-- 2. Индекс для списка чатов (user + program + status, сортировка по last_message_at)
CREATE INDEX IF NOT EXISTS idx_chats_user_program_status_last_msg
  ON chats (user_id, program_id, status, last_message_at DESC);

-- 3. Бэкфил title из первого user-сообщения (до 50 символов)
UPDATE chats c SET title = (
  SELECT LEFT(m.content, 50) FROM messages m
  WHERE m.chat_id = c.id AND m.role = 'user'
  ORDER BY m.created_at ASC LIMIT 1
) WHERE c.title IS NULL;

-- 4. Бэкфил last_message_at из последнего сообщения
UPDATE chats c SET last_message_at = COALESCE(
  (SELECT MAX(m.created_at) FROM messages m WHERE m.chat_id = c.id),
  c.created_at
);
