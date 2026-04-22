-- =============================================================
-- Fix games-people-play welcome_replies: migrate 8 tool modes from
-- arrays of strings to arrays of {text, type} objects.
--
-- Root cause (see docs/runbooks/chat-message-formatting.md):
--   welcome_replies stored as JSONB string array triggers the legacy
--   normalizer which marks every button type="normal". As a result
--   the safe-exit reply (4-th button, always "Мне сложно…") renders
--   identical to the 3 actionable buttons (same golden colour). The
--   NewChatScreen applies class `.nc-reply-exit` only when the object
--   carries `type: "exit"`.
--
-- Texts are preserved verbatim from the current array-of-strings
-- version — the 4-th string already is the intended exit reply.
-- Format after fix: [{"text": "...", "type": "normal" | "exit"}]
-- =============================================================

BEGIN;

-- 1. ta_diagnostic — Диагностика ТА
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "В отношениях я часто наступаю на одни и те же грабли", "type": "normal"},
  {"text": "Я замечаю, что повторяю паттерны родителей", "type": "normal"},
  {"text": "Хочу понять, почему конфликты развиваются по одному сценарию", "type": "normal"},
  {"text": "Мне сложно сформулировать — задай вопросы", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'ta_diagnostic'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'games-people-play');

-- 2. ta_game_quiz — Какие игры ты видишь?
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Давай начнём с простого примера", "type": "normal"},
  {"text": "Я уже знаю несколько игр — хочу проверить себя", "type": "normal"},
  {"text": "Покажи игры, которые бывают в отношениях", "type": "normal"},
  {"text": "Мне сложно сформулировать", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'ta_game_quiz'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'games-people-play');

-- 3. ta_game_analysis — Разбор твоей игры
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Мы с партнёром ссоримся по одному и тому же поводу", "type": "normal"},
  {"text": "На работе я постоянно оказываюсь виноватым", "type": "normal"},
  {"text": "Я всегда помогаю другим, а потом злюсь", "type": "normal"},
  {"text": "Мне сложно сформулировать — задай вопросы", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'ta_game_analysis'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'games-people-play');

-- 4. ta_ego_states — Кто сейчас говорит?
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Я часто говорю фразами своих родителей", "type": "normal"},
  {"text": "Иногда чувствую себя ребёнком в конфликтах с начальником", "type": "normal"},
  {"text": "Хочу понять, какое состояние у меня включается чаще", "type": "normal"},
  {"text": "Мне сложно сформулировать", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'ta_ego_states'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'games-people-play');

-- 5. ta_life_script — Твой жизненный сценарий
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "У меня ощущение, что моя жизнь идёт по кругу", "type": "normal"},
  {"text": "Я чувствую, что повторяю судьбу одного из родителей", "type": "normal"},
  {"text": "Мне всегда чего-то не хватает для счастья, хотя вроде всё есть", "type": "normal"},
  {"text": "Мне сложно сформулировать — задай вопросы", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'ta_life_script'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'games-people-play');

-- 6. ta_script_matrix — Сценарная матрица
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Мама и папа говорили противоположные вещи", "type": "normal"},
  {"text": "Я не помню, что они говорили — но помню атмосферу", "type": "normal"},
  {"text": "Хочу понять, что именно мне передали", "type": "normal"},
  {"text": "Мне сложно сформулировать", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'ta_script_matrix'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'games-people-play');

-- 7. ta_game_exit — Выход из игры
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Давай потренируемся на ситуации с партнёром", "type": "normal"},
  {"text": "Хочу отрепетировать разговор с начальником", "type": "normal"},
  {"text": "Я знаю свою игру — хочу научиться не вестись", "type": "normal"},
  {"text": "Мне сложно сформулировать", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'ta_game_exit'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'games-people-play');

-- 8. ta_permission — Разрешение
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Я чувствую, что мне нельзя быть счастливым", "type": "normal"},
  {"text": "Мне всю жизнь запрещали хотеть для себя", "type": "normal"},
  {"text": "Я знаю свой сценарий — хочу из него выйти", "type": "normal"},
  {"text": "Мне сложно сформулировать", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'ta_permission'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'games-people-play');

-- Verification: все 8 должны вернуть reply_count=4, last_is_exit=true, replies_kind=object
SELECT mt.key,
  jsonb_typeof(pm.welcome_replies->0) as replies_kind,
  jsonb_array_length(pm.welcome_replies) as reply_count,
  pm.welcome_replies->-1->>'type' as last_type,
  (pm.welcome_replies->-1->>'type' = 'exit') as last_is_exit
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
WHERE mt.key LIKE 'ta_%'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'games-people-play')
  AND pm.enabled = true
ORDER BY pm.sort_order;

COMMIT;
