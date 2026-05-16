-- =============================================================================
-- Seed: 6 кастомных режимов + free/author_chat для programs.slug = 'redecision-therapy'
-- Применено через Supabase MCP в коммите feat(redecision): add Goulding's program — modes
-- Этот файл — для воспроизводимости. Полные system_prompt см. в БД (program_modes.system_prompt)
-- =============================================================================

-- 1. INSERT mode_templates (6 новых rd_*)
INSERT INTO mode_templates (key, name, description, icon, chat_type, route_suffix, is_chat_based, default_sort_order) VALUES
  ('rd_script_map',    'Карта моего сценария',     'Найди 2-3 главных предписания, которые ведут твою жизнь',     'map',            'rd_script_map',    '/chat', true, 20),
  ('rd_impasse',       'Где я застрял?',           'Определи тип тупика и какая часть тебя в конфликте',           'target',         'rd_impasse',       '/chat', true, 21),
  ('rd_inner_voices',  'Внутренние голоса',         'Разбери, кто внутри говорит — Родитель, Ребёнок, Профессор', 'message-circle', 'rd_inner_voices',  '/chat', true, 22),
  ('rd_early_scene',   'Возврат в раннюю сцену',   'Перепиши раннее решение через переживание',                    'book-open',      'rd_early_scene',   '/chat', true, 23),
  ('rd_two_chair',     'Двухстульный диалог',       'Дай слово той части, которую обычно подавляешь',               'drama',          'rd_two_chair',     '/chat', true, 24),
  ('rd_contract',      'Контракт с собой',          'Сформулируй конкретный измеримый контракт на изменение',       'unlock',         'rd_contract',      '/chat', true, 25)
ON CONFLICT (key) DO NOTHING;

-- 2. INSERT program_modes — 6 кастомных с полным system_prompt + welcome
-- Полные тексты SQL применены через Supabase MCP при первичном seed.
-- Воспроизведение: восстановить из БД через
--   SELECT * FROM program_modes pm
--   JOIN mode_templates mt ON mt.id = pm.mode_template_id
--   JOIN programs p ON p.id = pm.program_id
--   WHERE p.slug = 'redecision-therapy' ORDER BY pm.sort_order;
--
-- Структура каждого program_modes INSERT:
--   sort_order 1: rd_script_map     (АНАЛИЗ,   access=free)
--   sort_order 2: rd_impasse        (АНАЛИЗ,   access=paid)
--   sort_order 3: rd_inner_voices   (АНАЛИЗ,   access=paid)
--   sort_order 4: rd_early_scene    (ВОРКШОП,  access=paid) — главная техника redecision
--   sort_order 5: rd_two_chair      (РОЛЕВАЯ,  access=paid) — gestalt-двухстульная
--   sort_order 6: rd_contract       (ВОРКШОП,  access=paid) — финальный артефакт

-- 3. free_chat и author_chat (shared mode_templates) для программы
-- sort_order 7: free_chat (СВОБОДНЫЙ ЧАТ, free)
-- sort_order 8: author_chat (РАЗГОВОР С АВТОРАМИ, paid) — Система пары Гулдингов

-- Верификация
SELECT pm.sort_order, mt.key, mt.icon, pm.welcome_title, pm.welcome_mode_label,
  (pm.welcome_ai_message IS NOT NULL) as has_msg,
  jsonb_array_length(pm.welcome_replies) as replies_count,
  (pm.system_prompt IS NOT NULL) as has_sp
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
JOIN programs p ON p.id = pm.program_id
WHERE p.slug = 'redecision-therapy'
ORDER BY pm.sort_order;
