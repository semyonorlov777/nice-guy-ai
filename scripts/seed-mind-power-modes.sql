-- =============================================================================
-- Seed: 7 кастомных режимов + free/author_chat для programs.slug = 'mind-power'
-- Применено через Supabase MCP execute_sql.
-- =============================================================================
--
-- sort_order распределение:
--   sort_order   5: test_mind-power-test (TEST,    access=free)  — на хабе первым (seed-mind-power-test.sql)
--   sort_order  10: mp_theory            (ЛЕКЦИЯ,  access=free)
--   sort_order  20: mp_belief_audit      (АНАЛИЗ,  access=paid)
--   sort_order  30: mp_visualization     (ВОРКШОП, access=paid)
--   sort_order  40: mp_affirmations      (ВОРКШОП, access=paid)
--   sort_order  50: mp_imprinting        (ВОРКШОП, access=paid)
--   sort_order  60: mp_victory_album     (ВОРКШОП, access=paid)
--   sort_order  70: mp_problem_lab       (ЭКЗАМЕН, access=paid)
--   sort_order  90: free_chat            (СВОБОДНЫЙ ЧАТ, access=free)
--   sort_order 100: author_chat          (РАЗГОВОР С АВТОРОМ, access=paid) — Джон Кехо
--
-- Все 7 mode_templates переиспользуют существующие icon из INSTRUMENT_ICON_MAP
-- (components/hub/InstrumentList.tsx) — новых SVG не требуется.

-- =============================================================================
-- 1. INSERT mode_templates (7 новых mp_*)
-- =============================================================================

INSERT INTO mode_templates (key, name, description, icon, chat_type, route_suffix, is_chat_based, default_sort_order) VALUES
  ('mp_theory',         'Как работает подсознание', 'Голография, формула Куэ, программирование убеждений — за один разговор',     'book-open', 'mp_theory',         '/chat', true, 10),
  ('mp_belief_audit',   'Деконструктор убеждений',  'Найди ограничивающее убеждение в финансах/здоровье/отношениях и перепиши',   'unlock',    'mp_belief_audit',   '/chat', true, 20),
  ('mp_visualization',  'Мастер визуализации',      'Спроектируй сцену для подсознания: точная и свободная визуализация',          'brain',     'mp_visualization',  '/chat', true, 30),
  ('mp_affirmations',   'Конструктор аффирмаций',   'Собери формулу под цель: позитивно, до 10 слов, по правилам Эмиля Куэ',       'sparkles',  'mp_affirmations',   '/chat', true, 40),
  ('mp_imprinting',     'Закладка чувств',          'Главная техника Кехо — прожить результат как уже наступивший',                'heart',     'mp_imprinting',     '/chat', true, 50),
  ('mp_victory_album',  'Альбом побед',             'Собери 20+ достижений — топливо энергии успеха для новых целей',              'rocket',    'mp_victory_album',  '/chat', true, 60),
  ('mp_problem_lab',    'Лаборатория возможностей', 'Преврати проблему в трамплин по 6 стратегиям творчества Кехо',                'flask',     'mp_problem_lab',    '/chat', true, 70)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 2. INSERT program_modes — применено через MCP execute_sql
-- =============================================================================
-- Полные тексты welcome_ai_message и system_prompt см. в БД и в docs/books/mind-power-system-prompts.md

-- =============================================================================
-- Верификация
-- =============================================================================

SELECT pm.sort_order, mt.key, mt.icon, pm.welcome_mode_label, pm.welcome_title,
  (pm.welcome_ai_message IS NOT NULL) as has_msg,
  jsonb_array_length(pm.welcome_replies) as replies_count,
  (pm.system_prompt IS NOT NULL) as has_sp,
  pm.access_type
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
JOIN programs p ON p.id = pm.program_id
WHERE p.slug = 'mind-power'
ORDER BY pm.sort_order;
