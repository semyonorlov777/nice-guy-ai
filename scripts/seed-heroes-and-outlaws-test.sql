-- =============================================================================
-- Seed: тест «Архетип бренда и личности» (archetype-test) для heroes-and-outlaws
-- Применено через Supabase MCP в коммите feat(heroes-and-outlaws)
-- Этот файл — для воспроизводимости. Полный JSON см. в БД (test_configs.questions/scales)
-- и в docs/books/heroes-and-outlaws-system-prompts.md (interpretation_prompt)
-- =============================================================================
--
-- Параметры:
--   slug:               archetype-test
--   вопросов:           24 (по 2 на каждый из 12 архетипов: 1 direct + 1 reverse)
--   шкал:               12 (по одной на архетип)
--   формат:             higher_is_better (с переинтерпретацией под нейтральный профиль)
--   уровни:             В тени / Зарождающийся / Осознанный / Доминирующий
--   auth wall question: 15 (0-based, после 16-го вопроса)
--   время:              ~7 минут
--
-- Шкалы (12) сгруппированы на радаре по 4 секторам:
--   Группа Оставить След:    impact_hero, impact_outlaw, impact_magician (order 0-2)
--   Группа Структурирование: order_caregiver, order_creator, order_ruler (order 3-5)
--   Группа Принадлежность:   belonging_regular, belonging_lover, belonging_jester (order 6-8)
--   Группа Тоска по Раю:     paradise_innocent, paradise_explorer, paradise_sage (order 9-11)
--
-- Главная интерпретация — топ-2 архетипа из 12 (а не уровень по каждой шкале).
-- Это новый паттерн платформы: тест возвращает «профиль», не «диагноз».
--
-- Связанные SQL-операции (применены тем же шагом):
--   1. INSERT test_configs (этот файл — описание)
--   2. UPDATE programs.features.test = true
--   3. UPDATE programs.test_system_prompt (без него API теста вернёт 404)
--   4. UPDATE programs.landing_data.test через jsonb_set (НЕ полная замена)
--   5. INSERT mode_template + program_mode для test_archetype-test
--      (icon=check, is_chat_based=false, route_suffix=/test/archetype-test)
--   6. UPDATE programs.hub_messages с 3 ключами:
--      first / returning_test (плейсхолдеры {theme1}/{theme2}) / returning_notest
--
-- Pre-seed code-check (выполнен):
--   ✓ RadarChart поддерживает scoreDirection (после Бакирова hypnosis-test)
--   ✓ TestResultsPage принимает levelLabels/levelThresholds
--   ✓ results/[id]/page.tsx пробрасывает props
--   ✓ lib/chat/prepare-context.ts::appendTestScores работает generic по slug
--   ✓ Регрессия ISSP, GPP, hypnosis-test — не пострадала (default lower_is_better)

-- ВЕРИФИКАЦИЯ
SELECT slug, title, jsonb_array_length(questions) as q, jsonb_array_length(scales) as s,
  scoring->>'score_direction' as direction, ui_config->>'auth_wall_question' as auth_wall
FROM test_configs WHERE slug = 'archetype-test';

SELECT slug, features->>'test' as test_enabled,
  (test_system_prompt IS NOT NULL) as has_test_sp,
  (landing_data->'test') IS NOT NULL as has_landing_test,
  (hub_messages->'first') IS NOT NULL as has_hub_first,
  (hub_messages->'returning_test') IS NOT NULL as has_hub_returning_test,
  (hub_messages->'returning_notest') IS NOT NULL as has_hub_returning_notest
FROM programs WHERE slug = 'heroes-and-outlaws';

SELECT mt.key, mt.icon, mt.is_chat_based, mt.route_suffix, pm.access_type, pm.sort_order
FROM mode_templates mt JOIN program_modes pm ON pm.mode_template_id = mt.id
JOIN programs p ON p.id = pm.program_id
WHERE p.slug = 'heroes-and-outlaws' AND mt.key = 'test_archetype-test';
