-- =============================================================
-- Fix 100-notes welcome_replies
-- Баг W7 — replies хранятся как массив строк вместо объектов.
--   normalizeWelcomeReplies покрывает строки, но теряется управление
--   type="exit" для последнего safe-exit reply (визуально мягче).
-- Формат после фикса: [{"text": "...", "type": "normal"|"exit"}]
--   Последний reply у всех 7 режимов = type="exit" (начинается с "Мне сложно...").
-- Источник правил: docs/runbooks/chat-message-formatting.md
-- =============================================================

BEGIN;

-- 1. Деконструктор страхов
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Я боюсь запустить проект — вдруг не получится", "type": "normal"},
  {"text": "Я вижу чужие успехи и чувствую зависть и бессилие", "type": "normal"},
  {"text": "Я знаю что нужно делать, но постоянно откладываю", "type": "normal"},
  {"text": "Мне сложно сформулировать свой страх", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_fear_deconstruct'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- 2. Масштаб мышления
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Хочу зарабатывать больше, но не верю что реально", "type": "normal"},
  {"text": "У меня есть цель, но она кажется нереальной", "type": "normal"},
  {"text": "Я застрял на одном уровне дохода уже давно", "type": "normal"},
  {"text": "Мне сложно сформулировать — просто чувствую потолок", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_scale_thinking'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- 3. Архитектор энергии
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Я постоянно устаю и не понимаю почему", "type": "normal"},
  {"text": "Я выгорел и не могу собраться", "type": "normal"},
  {"text": "Хочу разобраться с незавершёнными делами", "type": "normal"},
  {"text": "Мне сложно сформулировать — просто нет сил", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_energy_architect'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- 4. Переключатель на удовольствие
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Я достигаю целей, но радости от этого ноль", "type": "normal"},
  {"text": "Мне кажется, что без надрыва результат «не считается»", "type": "normal"},
  {"text": "Хочу найти кайф в том, что делаю каждый день", "type": "normal"},
  {"text": "Мне сложно — я не помню, когда последний раз радовался работе", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_pleasure_switch'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- 5. Аудит окружения
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Чувствую, что моё окружение тянет меня вниз", "type": "normal"},
  {"text": "Есть один человек, с которым не могу разобраться", "type": "normal"},
  {"text": "Хочу научиться говорить правду без конфликтов", "type": "normal"},
  {"text": "Мне сложно сформулировать — просто чувствую дискомфорт", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_environment_audit'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- 6. Бизнес-лаборатория
-- Примечание: у этого режима нет классического "Мне сложно..." exit,
-- но "Хочу попробовать кейс" — это позитивное пожелание, не safe exit.
-- Делаем последний exit-ом "Мне сложно делегировать..." (единственный с "Мне сложно").
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Хочу понять, почему доход не растёт", "type": "normal"},
  {"text": "Хочу научиться быстро тестировать идеи", "type": "normal"},
  {"text": "Хочу попробовать кейс", "type": "normal"},
  {"text": "Мне сложно делегировать — кажется, сам сделаю лучше", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_business_lab'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- 7. Дневник самонаблюдения
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Хочу разобраться, почему одна и та же ситуация повторяется", "type": "normal"},
  {"text": "Хочу написать о том, что чувствую прямо сейчас", "type": "normal"},
  {"text": "Хочу найти свой смысл за пределами заработка", "type": "normal"},
  {"text": "Мне сложно начать — не знаю о чём писать", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_self_journal'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- Верификация: все 7 должны вернуть reply_count=4 и last_is_exit=true
SELECT mt.key,
  jsonb_array_length(pm.welcome_replies) as reply_count,
  pm.welcome_replies->-1->>'type' as last_type,
  (pm.welcome_replies->-1->>'type' = 'exit') as last_is_exit
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
WHERE mt.key LIKE 'notes_%'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes')
  AND mt.key != 'test_100_notes'
ORDER BY pm.sort_order;

COMMIT;
