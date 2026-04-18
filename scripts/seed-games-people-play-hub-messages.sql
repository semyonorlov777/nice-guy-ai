-- Seed: hub_messages для программы "Игры, в которые играют люди" (GPP)
-- Заполняет programs.hub_messages — 3 ключа (first / returning_test / returning_notest).
-- Без этого на /program/games-people-play/hub AI-приветствие рендерится пустым золотым кружком.
-- Применять через `mcp__supabase__apply_migration` или Supabase SQL Editor.

UPDATE programs SET hub_messages = '{
  "first": "Привет! Я твой проводник по двум книгам Эрика Берна про психологические игры и сценарии. Начни с короткого теста — <strong>5 минут, 25 вопросов</strong>. Он покажет, какие сценарии управляют твоей жизнью.",
  "returning_test": "По твоему профилю самые сильные паттерны — <strong>{theme1}</strong> и <strong>{theme2}</strong>. С чего начнём?",
  "returning_notest": "Пройди тест — <strong>5 минут</strong>, и я подскажу, в какой режим зайти первым. А пока выбирай инструмент из списка."
}'::jsonb
WHERE slug = 'games-people-play';

-- Проверка: должно вернуть 3 ключа
-- SELECT slug, jsonb_object_keys(hub_messages) FROM programs WHERE slug = 'games-people-play';
