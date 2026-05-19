-- Pricing для каталога /programs
-- Применяется через MCP Supabase execute_sql или через psql
-- Идемпотентно: можно перезапускать
--
-- Структура: landing_data.pricing = { is_paid: bool, price_rub: int, price_label?: string }
-- Источник правды для бейджа на карточке программы в каталоге.
-- Если поля нет — UI считает программу бесплатной (fallback в lib/queries/programs-catalog.ts).

-- Платные программы
UPDATE programs
SET landing_data = jsonb_set(
  COALESCE(landing_data, '{}'::jsonb),
  '{pricing}',
  '{"is_paid": true, "price_rub": 490}'::jsonb,
  true
)
WHERE slug = 'pishi-sokraschay';

-- Бесплатные программы (явно — на случай если выше fallback'а в коде кто-то заведёт строгую проверку)
UPDATE programs
SET landing_data = jsonb_set(
  COALESCE(landing_data, '{}'::jsonb),
  '{pricing}',
  '{"is_paid": false}'::jsonb,
  true
)
WHERE slug <> 'pishi-sokraschay';

-- Проверка
-- SELECT slug, title, landing_data->'pricing' as pricing FROM programs ORDER BY created_at;
