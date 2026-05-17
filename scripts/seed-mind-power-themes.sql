-- =============================================================================
-- Seed: 4 темы по сферам жизни для programs.slug = 'mind-power'
-- Применено через Supabase MCP execute_sql.
-- =============================================================================
--
-- Все 4 темы привязаны к шкалам теста mind-power-test через test_scale_key:
--   mp_money         → mp_abundance_mindset  (сознание изобилия)
--   mp_health        → mp_visualization      (визуализация исцеления)
--   mp_relationships → mp_appreciation       (благодарность и принятие)
--   mp_creativity    → mp_mind_control       (метакогниция = творчество)
--
-- Шкала mp_affirmations — без темы (универсальная техника, не сфера).
-- Если по тесту максимум mp_affirmations — в {theme1} попадёт
-- следующая по баллу шкала. Это осознанный выбор.
--
-- Иконки тем (icon_key) добавлены в THEME_ICON_MAP в
-- components/icons/theme-icon-map.tsx. Все 4 ключа переиспользуют
-- существующие SVG: RocketIcon, ShieldIcon, HeartLoveIcon, LightbulbIcon.
--
-- welcome_system_context подмешивается к programs.system_prompt
-- через префикс «КОНТЕКСТ ТЕМЫ:» в lib/chat/prepare-context.ts.

-- Верификация
SELECT key, title, icon_key, sort_order, test_scale_key,
  jsonb_array_length(welcome_replies) as replies,
  (welcome_ai_message IS NOT NULL) as has_msg,
  (welcome_system_context IS NOT NULL) as has_context
FROM program_themes
WHERE program_id = (SELECT id FROM programs WHERE slug = 'mind-power')
ORDER BY sort_order;
