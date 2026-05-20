-- hub_messages для heroes-and-outlaws — 5 состояний хаба с учётом анкеты и теста.
--
-- Плейсхолдеры:
--   {context_intent}     — из анкеты (поле context_intent, label выбранного чипа)
--   {problem}            — из анкеты (поле problem)
--   {top1_archetype},    — топ-2 архетипа из 12 по баллам теста (test_configs.scales[*].name)
--   {top2_archetype}
--
-- Идемпотентно: при повторном запуске значения перезаписываются целиком.
-- Связано с PR «feat(anketa): подключить анкету к «Герою и Бунтарю».

UPDATE programs
SET hub_messages = jsonb_build_object(
  'first',
    'Привет. Это твой тренажёр по архетипам Юнга-Пирсон. Начнём с теста — <strong>7 минут, 24 вопроса</strong>. Узнаешь топ-2 архетипа из 12, на которых строятся бренды и личные истории.',
  'anketa_only',
    'Твой запрос — {context_intent}. Чтобы выбор архетипа был предметным, пройди тест — <strong>24 вопроса, 7 минут</strong>. Без него мы будем гадать; с ним — работать предметно.',
  'returning_test',
    'С возвращением. Твои сильные архетипы — <strong>{top1_archetype}</strong> и <strong>{top2_archetype}</strong>. С чего начнём — разбор бренда, голос архетипа или личный?',
  'returning_notest',
    'С возвращением. Что разбираем сегодня — твой бренд, чужой или новая тема?',
  'anketa_and_test',
    'Твой запрос — {context_intent}. По тесту твои сильные архетипы — <strong>{top1_archetype}</strong> и <strong>{top2_archetype}</strong>. С учётом «{problem}» это даёт конкретную оптику. С чего начнём?'
)
WHERE slug = 'heroes-and-outlaws';
