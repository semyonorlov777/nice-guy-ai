-- =============================================================
-- Fix love-languages welcome_replies: add safe-exit as 4-th reply.
--
-- Root cause (see docs/runbooks/chat-message-formatting.md):
--   The 6 ll_* tool modes already store welcome_replies as
--   JSONB objects [{text, type}] (good — normalizer is not kicking
--   in), but all 3 existing replies have type=normal. Without a
--   `type: "exit"` reply the safe-exit button is visually identical
--   to the actionable ones (same golden colour) — the `.nc-reply-exit`
--   style is only applied when an object carries type=exit.
--
-- Fix: append a 4-th object {"text": "Мне сложно сформулировать",
--   "type": "exit"} to each mode's welcome_replies via JSONB concat.
--   Existing 3 objects preserved verbatim.
-- =============================================================

BEGIN;

UPDATE program_modes pm
SET welcome_replies = pm.welcome_replies || '[{"text": "Мне сложно сформулировать", "type": "exit"}]'::jsonb
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id
  AND pm.program_id = p.id
  AND p.slug = 'love-languages'
  AND mt.key IN ('ll_self_analysis', 'll_partner_analysis', 'll_relationship_map',
                 'll_theory', 'll_love_translator', 'll_roleplay');

-- Verification: все 6 должны вернуть reply_count=4, last_is_exit=true, replies_kind=object
SELECT mt.key,
  jsonb_typeof(pm.welcome_replies->0) as replies_kind,
  jsonb_array_length(pm.welcome_replies) as reply_count,
  pm.welcome_replies->-1->>'type' as last_type,
  pm.welcome_replies->-1->>'text' as last_text,
  (pm.welcome_replies->-1->>'type' = 'exit') as last_is_exit
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
WHERE mt.key LIKE 'll_%'
  AND pm.program_id = (SELECT id FROM programs WHERE slug = 'love-languages')
  AND pm.enabled = true
ORDER BY pm.sort_order;

COMMIT;
