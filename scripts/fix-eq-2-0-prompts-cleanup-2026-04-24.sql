-- =============================================================
-- Fix eq-2-0: cleanup QR placeholders + expand author_chat QR block + add exit-replies
--
-- Финальная уборка после аудита npm run check:chats (2026-04-24):
--   ❌ programs.system_prompt           — literal «Вариант 1 от первого лица» в ПРАВИЛЬНОМ примере
--   ⚠️ programs.author_chat_system_prompt — нет `НИКОГДА не склеивай`, нет контрпримера
--   ⚠️ program_modes[author_chat].welcome_replies    — нет reply с type:"exit"
--   ⚠️ program_modes[eq_strategies].welcome_replies  — нет reply с type:"exit"
--
-- См. docs/prompts-cleanup-handoff.md и
-- .claude/skills/book-to-modes/references/REFERENCE.md §5
-- =============================================================

BEGIN;

-- ─── 1. programs.system_prompt — заменить 3 placeholder-reply на тематические ───
UPDATE programs
SET system_prompt = REPLACE(
  system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Хочу разобраться в эмоции прямо сейчас»\n«Есть конкретная ситуация — разберём»\n«Мне сложно сформулировать что чувствую»'
)
WHERE slug = 'eq-2-0';


-- ─── 2. programs.author_chat_system_prompt — раскрыть QR-блок ───
-- Меняем одностроку "Формат Quick Replies..." на полный блок с НЕПРАВИЛЬНО/ПРАВИЛЬНО
UPDATE programs
SET author_chat_system_prompt = REPLACE(
  author_chat_system_prompt,
  E'- Формат Quick Replies в «ёлочках»: в конце сообщения, каждая на отдельной строке, от первого лица пользователя. 3-4 варианта turns 1-5, 2 turns 6-12, 0-1 exit turns 13+',
  E'- Формат Quick Replies: в «ёлочках», каждая на отдельной строке, в конце сообщения, от первого лица пользователя. 3-4 reply turns 1-5, 2 turns 6-12, 0-1 exit turns 13+.\n- Перед первой «ёлочкой» — пустая строка. Между «ёлочками» — одиночный перенос строки. НИКОГДА не склеивай «ёлочки» через пробел в одну строку.\n- НЕПРАВИЛЬНО: [вопрос]? «Первый вариант» «Второй вариант»\n- НЕПРАВИЛЬНО (все на одной строке): «Вариант 1» «Вариант 2» «Вариант 3»\n- ПРАВИЛЬНО:\n\n[твой ответ и один вопрос пользователю]\n\n«Почему EQ важнее IQ — объясни коротко»\n«Как измерить прогресс за 3 месяца»\n«Не уверен с чего начать»\n\n- Это ЕДИНСТВЕННЫЙ формат, который платформа рендерит как кнопки. Списки через «—»/«-», нумерация «1. 2. 3.», буллеты «•», блок «Что дальше?» — plain-текст без кнопок.'
)
WHERE slug = 'eq-2-0';


-- ─── 3. welcome_replies[author_chat] — последний reply → type:"exit" ───
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Почему EQ важнее IQ?", "type": "normal"},
  {"text": "С чего начать если низкий по всем шкалам?", "type": "normal"},
  {"text": "Как измерить прогресс за 3 месяца?", "type": "normal"},
  {"text": "Что вы узнали про CEO и лидеров?", "type": "exit"}
]'::jsonb
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'eq-2-0' AND mt.key = 'author_chat';


-- ─── 4. welcome_replies[eq_strategies] — последний reply → type:"exit" ───
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Хочу лучше понимать свои эмоции", "type": "normal"},
  {"text": "Нужны техники удержаться от импульса", "type": "normal"},
  {"text": "Хочу научиться читать других", "type": "normal"},
  {"text": "Покажи результат теста и подбери под него", "type": "exit"}
]'::jsonb
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'eq-2-0' AND mt.key = 'eq_strategies';


-- =============================================================
-- Верификация
-- =============================================================
SELECT
  'programs.system_prompt'                                              AS field,
  (system_prompt LIKE '%«Хочу разобраться в эмоции прямо сейчас»%')     AS has_thematic,
  (system_prompt NOT LIKE '%«Вариант 1 от первого лица»%')              AS placeholder_removed
FROM programs WHERE slug = 'eq-2-0'
UNION ALL
SELECT
  'programs.author_chat_system_prompt',
  (author_chat_system_prompt LIKE '%НИКОГДА не склеивай%'),
  (author_chat_system_prompt LIKE '%НЕПРАВИЛЬНО (все на одной строке)%')
FROM programs WHERE slug = 'eq-2-0'
UNION ALL
SELECT
  'welcome_replies[author_chat]',
  (pm.welcome_replies::text LIKE '%"type": "exit"%'),
  TRUE
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
JOIN programs p ON p.id = pm.program_id
WHERE p.slug = 'eq-2-0' AND mt.key = 'author_chat'
UNION ALL
SELECT
  'welcome_replies[eq_strategies]',
  (pm.welcome_replies::text LIKE '%"type": "exit"%'),
  TRUE
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
JOIN programs p ON p.id = pm.program_id
WHERE p.slug = 'eq-2-0' AND mt.key = 'eq_strategies';

COMMIT;
