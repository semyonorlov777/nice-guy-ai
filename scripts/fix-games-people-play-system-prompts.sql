-- =============================================================
-- Fix games-people-play mode system_prompts: append the quick-reply format block.
--
-- Root cause (see docs/runbooks/chat-message-formatting.md):
--   The 8 tool modes (ta_diagnostic, ta_game_quiz, ta_game_analysis,
--   ta_ego_states, ta_life_script, ta_script_matrix, ta_game_exit,
--   ta_permission) have no «ФОРМАТ QUICK REPLIES» block — so the
--   model produces plain-text lists, «Что дальше?» headings, dash
--   bullets instead of «ёлочки» that ChatWindow's parseQuickReplies
--   can turn into buttons.
--
-- Each mode's system_prompt is 2.8–5.1 KB; we APPEND the same block
-- we added at the program level (with «не вопросы к AI» — same as
-- nice-guy tool-modes, since these are tool AIs not an author).
-- =============================================================

UPDATE program_modes pm
SET system_prompt = pm.system_prompt || E'\n\n## ФОРМАТ QUICK REPLIES\n\n### Quick replies — ФОРМАТ (обязательный)\n\nЕсли хочешь предложить варианты ответа — пиши их в КОНЦЕ сообщения, каждый на отдельной строке, в «ёлочках»:\n\n«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»\n\nЭто ЕДИНСТВЕННЫЙ формат, который платформа рендерит как кнопки. Любой другой формат (список через "—" или "-", нумерация "1. ... 2. ...", блок «Что дальше?» с вопросами, перечисление через "•" как варианты ответа) будет показан пользователю plain-текстом без кнопок.\n\nПеред первой «ёлочкой» — пустая строка. Между «ёлочками» — одиночный перенос строки. НИКОГДА не склеивай «ёлочки» через пробел в одну строку.\n\nНЕПРАВИЛЬНО: [вопрос]? «Вариант 1» «Вариант 2»\nНЕПРАВИЛЬНО (все на одной строке): «Вариант 1» «Вариант 2» «Вариант 3»\nПРАВИЛЬНО:\n\n[твой ответ и один вопрос пользователю]\n\n«Вариант 1»\n«Вариант 2»\n«Мне сложно сформулировать»\n\nReplies — от первого лица, голос пользователя. Не вопросы к AI. Не задания. Не дублируй в replies то, что уже спросил в тексте. Последний reply в начале диалога — безопасный exit («Мне сложно сформулировать» или аналог).\n\n### Scaffolding fading (обязательный)\n\n- Turns 1–5: 3–4 reply в «ёлочках».\n- Turns 6–12: 2 reply.\n- Turns 13+: 0 reply или 1 fallback exit.\n\n### ЗАПРЕЩЕНО в формате ответа\n\n- Блок «Что дальше?» со списком вопросов — рендерится как markdown-текст, не как кнопки.\n- Список вариантов через "—" em-dash или "-" в начале строки.\n- Нумерованные списки «1. ... 2. ...» как варианты ответа.\n- «• Вариант» через буллет как reply — это визуально список, не кнопки.\n- Склеивание «ёлочек» в одну строку через пробел.\n- Несколько вопросов за ход — только один вопрос за сообщение.'
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id
  AND pm.program_id = p.id
  AND p.slug = 'games-people-play'
  AND mt.key IN ('ta_diagnostic', 'ta_game_quiz', 'ta_game_analysis',
                 'ta_ego_states', 'ta_life_script', 'ta_script_matrix',
                 'ta_game_exit', 'ta_permission');

-- Verification
SELECT mt.key,
  LENGTH(pm.system_prompt) AS prompt_len,
  (pm.system_prompt LIKE '%## ФОРМАТ QUICK REPLIES%') AS has_quickrules_heading,
  (pm.system_prompt LIKE '%«Вариант 1 от первого лица»%') AS has_literal_example
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
JOIN programs p ON p.id = pm.program_id
WHERE p.slug = 'games-people-play'
  AND mt.key IN ('ta_diagnostic', 'ta_game_quiz', 'ta_game_analysis',
                 'ta_ego_states', 'ta_life_script', 'ta_script_matrix',
                 'ta_game_exit', 'ta_permission')
ORDER BY mt.key;
