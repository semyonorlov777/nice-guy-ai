-- =============================================================================
-- Seed: тест «Какие силы подсознания ты уже используешь?» (mind-power-test)
-- Применено через Supabase MCP execute_sql.
-- =============================================================================
--
-- Параметры:
--   slug:               mind-power-test
--   вопросов:           25 (5 на каждую из 5 шкал: 3 direct + 2 reverse)
--   шкал:               5
--   формат:             higher_is_better (навыковый — Кехо учит мастерству, не диагностирует)
--   уровни:             Новичок / Развивающийся / Уверенный / Мастер
--   thresholds:         [25, 50, 75]
--   auth_wall:          16 (0-based, после 17-го вопроса = floor(25*0.7)-1)
--   questions_per_block: 5
--   время:              ~7 минут
--
-- Шкалы (5) на радаре идут в порядке (order 0-4):
--   mp_mind_control       — Контроль мыслей (метакогниция)
--   mp_visualization      — Практика визуализации
--   mp_affirmations       — Аффирмации в обиходе
--   mp_appreciation       — Благодарность и признание побед
--   mp_abundance_mindset  — Сознание изобилия
--
-- Связь со шкалами тем (program_themes.test_scale_key):
--   mp_abundance_mindset → тема mp_money
--   mp_visualization     → тема mp_health
--   mp_appreciation      → тема mp_relationships
--   mp_mind_control      → тема mp_creativity
--   mp_affirmations      — без темы (универсальная техника)
--
-- Главная интерпретация — топ-2 шкалы по уровню владения.
--
-- Связанные SQL-операции (применены тем же шагом):
--   1. INSERT test_configs
--   2. UPDATE programs.features.test = true
--   3. UPDATE programs.test_system_prompt
--   4. UPDATE programs.landing_data.test через jsonb_set (НЕ полная замена)
--   5. INSERT mode_template + program_mode для test_mind-power-test
--      (icon=check, is_chat_based=false, route_suffix=/test/mind-power-test, sort_order=5)
--
-- Pre-seed code-check (выполнен):
--   ✓ RadarChart поддерживает scoreDirection (после Бакирова hypnosis-test)
--   ✓ Иконки шкал добавлены в THEME_ICON_MAP (5 ключей mp_*)

-- ВЕРИФИКАЦИЯ
SELECT slug, title, jsonb_array_length(questions) as q, jsonb_array_length(scales) as s,
  scoring->>'score_direction' as direction, ui_config->>'auth_wall_question' as auth_wall
FROM test_configs WHERE slug = 'mind-power-test';

SELECT slug, features->>'test' as test_enabled,
  (test_system_prompt IS NOT NULL) as has_test_sp,
  (landing_data->'test') IS NOT NULL as has_landing_test,
  (hub_messages->'first') IS NOT NULL as has_hub_first,
  (hub_messages->'returning_test') IS NOT NULL as has_hub_returning_test,
  (hub_messages->'returning_notest') IS NOT NULL as has_hub_returning_notest
FROM programs WHERE slug = 'mind-power';

SELECT mt.key, mt.icon, mt.is_chat_based, mt.route_suffix, pm.access_type, pm.sort_order
FROM mode_templates mt JOIN program_modes pm ON pm.mode_template_id = mt.id
JOIN programs p ON p.id = pm.program_id
WHERE p.slug = 'mind-power' AND mt.key = 'test_mind-power-test';
