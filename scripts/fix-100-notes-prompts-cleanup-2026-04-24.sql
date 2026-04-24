-- =============================================================
-- Fix 100-notes: cleanup QR placeholders in 2 programs + 7 notes_* modes
--                + add exit-reply to free_chat/author_chat welcome_replies
--
-- Финальная уборка после аудита npm run check:chats (2026-04-24):
--   ❌ programs.system_prompt                              — literal «Вариант 1 от первого лица»
--   ❌ programs.author_chat_system_prompt                   — literal «Вариант 1 от первого лица»
--   ❌ program_modes[notes_fear_deconstruct].system_prompt  — literal placeholder
--   ❌ program_modes[notes_scale_thinking].system_prompt    — literal placeholder
--   ❌ program_modes[notes_energy_architect].system_prompt  — literal placeholder
--   ❌ program_modes[notes_pleasure_switch].system_prompt   — literal placeholder
--   ❌ program_modes[notes_environment_audit].system_prompt — literal placeholder
--   ❌ program_modes[notes_business_lab].system_prompt      — literal placeholder
--   ❌ program_modes[notes_self_journal].system_prompt      — literal placeholder
--   ⚠️ program_modes[free_chat].welcome_replies             — нет reply с type:"exit"
--   ⚠️ program_modes[author_chat].welcome_replies           — нет reply с type:"exit"
-- =============================================================

BEGIN;

-- ─── 1. programs.system_prompt (free_chat + темы) ───
UPDATE programs
SET system_prompt = REPLACE(
  system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Как перестать развиваться через боль»\n«Что делать когда нет сил ни на что»\n«Мне сложно сформулировать что меня беспокоит»'
)
WHERE slug = '100-notes';


-- ─── 2. programs.author_chat_system_prompt ───
UPDATE programs
SET author_chat_system_prompt = REPLACE(
  author_chat_system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Пётр, как ты справлялся со страхом провала»\n«Как ты понял что пора закрыть Бизнес Молодость»\n«Мне сложно сформулировать мой вопрос»'
)
WHERE slug = '100-notes';


-- ─── 3. notes_fear_deconstruct (деконструкция страха) ───
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Я боюсь запустить проект — вдруг не получится»\n«Я знаю что нужно делать, но откладываю»\n«Мне сложно сформулировать свой страх»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = '100-notes' AND mt.key = 'notes_fear_deconstruct';


-- ─── 4. notes_scale_thinking (финансовый потолок) ───
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Хочу зарабатывать больше, но не верю что реально»\n«Есть цель, но она кажется нереальной»\n«Мне сложно представить такой масштаб»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = '100-notes' AND mt.key = 'notes_scale_thinking';


-- ─── 5. notes_energy_architect (архитектор энергии) ───
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Постоянно устаю и не понимаю почему»\n«Хочу разобраться с незавершёнными делами»\n«Мне сложно понять где утечки энергии»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = '100-notes' AND mt.key = 'notes_energy_architect';


-- ─── 6. notes_pleasure_switch (развитие через удовольствие) ───
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Достигаю целей, но радости от этого ноль»\n«Без надрыва результат "не считается"»\n«Мне сложно вспомнить когда радовался работе»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = '100-notes' AND mt.key = 'notes_pleasure_switch';


-- ─── 7. notes_environment_audit (аудит окружения) ───
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Моё окружение тянет меня вниз»\n«Есть человек, с которым не могу разобраться»\n«Мне сложно сформулировать — просто дискомфорт»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = '100-notes' AND mt.key = 'notes_environment_audit';


-- ─── 8. notes_business_lab (бизнес-лаборатория) ───
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Хочу понять почему доход не растёт»\n«Мне сложно делегировать — кажется сам сделаю лучше»\n«Не знаю с чего начать тест»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = '100-notes' AND mt.key = 'notes_business_lab';


-- ─── 9. notes_self_journal (дневник самонаблюдения) ───
UPDATE program_modes pm
SET system_prompt = REPLACE(
  pm.system_prompt,
  E'«Вариант 1 от первого лица»\n«Вариант 2»\n«Мне сложно сформулировать»',
  E'«Сегодня снова поругался с близким»\n«Чувствую странную тревогу»\n«Мне сложно начать — не знаю о чём писать»'
)
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = '100-notes' AND mt.key = 'notes_self_journal';


-- ─── 10. welcome_replies[free_chat] — последний → exit ───
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Как перестать развиваться через боль?", "type": "normal"},
  {"text": "Что делать, когда нет сил ни на что?", "type": "normal"},
  {"text": "Как понять, моя это цель или навязанная?", "type": "normal"},
  {"text": "Просто хочу поговорить о том, что на душе", "type": "exit"}
]'::jsonb
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = '100-notes' AND mt.key = 'free_chat';


-- ─── 11. welcome_replies[author_chat] — последний → exit ───
UPDATE program_modes pm
SET welcome_replies = '[
  {"text": "Пётр, как ты справляешься со страхом провала?", "type": "normal"},
  {"text": "Что для тебя значит развитие через удовольствие?", "type": "normal"},
  {"text": "Как ты понял, что пора закрыть Бизнес Молодость?", "type": "normal"},
  {"text": "Расскажи о своём самом большом провале", "type": "exit"}
]'::jsonb
FROM mode_templates mt, programs p
WHERE pm.mode_template_id = mt.id AND pm.program_id = p.id
  AND p.slug = '100-notes' AND mt.key = 'author_chat';


-- =============================================================
-- Верификация — все поля должны потерять «Вариант 1 от первого лица»
-- =============================================================
SELECT
  'programs.system_prompt' AS field,
  (system_prompt NOT LIKE '%«Вариант 1 от первого лица»%') AS placeholder_removed
FROM programs WHERE slug = '100-notes'
UNION ALL
SELECT
  'programs.author_chat_system_prompt',
  (author_chat_system_prompt NOT LIKE '%«Вариант 1 от первого лица»%')
FROM programs WHERE slug = '100-notes'
UNION ALL
SELECT
  'mode[' || mt.key || '].system_prompt',
  (pm.system_prompt NOT LIKE '%«Вариант 1 от первого лица»%')
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
JOIN programs p ON p.id = pm.program_id
WHERE p.slug = '100-notes' AND mt.key LIKE 'notes_%'
ORDER BY field;

COMMIT;
