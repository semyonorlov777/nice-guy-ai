-- =============================================================================
-- Seed: 4 темы по группам архетипов для programs.slug = 'heroes-and-outlaws'
-- Применено через Supabase MCP в коммите feat(heroes-and-outlaws)
-- Этот файл — для воспроизводимости. Полные welcome_ai_message и welcome_system_context
-- см. в БД (program_themes) и в docs/books/heroes-and-outlaws-mode-details.md
-- =============================================================================
--
-- Все 4 темы привязаны к шкалам теста archetype-test через test_scale_key:
--   arch_paradise     → paradise_innocent (группа Тоска по Раю)
--   arch_impact       → impact_hero       (группа Оставить След)
--   arch_belonging    → belonging_regular (группа Принадлежность)
--   arch_order        → order_caregiver   (группа Структурирование)
--
-- Когда пользователь проходит тест — темы сортируются на хабе по баллам
-- соответствующих шкал (топ-2 в плейсхолдеры hub_messages.returning_test).
--
-- Каждая тема — специализированный welcome для свободного чата
-- (welcome_system_context подмешивается к programs.system_prompt
--  как «КОНТЕКСТ ТЕМЫ:» — см. lib/chat/prepare-context.ts).
--
-- Иконки тем (icon_key) добавлены в THEME_ICON_MAP в:
--   components/icons/hub-icons.tsx — 4 ключа: arch_paradise, arch_impact,
--   arch_belonging, arch_order. Переиспользуют существующие SVG:
--   CompassIcon, RocketIcon, HeartLoveIcon, ShieldIcon.

-- ВЕРИФИКАЦИЯ
SELECT key, title, icon_key, sort_order, test_scale_key,
  jsonb_array_length(welcome_replies) as replies,
  (welcome_ai_message IS NOT NULL) as has_msg,
  (welcome_system_context IS NOT NULL) as has_context
FROM program_themes
WHERE program_id = (SELECT id FROM programs WHERE slug = 'heroes-and-outlaws')
ORDER BY sort_order;
