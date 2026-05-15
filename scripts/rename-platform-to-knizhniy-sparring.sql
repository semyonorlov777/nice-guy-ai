-- ═══════════════════════════════════════════════════════════════════════
-- Переименование платформы → «Книжный Спарринг»
-- Выполнить ОДИН раз в Supabase Dashboard → SQL Editor для проекта nice-guy-ai.
--
-- Что делает:
--  1. Меняет «Nice Guy AI» → «Книжный Спарринг» в meta_title всех программ.
--  2. Меняет «Nice Guy AI» во всём landing_data (включая упоминания в текстах).
--  3. В таблице сравнения форматов меняет колонку «AI-тренажёр» → «Книжный Спарринг».
--  4. Меняет «Nice Guy AI» во всех системных промптах (свободный чат, автор, режимы, упражнения).
--
-- В конце — проверка. Все цифры должны быть нулями.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. meta_title программ
UPDATE programs
SET meta_title = REPLACE(meta_title, 'Nice Guy AI', 'Книжный Спарринг')
WHERE meta_title LIKE '%Nice Guy AI%';

-- 2. landing_data: общая замена «Nice Guy AI» по всему JSON
UPDATE programs
SET landing_data = REPLACE(landing_data::text, 'Nice Guy AI', 'Книжный Спарринг')::jsonb
WHERE landing_data::text LIKE '%Nice Guy AI%';

-- 3. Колонка сравнения форматов: «AI-тренажёр» → «Книжный Спарринг»
--    Только в landing_data.comparison.columns[i].name, чтобы не задеть hero_subtitle и др.
DO $$
DECLARE
  prog RECORD;
  cols jsonb;
  i int;
BEGIN
  FOR prog IN
    SELECT id FROM programs WHERE landing_data ? 'comparison'
  LOOP
    cols := (SELECT landing_data->'comparison'->'columns' FROM programs WHERE id = prog.id);
    IF cols IS NULL THEN CONTINUE; END IF;
    FOR i IN 0..jsonb_array_length(cols)-1 LOOP
      IF cols->i->>'name' = 'AI-тренажёр' THEN
        UPDATE programs
        SET landing_data = jsonb_set(
          landing_data,
          ARRAY['comparison','columns',i::text,'name'],
          '"Книжный Спарринг"'::jsonb
        )
        WHERE id = prog.id;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 4. Системные промпты программ
UPDATE programs
SET system_prompt = REPLACE(system_prompt, 'Nice Guy AI', 'Книжный Спарринг')
WHERE system_prompt LIKE '%Nice Guy AI%';

UPDATE programs
SET anonymous_system_prompt = REPLACE(anonymous_system_prompt, 'Nice Guy AI', 'Книжный Спарринг')
WHERE anonymous_system_prompt LIKE '%Nice Guy AI%';

UPDATE programs
SET author_chat_system_prompt = REPLACE(author_chat_system_prompt, 'Nice Guy AI', 'Книжный Спарринг')
WHERE author_chat_system_prompt LIKE '%Nice Guy AI%';

-- 5. Системные промпты режимов
UPDATE program_modes
SET system_prompt = REPLACE(system_prompt, 'Nice Guy AI', 'Книжный Спарринг')
WHERE system_prompt LIKE '%Nice Guy AI%';

UPDATE mode_templates
SET system_prompt = REPLACE(system_prompt, 'Nice Guy AI', 'Книжный Спарринг')
WHERE system_prompt LIKE '%Nice Guy AI%';

-- 6. Системные промпты упражнений
UPDATE exercises
SET system_prompt = REPLACE(system_prompt, 'Nice Guy AI', 'Книжный Спарринг')
WHERE system_prompt LIKE '%Nice Guy AI%';

-- ── Проверка: все цифры должны быть нулями ──
SELECT
  (SELECT count(*) FROM programs WHERE meta_title LIKE '%Nice Guy AI%') AS programs_meta_left,
  (SELECT count(*) FROM programs WHERE landing_data::text LIKE '%Nice Guy AI%') AS programs_landing_left,
  (SELECT count(*) FROM programs WHERE system_prompt LIKE '%Nice Guy AI%') AS programs_sys_prompt_left,
  (SELECT count(*) FROM programs WHERE anonymous_system_prompt LIKE '%Nice Guy AI%') AS programs_anon_prompt_left,
  (SELECT count(*) FROM programs WHERE author_chat_system_prompt LIKE '%Nice Guy AI%') AS programs_author_prompt_left,
  (SELECT count(*) FROM program_modes WHERE system_prompt LIKE '%Nice Guy AI%') AS modes_prompt_left,
  (SELECT count(*) FROM mode_templates WHERE system_prompt LIKE '%Nice Guy AI%') AS templates_prompt_left,
  (SELECT count(*) FROM exercises WHERE system_prompt LIKE '%Nice Guy AI%') AS exercises_prompt_left;

-- Проверка колонки сравнения: все программы с comparison должны иметь «Книжный Спарринг», а не «AI-тренажёр»
SELECT slug, jsonb_path_query_array(landing_data, '$.comparison.columns[*].name') AS column_names
FROM programs
WHERE landing_data ? 'comparison'
ORDER BY slug;

COMMIT;
