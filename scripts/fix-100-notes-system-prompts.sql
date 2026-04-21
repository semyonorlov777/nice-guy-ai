-- =============================================================
-- Fix 100-notes system_prompts
-- Корневые баги:
--   P1 — правило про quick replies слишком рыхлое
--        ("### Suggested replies\n- От первого лица. 1-5: 3-4. 6-12: 2. 13+: 0-1.")
--        Модель не знает про формат «ёлочек», не знает что другие форматы
--        не рендерятся как кнопки.
--   P2 — внутри ## WELCOME варианты показаны через "— dash" построчно.
--        Модель copy-paste-ит этот формат в свои ответы → скрины 1, 2, 4
--        с блоком "Что дальше?" / списком через "—".
-- Что делает скрипт:
--   1. Глобально: заменяет "### Suggested replies" однострочник
--      на расширенный блок "## ФОРМАТ ОТВЕТА" с буквальным примером
--      «ёлочек» и явным запретом альтернативных форматов.
--   2. Per-mode: заменяет 4 dash-строки в ## WELCOME каждого режима
--      на «ёлочки» построчно (текст совпадает с welcome_replies).
-- Источник правил: docs/runbooks/chat-message-formatting.md
-- =============================================================

BEGIN;

-- =============================================================
-- 1. Замена блока "### Suggested replies" на расширенный
--    "### Quick replies — ФОРМАТ" с буквальным примером.
--    ВНИМАНИЕ: у 5 режимов текст одинаковый, но у notes_fear_deconstruct
--    блок 3-строчный, а у notes_scale_thinking — другой single-liner.
--    Поэтому делаем 3 варианта REPLACE (не общий):
--      - variant A: "### Suggested replies\n- От первого лица. 1-5: 3-4. 6-12: 2. 13+: 0-1."
--        для 5 режимов (energy_architect, pleasure_switch, environment_audit,
--        business_lab, self_journal)
--      - variant B: 3-строчный блок
--        для notes_fear_deconstruct
--      - variant C: "- Реплики = ТОЛЬКО от первого лица. Ходы 1-5..."
--        для notes_scale_thinking
--    Целевой новый блок (NEW_BLOCK) — одинаковый для всех.
-- =============================================================

-- Variant A (5 режимов)
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'### Suggested replies\n- От первого лица. 1-5: 3-4. 6-12: 2. 13+: 0-1.',
  E'### Quick replies — ФОРМАТ (обязательный)\n\nЕсли хочешь предложить варианты ответа — пиши их в КОНЦЕ сообщения, каждый на отдельной строке, в «ёлочках»:\n\n«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»\n\nЭто ЕДИНСТВЕННЫЙ формат, который платформа рендерит как кнопки. Любой другой формат (список через "—" или "-", нумерация "1. ... 2. ...", блок «Что дальше?» с вопросами, перечисление через "•" как варианты ответа) будет показан пользователю plain-текстом без кнопок.\n\nReplies — от первого лица, голос пользователя. Не вопросы к AI. Не задания. Последний reply в начале диалога — безопасный exit («Мне сложно сформулировать» или аналог).\n\n### Scaffolding fading (обязательный)\n\n- Turns 1–5: 3–4 reply в «ёлочках».\n- Turns 6–12: 2 reply.\n- Turns 13+: 0 reply или 1 fallback exit.\n\n### ЗАПРЕЩЕНО в формате ответа\n\n- Блок «Что дальше?» со списком вопросов — рендерится как markdown-текст, не как кнопки.\n- Список вариантов через "—" em-dash или "-" в начале строки.\n- Нумерованные списки «1. ... 2. ...» как варианты ответа.\n- «• Вариант» через буллет как reply — это визуально список, не кнопки.\n- Несколько вопросов за ход — только один вопрос за сообщение.'
)
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key IN ('notes_energy_architect', 'notes_pleasure_switch', 'notes_environment_audit', 'notes_business_lab', 'notes_self_journal')
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- Variant B (notes_fear_deconstruct — 3-строчный блок)
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'### Suggested replies\n- Реплики = ТОЛЬКО высказывания от первого лица пользователя.\n- НИКОГДА не дублируй в репликах то, что уже спросил.\n- Ходы 1-5: 3-4 реплики. Ходы 6-12: 2 реплики. Ходы 13+: 0 или 1 fallback «Мне сложно сформулировать».',
  E'### Quick replies — ФОРМАТ (обязательный)\n\nЕсли хочешь предложить варианты ответа — пиши их в КОНЦЕ сообщения, каждый на отдельной строке, в «ёлочках»:\n\n«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»\n\nЭто ЕДИНСТВЕННЫЙ формат, который платформа рендерит как кнопки. Любой другой формат (список через "—" или "-", нумерация "1. ... 2. ...", блок «Что дальше?» с вопросами, перечисление через "•" как варианты ответа) будет показан пользователю plain-текстом без кнопок.\n\nReplies — от первого лица, голос пользователя. Не вопросы к AI. Не задания. Не дублируй в replies то, что уже спросил в тексте. Последний reply в начале диалога — безопасный exit («Мне сложно сформулировать» или аналог).\n\n### Scaffolding fading (обязательный)\n\n- Turns 1–5: 3–4 reply в «ёлочках».\n- Turns 6–12: 2 reply.\n- Turns 13+: 0 reply или 1 fallback exit.\n\n### ЗАПРЕЩЕНО в формате ответа\n\n- Блок «Что дальше?» со списком вопросов — рендерится как markdown-текст, не как кнопки.\n- Список вариантов через "—" em-dash или "-" в начале строки.\n- Нумерованные списки «1. ... 2. ...» как варианты ответа.\n- «• Вариант» через буллет как reply — это визуально список, не кнопки.\n- Несколько вопросов за ход — только один вопрос за сообщение.'
)
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id AND mt.key = 'notes_fear_deconstruct'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- Variant C (notes_scale_thinking — альтернативный single-liner)
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'### Suggested replies\n- Реплики = ТОЛЬКО от первого лица. Ходы 1-5: 3-4. Ходы 6-12: 2. Ходы 13+: 0-1.',
  E'### Quick replies — ФОРМАТ (обязательный)\n\nЕсли хочешь предложить варианты ответа — пиши их в КОНЦЕ сообщения, каждый на отдельной строке, в «ёлочках»:\n\n«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»\n\nЭто ЕДИНСТВЕННЫЙ формат, который платформа рендерит как кнопки. Любой другой формат (список через "—" или "-", нумерация "1. ... 2. ...", блок «Что дальше?» с вопросами, перечисление через "•" как варианты ответа) будет показан пользователю plain-текстом без кнопок.\n\nReplies — от первого лица, голос пользователя. Не вопросы к AI. Не задания. Последний reply в начале диалога — безопасный exit («Мне сложно сформулировать» или аналог).\n\n### Scaffolding fading (обязательный)\n\n- Turns 1–5: 3–4 reply в «ёлочках».\n- Turns 6–12: 2 reply.\n- Turns 13+: 0 reply или 1 fallback exit.\n\n### ЗАПРЕЩЕНО в формате ответа\n\n- Блок «Что дальше?» со списком вопросов — рендерится как markdown-текст, не как кнопки.\n- Список вариантов через "—" em-dash или "-" в начале строки.\n- Нумерованные списки «1. ... 2. ...» как варианты ответа.\n- «• Вариант» через буллет как reply — это визуально список, не кнопки.\n- Несколько вопросов за ход — только один вопрос за сообщение.'
)
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id AND mt.key = 'notes_scale_thinking'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- =============================================================
-- 2. Per-mode замена dash-строк на «ёлочки» внутри ## WELCOME
--    Заменяем формат "\n— TEXT\n" на "\n«TEXT»\n" для каждой из 4 строк
-- =============================================================

