-- =============================================================
-- Fix 100-notes welcome_ai_message
-- Баги:
--   W4 — markdown `**` рендерится буквально в NewChatScreen (plain-text)
--   W6 — первая строка "EMOJI **Title**" дублирует welcome_title,
--        который уже показан в шапке карточки
-- Что делает скрипт:
--   1. Убирает ведущую строку "EMOJI **Title**\n\n" в каждом из 7 режимов
--   2. Заменяет "**Что ты получишь:**" → "Что ты получишь:" (без markdown)
-- Источник правил: docs/runbooks/chat-message-formatting.md
-- =============================================================

BEGIN;

-- Убираем эмодзи+заголовок в начале (per-mode, т.к. эмодзи и название разные)
UPDATE program_modes pm
SET welcome_ai_message = REPLACE(
  pm.welcome_ai_message,
  E'🔓 **Деконструктор страхов**\n\n',
  ''
)
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_fear_deconstruct'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

UPDATE program_modes pm
SET welcome_ai_message = REPLACE(
  pm.welcome_ai_message,
  E'🚀 **Масштаб мышления**\n\n',
  ''
)
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_scale_thinking'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

UPDATE program_modes pm
SET welcome_ai_message = REPLACE(
  pm.welcome_ai_message,
  E'⚡ **Архитектор энергии**\n\n',
  ''
)
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_energy_architect'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

UPDATE program_modes pm
SET welcome_ai_message = REPLACE(
  pm.welcome_ai_message,
  E'🎯 **Переключатель на удовольствие**\n\n',
  ''
)
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_pleasure_switch'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

UPDATE program_modes pm
SET welcome_ai_message = REPLACE(
  pm.welcome_ai_message,
  E'🔍 **Аудит окружения**\n\n',
  ''
)
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_environment_audit'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

UPDATE program_modes pm
SET welcome_ai_message = REPLACE(
  pm.welcome_ai_message,
  E'🧪 **Бизнес-лаборатория**\n\n',
  ''
)
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_business_lab'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

UPDATE program_modes pm
SET welcome_ai_message = REPLACE(
  pm.welcome_ai_message,
  E'📓 **Дневник самонаблюдения**\n\n',
  ''
)
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_self_journal'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- Глобально для всех 7: убираем **markdown** в "Что ты получишь"
UPDATE program_modes pm
SET welcome_ai_message = REPLACE(
  pm.welcome_ai_message,
  '**Что ты получишь:**',
  'Что ты получишь:'
)
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key LIKE 'notes_%'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- Верификация: все 7 должны вернуть has_md_bold=false и first_char_ok=true
SELECT mt.key,
  pm.welcome_ai_message LIKE '%**%' as has_md_bold,
  LEFT(pm.welcome_ai_message, 40) as first_chars,
  LENGTH(pm.welcome_ai_message) as msg_len
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
WHERE mt.key LIKE 'notes_%'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes')
ORDER BY pm.sort_order;

COMMIT;
