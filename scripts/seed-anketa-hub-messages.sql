-- Добавляет состояния hub_messages для пользователей с анкетой.
-- Состояния: anketa_only (есть анкета, нет теста), anketa_and_test (есть оба).
-- Идемпотентно: при повторном запуске значения перезапишутся.

UPDATE programs
SET hub_messages = COALESCE(hub_messages, '{}'::jsonb) || jsonb_build_object(
  'anketa_only',
    'Помню что ты пришёл с запросом: <strong>{problem}</strong>. Самое близкое в программе — <strong>{theme1}</strong>. Пройди тест (7 минут) — подскажу точнее.',
  'anketa_and_test',
    'Помню твой запрос — <strong>{problem}</strong>. По тесту сейчас самое горячее — <strong>{theme1}</strong>. Начнём оттуда?'
)
WHERE slug = 'nice-guy';
