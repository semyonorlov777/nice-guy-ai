-- =============================================================
-- Fix games-people-play: QR placeholders + anonymous QR block + counter + exit
--
-- Аудит npm run check:chats (2026-04-24):
--   ❌ programs.system_prompt / author_chat_system_prompt — literal placeholder
--   ❌ anonymous_system_prompt — нет QUICK REPLIES
--   ❌ 7 ta_* tool-режимов + free_chat — placeholder
--   ⚠️ free_chat.system_prompt — нет контрпримера НЕПРАВИЛЬНО
--   ⚠️ free_chat / author_chat welcome_replies — нет exit
-- =============================================================

BEGIN;

-- ─── 1. programs.system_prompt ───
UPDATE programs
SET system_prompt = REPLACE(
  system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Почему я повторяю одни и те же ошибки»\n«Что такое психологические игры»\n«Мне сложно сформулировать что меня тревожит»'
)
WHERE slug = 'games-people-play';


-- ─── 2. programs.author_chat_system_prompt ───
UPDATE programs
SET author_chat_system_prompt = REPLACE(
  author_chat_system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Почему люди играют в психологические игры»\n«Что такое жизненный сценарий»\n«Мне сложно сформулировать мой вопрос»'
)
WHERE slug = 'games-people-play';


-- ─── 3. anonymous_system_prompt — добавить QR-блок ───
UPDATE programs
SET anonymous_system_prompt = anonymous_system_prompt ||
  E'\n\nФормат Quick Replies: в «ёлочках», каждая на отдельной строке, в конце сообщения, от первого лица пользователя. 3-4 reply + exit. НИКОГДА не склеивай «ёлочки» через пробел в одну строку.\n\nПример:\n\n«Чувствую что меня постоянно втягивают в конфликт»\n«Повторяю одни и те же ситуации с разными людьми»\n«Узнаю в описании "Да, но" — это про меня»\n«Мне сложно сформулировать запрос»\n\nЭто ЕДИНСТВЕННЫЙ формат, который рендерится как кнопки. Списки через «—»/«-», нумерация «1. 2. 3.», блок «Что дальше?» — plain-текст без кнопок.'
WHERE slug = 'games-people-play';


-- ─── 4. free_chat — placeholder → thematic + НЕПРАВИЛЬНО ───
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»\n\nНИКОГДА не склеивай ёлочки через пробел в одной строке.',
  E'НЕПРАВИЛЬНО: [вопрос]? «Первый» «Второй»\nНЕПРАВИЛЬНО (все на одной строке): «Вариант 1» «Вариант 2» «Вариант 3»\nПРАВИЛЬНО:\n\n[твой ответ и один вопрос пользователю]\n\n«Почему я повторяю одни и те же ошибки»\n«Что такое психологические игры»\n«Мне сложно сформулировать что меня тревожит»\n\nНИКОГДА не склеивай ёлочки через пробел в одной строке.'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'games-people-play' AND mt.key = 'free_chat';


-- ─── 5-11. ta_* tool modes ───
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Давай разберём мою игру "Почему бы вам не"»\n«Играю в "Да, но" с коллегой»\n«Мне сложно определить в какую игру играю»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'games-people-play' AND mt.key = 'ta_game_analysis';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Сейчас во мне говорит Критикующий Родитель»\n«Из меня выпрыгивает Свободный Ребёнок»\n«Мне сложно определить кто сейчас говорит»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'games-people-play' AND mt.key = 'ta_ego_states';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Разреши себе злиться на отца»\n«Можно не оправдывать ожидания матери»\n«Мне сложно сформулировать какое разрешение мне нужно»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'games-people-play' AND mt.key = 'ta_permission';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Хочу понять свои повторяющиеся паттерны»\n«Есть конкретная ситуация — проанализируем»\n«Мне сложно сформулировать запрос»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'games-people-play' AND mt.key = 'ta_diagnostic';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Давай разберём кейс»\n«Хочу пройти ещё один»\n«Мне сложно распознать игру»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'games-people-play' AND mt.key = 'ta_game_quiz';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Чувствую что живу по сценарию родителей»\n«Повторяю судьбу отца»\n«Мне сложно сформулировать свой сценарий»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'games-people-play' AND mt.key = 'ta_life_script';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Хочу составить свою сценарную матрицу»\n«Есть уже кусок — дополним вместе»\n«Мне сложно начать»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'games-people-play' AND mt.key = 'ta_script_matrix';

UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Поймал себя в игре — как выйти»\n«Партнёр втягивает меня снова»\n«Мне сложно найти способ выйти»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'games-people-play' AND mt.key = 'ta_game_exit';


-- ─── 12. welcome_replies — exit ───
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Почему я повторяю одни и те же ошибки в отношениях?", "type": "normal"},
  {"text": "Что такое эго-состояния?", "type": "normal"},
  {"text": "Как перестать играть в психологические игры?", "type": "normal"},
  {"text": "Хочу разобраться в себе", "type": "exit"}
]'::jsonb
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'games-people-play' AND mt.key = 'free_chat';

UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Почему люди играют в психологические игры?", "type": "normal"},
  {"text": "Как распознать игру в моих отношениях?", "type": "normal"},
  {"text": "Что такое жизненный сценарий?", "type": "normal"},
  {"text": "Как достичь настоящей близости?", "type": "exit"}
]'::jsonb
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = 'games-people-play' AND mt.key = 'author_chat';


COMMIT;
