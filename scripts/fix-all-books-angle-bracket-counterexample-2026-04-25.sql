-- =============================================================
-- Fix: добавить НЕПРАВИЛЬНО: <текст> контрпример во все system_prompts всех 6 книг
--
-- Причина: Gemini периодически выдаёт варианты в <угловых скобках> вместо «ёлочек»,
-- парсер их не ловит (regex [«"]...[»"]) → текст рендерится plain.
-- Runbook docs/runbooks/chat-message-formatting.md описывает этот сценарий,
-- но в последней уборке (fix-*-prompts-cleanup-2026-04-24) контрпример <>
-- не был добавлен.
--
-- Стратегия: существующий маркер «НЕПРАВИЛЬНО (все на одной строке): ...»
-- присутствует во ВСЕХ 55 system_prompt полях (programs + program_modes).
-- REPLACE добавляет ПОСЛЕ этого маркера новую строку с <> контрпримером.
-- =============================================================

BEGIN;

-- ─── programs.system_prompt (6 книг) ───
UPDATE programs
SET system_prompt = REPLACE(
  system_prompt,
  E'НЕПРАВИЛЬНО (все на одной строке): «Вариант 1» «Вариант 2» «Вариант 3»',
  E'НЕПРАВИЛЬНО (все на одной строке): «Вариант 1» «Вариант 2» «Вариант 3»\nНЕПРАВИЛЬНО: <текст> — угловые скобки НЕ рендерятся как кнопки, используй ТОЛЬКО «ёлочки»'
)
WHERE system_prompt LIKE '%НЕПРАВИЛЬНО (все на одной строке): «Вариант 1» «Вариант 2» «Вариант 3»%';


-- ─── programs.author_chat_system_prompt (6 книг) ───
UPDATE programs
SET author_chat_system_prompt = REPLACE(
  author_chat_system_prompt,
  E'НЕПРАВИЛЬНО (все на одной строке): «Вариант 1» «Вариант 2» «Вариант 3»',
  E'НЕПРАВИЛЬНО (все на одной строке): «Вариант 1» «Вариант 2» «Вариант 3»\nНЕПРАВИЛЬНО: <текст> — угловые скобки НЕ рендерятся как кнопки, используй ТОЛЬКО «ёлочки»'
)
WHERE author_chat_system_prompt LIKE '%НЕПРАВИЛЬНО (все на одной строке): «Вариант 1» «Вариант 2» «Вариант 3»%';


-- ─── program_modes.system_prompt (все режимы, у кого есть маркер) ───
UPDATE program_modes
SET system_prompt = REPLACE(
  system_prompt,
  E'НЕПРАВИЛЬНО (все на одной строке): «Вариант 1» «Вариант 2» «Вариант 3»',
  E'НЕПРАВИЛЬНО (все на одной строке): «Вариант 1» «Вариант 2» «Вариант 3»\nНЕПРАВИЛЬНО: <текст> — угловые скобки НЕ рендерятся как кнопки, используй ТОЛЬКО «ёлочки»'
)
WHERE system_prompt LIKE '%НЕПРАВИЛЬНО (все на одной строке): «Вариант 1» «Вариант 2» «Вариант 3»%';


-- =============================================================
-- Верификация — в каждом поле должно быть «НЕПРАВИЛЬНО: <текст>»
-- =============================================================
SELECT
  'programs.system_prompt' AS field,
  p.slug,
  (system_prompt LIKE '%НЕПРАВИЛЬНО: <текст>%') AS has_angle_counter
FROM programs p
UNION ALL
SELECT
  'programs.author_chat_system_prompt',
  p.slug,
  (author_chat_system_prompt LIKE '%НЕПРАВИЛЬНО: <текст>%')
FROM programs p
UNION ALL
SELECT
  'mode[' || mt.key || ']',
  p.slug,
  (pm.system_prompt LIKE '%НЕПРАВИЛЬНО: <текст>%')
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
JOIN programs p ON p.id = pm.program_id
WHERE pm.system_prompt IS NOT NULL
ORDER BY slug, field;

COMMIT;
