-- =============================================================
-- Fix love-languages: QR placeholders + anonymous QR block + counterexample + exit
--
-- Аудит npm run check:chats (2026-04-24):
--   ❌ programs.system_prompt / author_chat_system_prompt — literal placeholder
--   ❌ anonymous_system_prompt — нет блока QUICK REPLIES
--   ❌ 6 ll_* tool-режимов + author_chat — placeholder в ПРАВИЛЬНОМ примере
--   ⚠️ author_chat.system_prompt — нет контрпримера НЕПРАВИЛЬНО
--   ⚠️ free_chat / author_chat welcome_replies — нет exit
-- =============================================================

BEGIN;

-- ─── 1. programs.system_prompt ───
UPDATE programs
SET system_prompt = REPLACE(
  system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Расскажи про 5 языков любви»\n«У меня конфликт в отношениях — разберём»\n«Мне сложно сформулировать что не так»'
)
WHERE slug = 'love-languages';


-- ─── 2. programs.author_chat_system_prompt ───
UPDATE programs
SET author_chat_system_prompt = REPLACE(
  author_chat_system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Как вы пришли к теории 5 языков»\n«Какой ваш собственный язык любви»\n«Мне сложно сформулировать мой вопрос»'
)
WHERE slug = 'love-languages';


-- ─── 3. anonymous_system_prompt — добавить QR-блок в конце ───
UPDATE programs
SET anonymous_system_prompt = anonymous_system_prompt ||
  E'\n\nФормат Quick Replies: в «ёлочках», каждая на отдельной строке, в конце сообщения, от первого лица пользователя. 3-4 reply + exit. НИКОГДА не склеивай «ёлочки» через пробел в одну строку.\n\nПример:\n\n«Мне важны слова поддержки от партнёра»\n«Цени больше, когда мы проводим время вместе»\n«Партнёр почти не прикасается физически»\n«Мне сложно определить свой язык»\n\nЭто ЕДИНСТВЕННЫЙ формат, который рендерится как кнопки. Списки через «—»/«-», нумерация «1. 2. 3.», блок «Что дальше?» — plain-текст без кнопок.'
WHERE slug = 'love-languages';


-- ─── 4. author_chat mode — placeholder → thematic + НЕПРАВИЛЬНО ───
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»\n\nНИКОГДА не склеивай ёлочки через пробел в одной строке.',
  E'НЕПРАВИЛЬНО: [вопрос]? «Первый» «Второй»\nНЕПРАВИЛЬНО (все на одной строке): «Вариант 1» «Вариант 2» «Вариант 3»\nПРАВИЛЬНО:\n\n[твой ответ и один вопрос пользователю]\n\n«Как вы пришли к теории 5 языков»\n«Какой ваш собственный язык любви»\n«Мне сложно сформулировать мой вопрос»\n\nНИКОГДА не склеивай ёлочки через пробел в одной строке.'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'love-languages' AND mt.key = 'author_chat';


-- ─── 5-10. ll_* tool modes ───
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Расскажи про слова поощрения»\n«Что такое "акты служения"»\n«Мне сложно выбрать мой язык»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'love-languages' AND mt.key = 'll_theory';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Мне важны слова поддержки»\n«Ценю когда проводим время вместе»\n«Мне сложно определить свой язык»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'love-languages' AND mt.key = 'll_self_analysis';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Она расцветает от подарков»\n«Ему важна помощь делом»\n«Мне сложно понять язык партнёра»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'love-languages' AND mt.key = 'll_partner_analysis';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Не понимаю что она имеет в виду»\n«Мы говорим на разных языках»\n«Мне сложно сформулировать конфликт»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'love-languages' AND mt.key = 'll_love_translator';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Хочу видеть картину отношений целиком»\n«Где сейчас слабые места»\n«Мне сложно структурировать»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'love-languages' AND mt.key = 'll_relationship_map';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Готов потренировать разговор»\n«Проиграем сложный момент»\n«Мне сложно начать симуляцию»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'love-languages' AND mt.key = 'll_roleplay';


-- ─── 11. welcome_replies — exit ───
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Расскажи о книге", "type": "normal"},
  {"text": "У меня проблема в отношениях", "type": "normal"},
  {"text": "Что такое языки любви?", "type": "exit"}
]'::jsonb
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'love-languages' AND mt.key = 'free_chat';

UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Как вы придумали теорию?", "type": "normal"},
  {"text": "Какой ваш язык любви?", "type": "normal"},
  {"text": "Посоветуйте книгу для пар", "type": "exit"}
]'::jsonb
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'love-languages' AND mt.key = 'author_chat';


-- Верификация
SELECT
  'programs.system_prompt' AS field,
  (system_prompt NOT LIKE '%«Вариант 1 от первого лица»%') AS placeholder_removed
FROM programs WHERE slug = 'love-languages'
UNION ALL
SELECT 'programs.author_chat_system_prompt',
  (author_chat_system_prompt NOT LIKE '%«Вариант 1 от первого лица»%')
FROM programs WHERE slug = 'love-languages'
UNION ALL
SELECT 'programs.anonymous_system_prompt has QR',
  (anonymous_system_prompt LIKE '%Quick Replies%')
FROM programs WHERE slug = 'love-languages'
UNION ALL
SELECT 'mode[' || mt.key || ']',
  (pm.system_prompt NOT LIKE '%«Вариант 1 от первого лица»%')
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
JOIN programs p ON p.id = pm.program_id
WHERE p.slug = 'love-languages' AND pm.system_prompt IS NOT NULL
ORDER BY field;

COMMIT;
