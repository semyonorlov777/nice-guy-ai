-- Migrate welcome messages from config JSONB to dedicated columns
-- Run this ONCE after adding the new columns

-- 1. Copy free chat welcome from programs.config to programs.free_chat_welcome
UPDATE programs
SET free_chat_welcome = config->>'welcome_message'
WHERE config->>'welcome_message' IS NOT NULL
  AND (free_chat_welcome IS NULL OR free_chat_welcome = '');

-- 2. Copy exercise welcome from exercises.config to exercises.welcome_message
UPDATE exercises
SET welcome_message = config->>'welcome_message'
WHERE config->>'welcome_message' IS NOT NULL
  AND (welcome_message IS NULL OR welcome_message = '');

-- 3. Verify results
SELECT slug, LEFT(free_chat_welcome, 60) AS welcome_preview
FROM programs
WHERE free_chat_welcome IS NOT NULL;

SELECT number, title, LEFT(welcome_message, 60) AS welcome_preview
FROM exercises
WHERE welcome_message IS NOT NULL
ORDER BY number;
