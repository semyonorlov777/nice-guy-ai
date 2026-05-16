-- =============================================================================
-- Seed: 7 кастомных режимов + free/author_chat для programs.slug = 'heroes-and-outlaws'
-- Применено через Supabase MCP в коммите feat(heroes-and-outlaws): новая программа
-- Этот файл — для воспроизводимости. Полные system_prompt и welcome_*
-- см. в БД (program_modes.system_prompt) и в docs/books/heroes-and-outlaws-system-prompts.md
-- =============================================================================

-- 1. INSERT mode_templates (7 новых arch_*)
INSERT INTO mode_templates (key, name, description, icon, chat_type, route_suffix, is_chat_based, default_sort_order) VALUES
  ('arch_lecture',    '12 архетипов: ликбез',     'Сократическое объяснение системы Юнга/Пирсон через знакомые бренды',         'book-open',  'arch_lecture',    '/chat', true, 10),
  ('arch_brand',      'Архетип твоего бренда',    'Метод «Артишок» в диалоге: душа бренда → суть → клиенты → архетип',           'target',     'arch_brand',      '/chat', true, 20),
  ('arch_competitor', 'Архетип чужого бренда',    'Разбери любимый бренд или конкурента за 15 минут',                             'search',     'arch_competitor', '/chat', true, 30),
  ('arch_self',       'Твой личный архетип',       'Какой архетип ведёт тебя самого — по системе Кэрол Пирсон',                    'compass',    'arch_self',       '/chat', true, 40),
  ('arch_manifesto',  'Манифест бренда',           'Сформулируем заявление и три истории в тоне твоего архетипа',                  'lightbulb',  'arch_manifesto',  '/chat', true, 50),
  ('arch_voice',      'Голос архетипа',            'Тренируй тексты, выступления и посты в нужном архетипическом тоне',            'drama',      'arch_voice',      '/chat', true, 60),
  ('arch_recognize',  'Распознай архетип',         'Адаптивный экзамен: кейсы брендов — угадывай и расти от Стажёра до Мастера',   'flask',      'arch_recognize',  '/chat', true, 70)
ON CONFLICT (key) DO NOTHING;

-- 2. INSERT program_modes — 7 кастомных + free_chat + author_chat
-- Полные тексты SQL применены через Supabase MCP при первичном seed.
-- Воспроизведение: восстановить из БД через
--   SELECT * FROM program_modes pm
--   JOIN mode_templates mt ON mt.id = pm.mode_template_id
--   JOIN programs p ON p.id = pm.program_id
--   WHERE p.slug = 'heroes-and-outlaws' ORDER BY pm.sort_order;
--
-- sort_order распределение:
--   sort_order  5: test_archetype-test (TEST,    access=free)  — на хабе первым
--   sort_order 10: arch_lecture        (ЛЕКЦИЯ,  access=free)
--   sort_order 20: arch_brand          (АНАЛИЗ,  access=paid)  — главный режим: метод «Артишок»
--   sort_order 30: arch_competitor     (АНАЛИЗ,  access=paid)
--   sort_order 40: arch_self           (АНАЛИЗ,  access=paid)  — личный архетип по Пирсон
--   sort_order 50: arch_manifesto      (ВОРКШОП, access=paid)
--   sort_order 60: arch_voice          (РОЛЕВАЯ, access=paid)
--   sort_order 70: arch_recognize      (ЭКЗАМЕН, access=paid)
--   sort_order 90: free_chat           (СВОБОДНЫЙ ЧАТ, access=free)
--   sort_order 100: author_chat         (РАЗГОВОР С АВТОРОМ, access=paid) — Кэрол Пирсон

-- ВЕРИФИКАЦИЯ
SELECT pm.sort_order, mt.key, mt.icon, pm.welcome_title, pm.welcome_mode_label,
  (pm.welcome_ai_message IS NOT NULL) as has_msg,
  jsonb_array_length(pm.welcome_replies) as replies_count,
  (pm.system_prompt IS NOT NULL) as has_sp
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
JOIN programs p ON p.id = pm.program_id
WHERE p.slug = 'heroes-and-outlaws'
ORDER BY pm.sort_order;
