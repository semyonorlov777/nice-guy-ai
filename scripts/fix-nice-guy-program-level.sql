-- =============================================================
-- Fix nice-guy program-level: system_prompt, author_chat_system_prompt,
-- free_chat_welcome, author_chat_welcome.
--
-- Root causes (see docs/runbooks/chat-message-formatting.md):
--   Bug 1 — AI in free chat stops producing «ёлочки» after the first
--           message because programs.system_prompt for nice-guy has
--           no quick-reply format block. free_chat_welcome also has
--           no starter «ёлочки», so the very first message has no
--           buttons either (the hub card is not a chat reply).
--   Bug 2 — Themes (/approval, /contracts, /suppression, /control,
--           /boundaries, /masculinity, /attachment) reuse
--           programs.system_prompt + welcome_system_context — same
--           root cause as Bug 1, affects all 7 themes.
--
-- What this does (single file, applied in order):
--   1. APPEND quick-reply format block to programs.system_prompt.
--   2. APPEND same block to programs.author_chat_system_prompt.
--   3. APPEND 4 starter «ёлочки» to programs.free_chat_welcome
--      (in sync with free_chat welcome_replies).
--   4. APPEND 3 starter «ёлочки» to programs.author_chat_welcome
--      (in sync with author_chat welcome_replies).
-- =============================================================

-- 1 + 2. Append the quick-reply format block to both program-level prompts.
UPDATE programs
SET
  system_prompt = system_prompt || E'\n\n## ФОРМАТ QUICK REPLIES\n\n### Quick replies — ФОРМАТ (обязательный)\n\nЕсли хочешь предложить варианты ответа — пиши их в КОНЦЕ сообщения, каждый на отдельной строке, в «ёлочках»:\n\n«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»\n\nЭто ЕДИНСТВЕННЫЙ формат, который платформа рендерит как кнопки. Любой другой формат (список через "—" или "-", нумерация "1. ... 2. ...", блок «Что дальше?» с вопросами, перечисление через "•" как варианты ответа) будет показан пользователю plain-текстом без кнопок.\n\nПеред первой «ёлочкой» — пустая строка. Между «ёлочками» — одиночный перенос строки. НИКОГДА не склеивай «ёлочки» через пробел в одну строку.\n\nНЕПРАВИЛЬНО: [вопрос]? «Вариант 1» «Вариант 2»\nНЕПРАВИЛЬНО (все на одной строке): «Вариант 1» «Вариант 2» «Вариант 3»\nПРАВИЛЬНО:\n\n[твой ответ и один вопрос пользователю]\n\n«Вариант 1»\n«Вариант 2»\n«Мне сложно сформулировать»\n\nReplies — от первого лица, голос пользователя. Не вопросы к AI. Не задания. Последний reply в начале диалога — безопасный exit («Мне сложно сформулировать» или аналог).\n\n### Scaffolding fading (обязательный)\n\n- Turns 1–5: 3–4 reply в «ёлочках».\n- Turns 6–12: 2 reply.\n- Turns 13+: 0 reply или 1 fallback exit.\n\n### ЗАПРЕЩЕНО в формате ответа\n\n- Блок «Что дальше?» со списком вопросов — рендерится как markdown-текст, не как кнопки.\n- Список вариантов через "—" em-dash или "-" в начале строки.\n- Нумерованные списки «1. ... 2. ...» как варианты ответа.\n- «• Вариант» через буллет как reply — это визуально список, не кнопки.\n- Склеивание «ёлочек» в одну строку через пробел.\n- Несколько вопросов за ход — только один вопрос за сообщение.',

  author_chat_system_prompt = author_chat_system_prompt || E'\n\n## ФОРМАТ QUICK REPLIES\n\n### Quick replies — ФОРМАТ (обязательный)\n\nЕсли хочешь предложить варианты ответа — пиши их в КОНЦЕ сообщения, каждый на отдельной строке, в «ёлочках»:\n\n«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»\n\nЭто ЕДИНСТВЕННЫЙ формат, который платформа рендерит как кнопки. Любой другой формат (список через "—" или "-", нумерация "1. ... 2. ...", блок «Что дальше?» с вопросами, перечисление через "•" как варианты ответа) будет показан пользователю plain-текстом без кнопок.\n\nПеред первой «ёлочкой» — пустая строка. Между «ёлочками» — одиночный перенос строки. НИКОГДА не склеивай «ёлочки» через пробел в одну строку.\n\nНЕПРАВИЛЬНО: [вопрос]? «Вариант 1» «Вариант 2»\nНЕПРАВИЛЬНО (все на одной строке): «Вариант 1» «Вариант 2» «Вариант 3»\nПРАВИЛЬНО:\n\n[твой ответ и один вопрос пользователю]\n\n«Вариант 1»\n«Вариант 2»\n«Мне сложно сформулировать»\n\nReplies — от первого лица пользователя. Не вопросы к тебе (к Гловеру). Не задания. Последний reply в начале диалога — безопасный exit («Мне сложно сформулировать» или аналог).\n\n### Scaffolding fading (обязательный)\n\n- Turns 1–5: 3–4 reply в «ёлочках».\n- Turns 6–12: 2 reply.\n- Turns 13+: 0 reply или 1 fallback exit.\n\n### ЗАПРЕЩЕНО в формате ответа\n\n- Блок «Что дальше?» со списком вопросов — рендерится как markdown-текст, не как кнопки.\n- Список вариантов через "—" em-dash или "-" в начале строки.\n- Нумерованные списки «1. ... 2. ...» как варианты ответа.\n- «• Вариант» через буллет как reply — это визуально список, не кнопки.\n- Склеивание «ёлочек» в одну строку через пробел.\n- Несколько вопросов за ход — только один вопрос за сообщение.'
WHERE slug = 'nice-guy';

-- 3. Append 4 starter «ёлочки» to free_chat_welcome (synced with free_chat welcome_replies).
UPDATE programs
SET free_chat_welcome = free_chat_welcome || E'\n\n«Чувствую что живу для других»\n«Не могу выразить свои чувства»\n«Проблемы в отношениях»\n«Хочу разобраться в себе»'
WHERE slug = 'nice-guy';

-- 4. Append 3 starter «ёлочки» to author_chat_welcome (synced with author_chat welcome_replies).
UPDATE programs
SET author_chat_welcome = author_chat_welcome || E'\n\n«Почему я не могу злиться?»\n«Как перестать быть славным парнем?»\n«Что делать с чувством вины?»'
WHERE slug = 'nice-guy';

-- Verification.
SELECT
  slug,
  system_prompt LIKE '%## ФОРМАТ QUICK REPLIES%' as base_has_quickrules,
  author_chat_system_prompt LIKE '%## ФОРМАТ QUICK REPLIES%' as author_has_quickrules,
  free_chat_welcome LIKE E'%«%»' as free_welcome_ends_with_elochki,
  author_chat_welcome LIKE E'%«%»' as author_welcome_ends_with_elochki,
  (LENGTH(free_chat_welcome) - LENGTH(REPLACE(free_chat_welcome, '«', ''))) as free_welcome_elochki_count,
  (LENGTH(author_chat_welcome) - LENGTH(REPLACE(author_chat_welcome, '«', ''))) as author_welcome_elochki_count,
  LENGTH(system_prompt) as base_len,
  LENGTH(author_chat_system_prompt) as author_len
FROM programs
WHERE slug = 'nice-guy';