-- 2.1. notes_fear_deconstruct
UPDATE program_modes pm
SET system_prompt = REPLACE(REPLACE(REPLACE(REPLACE(
  pm.system_prompt,
  E'\n— Я боюсь запустить проект — вдруг не получится\n',
  E'\n«Я боюсь запустить проект — вдруг не получится»\n'),
  E'\n— Я вижу чужие успехи и чувствую зависть и бессилие\n',
  E'\n«Я вижу чужие успехи и чувствую зависть и бессилие»\n'),
  E'\n— Я знаю что нужно делать, но постоянно откладываю\n',
  E'\n«Я знаю что нужно делать, но постоянно откладываю»\n'),
  E'\n— Мне сложно сформулировать свой страх\n',
  E'\n«Мне сложно сформулировать свой страх»\n')
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_fear_deconstruct'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- 2.2. notes_scale_thinking
UPDATE program_modes pm
SET system_prompt = REPLACE(REPLACE(REPLACE(REPLACE(
  pm.system_prompt,
  E'\n— Хочу зарабатывать больше, но не верю что реально\n',
  E'\n«Хочу зарабатывать больше, но не верю что реально»\n'),
  E'\n— У меня есть цель, но она кажется нереальной\n',
  E'\n«У меня есть цель, но она кажется нереальной»\n'),
  E'\n— Я застрял на одном уровне дохода уже давно\n',
  E'\n«Я застрял на одном уровне дохода уже давно»\n'),
  E'\n— Мне сложно сформулировать — просто чувствую потолок\n',
  E'\n«Мне сложно сформулировать — просто чувствую потолок»\n')
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_scale_thinking'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- 2.3. notes_energy_architect
UPDATE program_modes pm
SET system_prompt = REPLACE(REPLACE(REPLACE(REPLACE(
  pm.system_prompt,
  E'\n— Я постоянно устаю и не понимаю почему\n',
  E'\n«Я постоянно устаю и не понимаю почему»\n'),
  E'\n— Я выгорел и не могу собраться\n',
  E'\n«Я выгорел и не могу собраться»\n'),
  E'\n— Хочу разобраться с незавершёнными делами\n',
  E'\n«Хочу разобраться с незавершёнными делами»\n'),
  E'\n— Мне сложно сформулировать — просто нет сил\n',
  E'\n«Мне сложно сформулировать — просто нет сил»\n')
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_energy_architect'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- 2.4. notes_pleasure_switch
UPDATE program_modes pm
SET system_prompt = REPLACE(REPLACE(REPLACE(REPLACE(
  pm.system_prompt,
  E'\n— Я достигаю целей, но радости от этого ноль\n',
  E'\n«Я достигаю целей, но радости от этого ноль»\n'),
  E'\n— Мне кажется, что без надрыва результат «не считается»\n',
  E'\n«Мне кажется, что без надрыва результат не считается»\n'),
  E'\n— Хочу найти кайф в том, что делаю каждый день\n',
  E'\n«Хочу найти кайф в том, что делаю каждый день»\n'),
  E'\n— Мне сложно — я не помню, когда последний раз радовался работе\n',
  E'\n«Мне сложно — я не помню, когда последний раз радовался работе»\n')
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_pleasure_switch'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- 2.5. notes_environment_audit
UPDATE program_modes pm
SET system_prompt = REPLACE(REPLACE(REPLACE(REPLACE(
  pm.system_prompt,
  E'\n— Чувствую, что моё окружение тянет меня вниз\n',
  E'\n«Чувствую, что моё окружение тянет меня вниз»\n'),
  E'\n— Есть один человек, с которым не могу разобраться\n',
  E'\n«Есть один человек, с которым не могу разобраться»\n'),
  E'\n— Хочу научиться говорить правду без конфликтов\n',
  E'\n«Хочу научиться говорить правду без конфликтов»\n'),
  E'\n— Мне сложно сформулировать — просто чувствую дискомфорт\n',
  E'\n«Мне сложно сформулировать — просто чувствую дискомфорт»\n')
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_environment_audit'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- 2.6. notes_business_lab
UPDATE program_modes pm
SET system_prompt = REPLACE(REPLACE(REPLACE(REPLACE(
  pm.system_prompt,
  E'\n— Хочу понять, почему доход не растёт\n',
  E'\n«Хочу понять, почему доход не растёт»\n'),
  E'\n— Хочу научиться быстро тестировать идеи\n',
  E'\n«Хочу научиться быстро тестировать идеи»\n'),
  E'\n— Мне сложно делегировать — кажется, сам сделаю лучше\n',
  E'\n«Мне сложно делегировать — кажется, сам сделаю лучше»\n'),
  E'\n— Хочу попробовать кейс\n',
  E'\n«Хочу попробовать кейс»\n')
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_business_lab'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- 2.7. notes_self_journal
UPDATE program_modes pm
SET system_prompt = REPLACE(REPLACE(REPLACE(REPLACE(
  pm.system_prompt,
  E'\n— Хочу разобраться, почему одна и та же ситуация повторяется\n',
  E'\n«Хочу разобраться, почему одна и та же ситуация повторяется»\n'),
  E'\n— Хочу написать о том, что чувствую прямо сейчас\n',
  E'\n«Хочу написать о том, что чувствую прямо сейчас»\n'),
  E'\n— Хочу найти свой смысл за пределами заработка\n',
  E'\n«Хочу найти свой смысл за пределами заработка»\n'),
  E'\n— Мне сложно начать — не знаю о чём писать\n',
  E'\n«Мне сложно начать — не знаю о чём писать»\n')
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'notes_self_journal'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes');

