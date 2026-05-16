-- Приводит ленды и тексты всех программ к каноническому бренду.
--
-- 1) Ярлык карточки сравнения и hero_tag — точечный jsonb_set.
-- 2) Каскадная замена AI-* во всех текстовых и JSON-полях программ:
--      AI-тренажёр (все падежи)           → «Книжный Спарринг»
--      «Nice Guy AI» (старое название)    → «Книжный Спарринг»
--      AI-<существительное>               → ИИ-<существительное>
--
-- Идемпотентно: regexp на пустых совпадениях ничего не делает.
-- Точечный jsonb_set не перезаписывает остальное содержимое landing_data.
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

-- 3) Каскадная замена AI-* во всех текстовых и JSON-полях программ.
--    Порядок важен: сначала самое специфичное (AI-тренажёр), потом «Nice Guy AI»,
--    потом общий префикс AI- → ИИ-.
UPDATE programs
SET
  meta_title = regexp_replace(
    regexp_replace(
      regexp_replace(meta_title, 'AI-тренажёр[аыуомеовамиях]*', 'Книжный Спарринг', 'g'),
      'Nice Guy AI', 'Книжный Спарринг', 'g'),
    'AI-', 'ИИ-', 'g'),
  meta_description = regexp_replace(
    regexp_replace(
      regexp_replace(meta_description, 'AI-тренажёр[аыуомеовамиях]*', 'Книжный Спарринг', 'g'),
      'Nice Guy AI', 'Книжный Спарринг', 'g'),
    'AI-', 'ИИ-', 'g'),
  description = regexp_replace(
    regexp_replace(
      regexp_replace(description, 'AI-тренажёр[аыуомеовамиях]*', 'Книжный Спарринг', 'g'),
      'Nice Guy AI', 'Книжный Спарринг', 'g'),
    'AI-', 'ИИ-', 'g'),
  free_chat_welcome = regexp_replace(
    regexp_replace(
      regexp_replace(free_chat_welcome, 'AI-тренажёр[аыуомеовамиях]*', 'Книжный Спарринг', 'g'),
      'Nice Guy AI', 'Книжный Спарринг', 'g'),
    'AI-', 'ИИ-', 'g'),
  author_chat_welcome = regexp_replace(
    regexp_replace(
      regexp_replace(author_chat_welcome, 'AI-тренажёр[аыуомеовамиях]*', 'Книжный Спарринг', 'g'),
      'Nice Guy AI', 'Книжный Спарринг', 'g'),
    'AI-', 'ИИ-', 'g'),
  system_prompt = regexp_replace(
    regexp_replace(
      regexp_replace(system_prompt, 'AI-тренажёр[аыуомеовамиях]*', 'Книжный Спарринг', 'g'),
      'Nice Guy AI', 'Книжный Спарринг', 'g'),
    'AI-', 'ИИ-', 'g'),
  anonymous_system_prompt = regexp_replace(
    regexp_replace(
      regexp_replace(COALESCE(anonymous_system_prompt, ''), 'AI-тренажёр[аыуомеовамиях]*', 'Книжный Спарринг', 'g'),
      'Nice Guy AI', 'Книжный Спарринг', 'g'),
    'AI-', 'ИИ-', 'g'),
  author_chat_system_prompt = regexp_replace(
    regexp_replace(
      regexp_replace(COALESCE(author_chat_system_prompt, ''), 'AI-тренажёр[аыуомеовамиях]*', 'Книжный Спарринг', 'g'),
      'Nice Guy AI', 'Книжный Спарринг', 'g'),
    'AI-', 'ИИ-', 'g'),
  landing_data = regexp_replace(
    regexp_replace(
      regexp_replace(landing_data::text, 'AI-тренажёр[аыуомеовамиях]*', 'Книжный Спарринг', 'g'),
      'Nice Guy AI', 'Книжный Спарринг', 'g'),
    'AI-', 'ИИ-', 'g')::jsonb,
  hub_messages = CASE
    WHEN hub_messages IS NULL THEN NULL
    ELSE regexp_replace(
      regexp_replace(
        regexp_replace(hub_messages::text, 'AI-тренажёр[аыуомеовамиях]*', 'Книжный Спарринг', 'g'),
        'Nice Guy AI', 'Книжный Спарринг', 'g'),
      'AI-', 'ИИ-', 'g')::jsonb
  END,
  anonymous_quick_replies = CASE
    WHEN anonymous_quick_replies IS NULL THEN NULL
    ELSE regexp_replace(
      regexp_replace(
        regexp_replace(anonymous_quick_replies::text, 'AI-тренажёр[аыуомеовамиях]*', 'Книжный Спарринг', 'g'),
        'Nice Guy AI', 'Книжный Спарринг', 'g'),
      'AI-', 'ИИ-', 'g')::jsonb
  END
WHERE
  meta_title ~ 'AI[- ]' OR
  meta_description ~ 'AI[- ]' OR
  description ~ 'AI[- ]' OR
  free_chat_welcome ~ 'AI[- ]' OR
  author_chat_welcome ~ 'AI[- ]' OR
  system_prompt ~ 'AI[- ]' OR
  anonymous_system_prompt ~ 'AI[- ]' OR
  author_chat_system_prompt ~ 'AI[- ]' OR
  landing_data::text ~ 'AI[- ]' OR
  hub_messages::text ~ 'AI[- ]' OR
  anonymous_quick_replies::text ~ 'AI[- ]';

-- Контрольная выборка после запуска:
-- SELECT slug, landing_data->>'hero_tag' AS hero_tag, landing_data->'comparison'->'columns' AS columns
-- FROM programs ORDER BY slug;
