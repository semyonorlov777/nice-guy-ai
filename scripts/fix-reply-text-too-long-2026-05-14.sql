-- Migration: fix-reply-text-too-long-2026-05-14
-- Linter rule: reply-text-too-long (warn, threshold 60 chars)
-- Problem: 4 quick-reply buttons exceed 60 char limit and won't fit a mobile button.
-- Action: shorten each preserving meaning + emotional tone.

BEGIN;

-- 1. games-people-play.ta_life_script.welcome_replies[2]: 62 → 38 chars
UPDATE program_modes
SET welcome_replies = jsonb_set(
    welcome_replies,
    '{2,text}',
    to_jsonb('Всё вроде есть, но счастья не хватает'::text)
)
WHERE program_id = (SELECT id FROM programs WHERE slug = 'games-people-play')
  AND mode_template_id = (SELECT id FROM mode_templates WHERE key = 'ta_life_script');

-- 2. 100-notes.notes_pleasure_switch.welcome_replies[3]: 61 → 47 chars
UPDATE program_modes
SET welcome_replies = jsonb_set(
    welcome_replies,
    '{3,text}',
    to_jsonb('Не помню, когда последний раз радовался работе'::text)
)
WHERE program_id = (SELECT id FROM programs WHERE slug = '100-notes')
  AND mode_template_id = (SELECT id FROM mode_templates WHERE key = 'notes_pleasure_switch');

-- 3. 100-notes.program_themes[environment_hygiene].welcome_replies[1]: 68 → 52 chars
UPDATE program_themes
SET welcome_replies = jsonb_set(
    welcome_replies,
    '{1,text}',
    to_jsonb('В партнёрстве плохо, но я держусь — вдруг наладится'::text)
)
WHERE program_id = (SELECT id FROM programs WHERE slug = '100-notes')
  AND key = 'environment_hygiene';

-- 4. 100-notes.program_themes[self_reflection].welcome_replies[1]: 65 → 47 chars
UPDATE program_themes
SET welcome_replies = jsonb_set(
    welcome_replies,
    '{1,text}',
    to_jsonb('После эмоций ухожу в оправдания или самоедство'::text)
)
WHERE program_id = (SELECT id FROM programs WHERE slug = '100-notes')
  AND key = 'self_reflection';

COMMIT;
