-- Fix 3a: strip duplicated title prefix from welcome_message for nice-guy tool modes.
--
-- Context: each tool mode welcome_message starts with `эмодзи **Title**\n\n` (e.g.
-- `🔍 **Мой синдром**\n\n...`). ChatHeader already renders the mode name, so this
-- prefix appears as a duplicate inside the bubble. We strip the first line + the
-- following blank line, keeping the rest of the markdown content intact (bold
-- headings like `**Что ты получишь:**` and `- bullet` lists render fine via
-- ReactMarkdown in ChatWindow).
--
-- Scope: 7 tool modes in the `nice-guy` program
--   (ng_my_syndrome, ng_relationships, ng_parents, ng_boundaries,
--    ng_quiz, ng_theory, exercises).

BEGIN;

UPDATE program_modes pm
SET welcome_message = regexp_replace(pm.welcome_message, '^[^\n]+\n\n', '')
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id
  AND pm.program_id = p.id
  AND p.slug = 'nice-guy'
  AND mt.key IN ('ng_my_syndrome', 'ng_relationships', 'ng_parents',
                 'ng_boundaries', 'ng_quiz', 'ng_theory', 'exercises');

-- Verify: none of the updated welcome_message should start with `эмодзи **` anymore.
SELECT mt.key,
  LEFT(pm.welcome_message, 80) AS head,
  pm.welcome_message LIKE '%**%' AS still_has_bold,
  pm.welcome_message ~ '^[^\n]+ \*\*[^*]+\*\*' AS still_has_title_prefix
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
JOIN programs p ON p.id = pm.program_id
WHERE p.slug = 'nice-guy'
  AND mt.key IN ('ng_my_syndrome', 'ng_relationships', 'ng_parents',
                 'ng_boundaries', 'ng_quiz', 'ng_theory', 'exercises')
ORDER BY mt.key;

COMMIT;
