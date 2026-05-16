-- Приводит ярлыки лендов программ к каноническому бренду:
--   comparison.columns.name «AI-тренажёр» / «AI-ассистент»  →  «Книжный Спарринг»
--   comparison.columns.role «Ежедневная практика»           →  «Практика»
--   hero_tag                «AI-тренажёр по книге»          →  «Книжный Спарринг»
--
-- Идемпотентно: где уже всё правильно, не трогает. Не перезаписывает остальное
-- содержимое landing_data — точечный jsonb_set.
--
-- Канон: docs/brand-glossary.md. Перед запуском проверь, что словарь актуален.

UPDATE programs p
SET landing_data = jsonb_set(
  landing_data,
  '{comparison,columns}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN (col->>'name') IN ('AI-тренажёр', 'AI-ассистент')
          THEN col
            || jsonb_build_object('name', 'Книжный Спарринг')
            || CASE WHEN col->>'role' = 'Ежедневная практика'
                 THEN jsonb_build_object('role', 'Практика')
                 ELSE '{}'::jsonb
               END
        WHEN (col->>'role') = 'Ежедневная практика'
          THEN col || jsonb_build_object('role', 'Практика')
        ELSE col
      END
    )
    FROM jsonb_array_elements(p.landing_data->'comparison'->'columns') AS col
  )
)
WHERE landing_data ? 'comparison'
  AND landing_data->'comparison' ? 'columns'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(landing_data->'comparison'->'columns') AS c
    WHERE (c->>'name') IN ('AI-тренажёр', 'AI-ассистент')
       OR (c->>'role') = 'Ежедневная практика'
  );

-- 2) Тег над заголовком героя — «AI-тренажёр по книге» → «Книжный Спарринг».
-- Сохраняем эмодзи-префикс «✦ » если он был (на лендинге nice-guy он стоит).
UPDATE programs
SET landing_data = jsonb_set(
  landing_data,
  '{hero_tag}',
  to_jsonb(
    CASE
      WHEN landing_data->>'hero_tag' LIKE '✦%' THEN '✦ Книжный Спарринг'
      ELSE 'Книжный Спарринг'
    END
  )
)
WHERE landing_data ? 'hero_tag'
  AND landing_data->>'hero_tag' LIKE '%AI-тренажёр%';

-- Контрольная выборка после запуска:
-- SELECT slug, landing_data->>'hero_tag' AS hero_tag, landing_data->'comparison'->'columns' AS columns
-- FROM programs ORDER BY slug;
