-- =============================================================
-- Fix razgovorny-gipnoz welcome_replies: migrate 4 tool modes from
-- arrays of strings to arrays of {text, type} objects.
--
-- Root cause (see docs/runbooks/chat-message-formatting.md):
--   welcome_replies stored as JSONB string array triggers the legacy
--   normalizer which marks every button type="normal". As a result
--   the safe-exit reply (4-th button, always "Мне сложно сформулировать")
--   renders identical to the 3 actionable buttons (same golden colour).
--   The NewChatScreen applies class `.nc-reply-exit` only when the
--   object carries `type: "exit"`.
--
-- Texts are preserved verbatim from the current array-of-strings
-- version — the 4-th string already is the intended exit reply.
-- Format after fix: [{"text": "...", "type": "normal" | "exit"}]
--
-- NOTE: hypno_trance already stores objects with last type="exit" —
-- NOT touched in this migration.
-- =============================================================

BEGIN;

-- 1. hypno_rapport — Раппорт-лаборатория
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Давай начнём с простого собеседника", "type": "normal"},
  {"text": "Хочу потренироваться на сложном типе", "type": "normal"},
  {"text": "Покажи, как подстройка работает на примере", "type": "normal"},
  {"text": "Мне сложно сформулировать", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'hypno_rapport'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'razgovorny-gipnoz');

-- 2. hypno_negotiate — Переговорный симулятор
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "У меня скоро важные переговоры — помоги подготовиться", "type": "normal"},
  {"text": "Хочу разобрать переговоры, которые прошли не так", "type": "normal"},
  {"text": "Как убедить начальника в моей идее?", "type": "normal"},
  {"text": "Мне сложно сформулировать", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'hypno_negotiate'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'razgovorny-gipnoz');

-- 3. hypno_detect — Детектор манипуляций
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Давай начнём с простых примеров", "type": "normal"},
  {"text": "Хочу разобрать ситуацию, где мной манипулировали", "type": "normal"},
  {"text": "Покажи манипуляции в рекламе", "type": "normal"},
  {"text": "Мне сложно сформулировать", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'hypno_detect'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'razgovorny-gipnoz');

-- 4. hypno_suggest — Мастерская внушений
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Давай начнём с чего-то простого", "type": "normal"},
  {"text": "Хочу научиться встраивать внушения в рабочие письма", "type": "normal"},
  {"text": "Как сделать просьбу, от которой трудно отказать?", "type": "normal"},
  {"text": "Мне сложно сформулировать", "type": "exit"}
]'::jsonb
FROM mode_templates mt
WHERE pm.mode_template_id = mt.id
  AND mt.key = 'hypno_suggest'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'razgovorny-gipnoz');

-- Verification: все 4 должны вернуть reply_count=4, last_is_exit=true, replies_kind=object
SELECT mt.key,
  jsonb_typeof(pm.welcome_replies->0) as replies_kind,
  jsonb_array_length(pm.welcome_replies) as reply_count,
  pm.welcome_replies->-1->>'type' as last_type,
  (pm.welcome_replies->-1->>'type' = 'exit') as last_is_exit
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
WHERE mt.key IN ('hypno_rapport', 'hypno_negotiate', 'hypno_detect', 'hypno_suggest')
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'razgovorny-gipnoz')
  AND pm.enabled = true
ORDER BY pm.sort_order;

COMMIT;
