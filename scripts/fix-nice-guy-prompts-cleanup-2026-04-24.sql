-- =============================================================
-- Fix nice-guy: QR placeholders + counterexamples + exit-replies
--
-- Аудит npm run check:chats (2026-04-24):
--   ❌ programs.system_prompt / author_chat_system_prompt — literal placeholder
--   ❌ 9 tool-режимов (6x ng_* + exercises + free_chat + author_chat) — placeholder
--   ⚠️ free_chat.system_prompt — нет контрпримера НЕПРАВИЛЬНО
--   ⚠️ author_chat.system_prompt — нет контрпримера НЕПРАВИЛЬНО
--   ⚠️ free_chat / author_chat / exercises welcome_replies — нет exit
-- =============================================================

BEGIN;

-- ─── 1. programs.system_prompt ───
UPDATE programs
SET system_prompt = REPLACE(
  system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Чувствую что живу для других»\n«Не могу выразить злость»\n«Мне сложно сформулировать что меня тревожит»'
)
WHERE slug = 'nice-guy';


-- ─── 2. programs.author_chat_system_prompt ───
UPDATE programs
SET author_chat_system_prompt = REPLACE(
  author_chat_system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Почему я не могу злиться»\n«Как перестать быть славным парнем»\n«Мне сложно сформулировать мой вопрос»'
)
WHERE slug = 'nice-guy';


-- ─── 3. free_chat — заменить placeholder + добавить НЕПРАВИЛЬНО ───
-- В free_chat/author_chat прод-блок имеет структуру:
--   «Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»\n\nНИКОГДА не склеивай ёлочки через пробел в одной строке.
-- Полностью заменяем на усиленный блок с контрпримером.
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»\n\nНИКОГДА не склеивай ёлочки через пробел в одной строке.',
  E'НЕПРАВИЛЬНО: [вопрос]? «Первый» «Второй»\nНЕПРАВИЛЬНО (все на одной строке): «Вариант 1» «Вариант 2» «Вариант 3»\nПРАВИЛЬНО:\n\n[твой ответ и один вопрос пользователю]\n\n«Чувствую что живу для других»\n«Не могу выразить злость»\n«Мне сложно сформулировать что меня тревожит»\n\nНИКОГДА не склеивай ёлочки через пробел в одной строке.'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'nice-guy' AND mt.key = 'free_chat';


-- ─── 4. author_chat — аналогично, но про Гловера ───
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»\n\nНИКОГДА не склеивай ёлочки через пробел в одной строке.',
  E'НЕПРАВИЛЬНО: [вопрос]? «Первый» «Второй»\nНЕПРАВИЛЬНО (все на одной строке): «Вариант 1» «Вариант 2» «Вариант 3»\nПРАВИЛЬНО:\n\n[твой ответ и один вопрос пользователю]\n\n«Почему я не могу злиться»\n«Как перестать быть славным парнем»\n«Мне сложно сформулировать мой вопрос»\n\nНИКОГДА не склеивай ёлочки через пробел в одной строке.'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'nice-guy' AND mt.key = 'author_chat';


-- ─── 5-10. ng_* tool modes — простая замена 3-строчного плейсхолдера ───
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Она ждёт от меня больше инициативы»\n«Чувствую что меня используют»\n«Мне сложно сформулировать что не так»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'nice-guy' AND mt.key = 'ng_relationships';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Расскажи про синдром славного парня коротко»\n«Что такое жертвенный треугольник»\n«Мне сложно сформулировать вопрос по теории»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'nice-guy' AND mt.key = 'ng_theory';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Хочу потренироваться ставить границу с руководителем»\n«Сложно сказать нет близкому»\n«Мне сложно сформулировать с чего начать»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'nice-guy' AND mt.key = 'ng_boundaries';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Мама до сих пор вмешивается в мою жизнь»\n«Отец был холодным — это сейчас влияет»\n«Мне сложно сформулировать что чувствую к родителям»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'nice-guy' AND mt.key = 'ng_parents';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Боюсь говорить прямо что мне не нравится»\n«Привык всех выручать даже когда не хочу»\n«Мне сложно понять свой сценарий»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'nice-guy' AND mt.key = 'ng_my_syndrome';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Давай разберём кейс»\n«Хочу пройти ещё один»\n«Мне сложно понять паттерн»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'nice-guy' AND mt.key = 'ng_quiz';


-- ─── 11. exercises ───
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Готов к упражнению»\n«Разберём что мешает»\n«Мне сложно сформулировать что застряло»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'nice-guy' AND mt.key = 'exercises';


-- ─── 12. welcome_replies exit-replies ───
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Чувствую что живу для других", "type": "normal"},
  {"text": "Не могу выразить свои чувства", "type": "normal"},
  {"text": "Проблемы в отношениях", "type": "normal"},
  {"text": "Хочу разобраться в себе", "type": "exit"}
]'::jsonb
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'nice-guy' AND mt.key = 'free_chat';

UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Почему я не могу злиться?", "type": "normal"},
  {"text": "Как перестать быть славным парнем?", "type": "normal"},
  {"text": "Что делать с чувством вины?", "type": "exit"}
]'::jsonb
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'nice-guy' AND mt.key = 'author_chat';

UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "С первой главы", "type": "normal"},
  {"text": "Продолжить где остановился", "type": "normal"},
  {"text": "Выбрать конкретное упражнение", "type": "exit"}
]'::jsonb
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'nice-guy' AND mt.key = 'exercises';


-- =============================================================
-- Верификация
-- =============================================================
SELECT
  'programs.system_prompt' AS field,
  (system_prompt NOT LIKE '%«Вариант 1 от первого лица»%') AS placeholder_removed
FROM programs WHERE slug = 'nice-guy'
UNION ALL
SELECT 'programs.author_chat_system_prompt',
  (author_chat_system_prompt NOT LIKE '%«Вариант 1 от первого лица»%')
FROM programs WHERE slug = 'nice-guy'
UNION ALL
SELECT 'mode[' || mt.key || ']',
  (pm.system_prompt NOT LIKE '%«Вариант 1 от первого лица»%')
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
JOIN programs p ON p.id = pm.program_id
WHERE p.slug = 'nice-guy' AND pm.system_prompt IS NOT NULL
ORDER BY field;

COMMIT;
