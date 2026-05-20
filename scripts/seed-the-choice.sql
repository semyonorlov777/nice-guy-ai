-- =============================================================
-- The Choice (Эдит Эгер) — Seed-маркер для git history
-- Slug: the-choice
-- Дата применения: 2026-05-20
-- =============================================================
--
-- ⚠️ Этот файл — МАРКЕР, не источник правды.
--
-- Программа уже применена к production через 5 MCP-миграций:
--   1. the_choice_program_and_modes        (programs INSERT + mode_templates 7 шт)
--   2. the_choice_program_modes            (program_modes 8 шт со всеми welcome_* и system_prompt)
--   3. the_choice_test_inner_prison        (test_configs INSERT + test_system_prompt)
--   4. the_choice_landing_and_themes       (landing_data UPDATE + program_themes 5 шт)
--   5. the_choice_lint_fixes               (welcome_replies + system_prompt fixes по линтеру)
--   6. the_choice_lint_fixes_v2            (system_prompt блок "Запрет приветствий" на 5 режимах)
--   7. the_choice_lint_fix_nested_quote_v2 (убраны вложенные «ёлочки» в reply)
--
-- Применено через mcp__supabase__apply_migration. Каждая миграция логируется в
-- supabase.migrations. Чтобы получить текст любой миграции — выполни в Supabase:
--   SELECT * FROM supabase_migrations.schema_migrations WHERE name LIKE 'the_choice%';
--
-- Детализация режимов и промпты:
--   THE_CHOICE_MODE_DETAILS.md       (этап 3: welcome, фазы, replies, кросс-связки)
--   THE_CHOICE_SYSTEM_PROMPTS.md     (этап 4: готовые промпты для Gemini API)
--   .claude/skills/book-to-modes/examples/the-choice.md (ретроспектива)
--
-- Структура программы:
--   - 6 режимов работы (tc_prison, tc_victimhood, tc_unforgiveness,
--     tc_four_questions, tc_letter, tc_lesson)
--   - 1 тест (inner-prison): 25 вопросов, 5 шкал (lower_is_better),
--     auth_wall на вопросе 16 (0-indexed)
--   - 2 общих чата (free_chat + author_chat с Эди)
--   - 5 тем (tc_prison, tc_victimhood, tc_unforgiveness, tc_hunger, tc_reactivity)
--   - Анкета: 3 SPIN-вопроса (context_intent / problem / need_payoff)
--   - hub_messages: 5 состояний (first/returning_test/returning_notest/anketa_only/anketa_and_test)
--
-- Photo автора:  public/authors/eger.jpg (670 КБ, с Wikimedia upload)
-- Обложка книги: cdn.litres.ru/pub/c/cover_415/48508375.webp
--
-- Линтер: npm run check:chats -- --book=the-choice → 0 errors, 0 warnings

-- Если нужно посмотреть на структуру программы — выполнить:
SELECT slug, title, category,
  features->>'test' AS test, features->>'anketa' AS anketa,
  features->>'author_chat' AS author_chat
FROM programs WHERE slug = 'the-choice';

-- Список режимов:
SELECT mt.key, pm.sort_order, pm.access_type, pm.welcome_title
FROM program_modes pm JOIN mode_templates mt ON pm.mode_template_id = mt.id
WHERE pm.program_id = (SELECT id FROM programs WHERE slug = 'the-choice')
ORDER BY pm.sort_order;

-- Темы:
SELECT key, title, icon_key, test_scale_key, sort_order
FROM program_themes
WHERE program_id = (SELECT id FROM programs WHERE slug = 'the-choice')
ORDER BY sort_order;

-- Тест:
SELECT slug, total_questions, jsonb_array_length(scales) AS n_scales,
  scoring->>'score_direction' AS direction
FROM test_configs
WHERE program_id = (SELECT id FROM programs WHERE slug = 'the-choice');