-- =============================================================
-- Верификация
-- =============================================================

-- Проверка 1: старый блок "### Suggested replies..." должен исчезнуть,
-- новый "### Quick replies — ФОРМАТ" должен появиться во всех 7.
-- Ожидается: has_old_block=false, has_new_block=true, has_forbidden=true для всех 7.
SELECT mt.key,
  pm.system_prompt LIKE E'%### Suggested replies\n- От первого лица. 1-5%' as has_old_block,
  pm.system_prompt LIKE '%### Quick replies — ФОРМАТ%' as has_new_block,
  pm.system_prompt LIKE '%### ЗАПРЕЩЕНО в формате ответа%' as has_forbidden
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
WHERE mt.key LIKE 'notes_%'
  AND mt.key != 'test_100_notes'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes')
ORDER BY pm.sort_order;

-- Проверка 2: в ## WELCOME не должно остаться "\n— " (dash-строки).
-- Ожидается: dash_lines_remaining=0 для всех 7.
SELECT mt.key,
  (SELECT COUNT(*) FROM regexp_matches(
    substring(pm.system_prompt FROM position('## WELCOME' IN pm.system_prompt) FOR 2000),
    E'\n— ', 'g'
  )) as dash_lines_remaining,
  (SELECT COUNT(*) FROM regexp_matches(
    substring(pm.system_prompt FROM position('## WELCOME' IN pm.system_prompt) FOR 2000),
    E'\n«[^»]+»\n', 'g'
  )) as elochki_lines
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
WHERE mt.key LIKE 'notes_%'
  AND mt.key != 'test_100_notes'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = '100-notes')
ORDER BY pm.sort_order;

COMMIT;
