-- =============================================================================
-- Seed: Тест redecision-test для programs.slug = 'redecision-therapy'
-- Формат: ДИАГНОСТИЧЕСКИЙ (lower_is_better), 5 шкал × 5 вопросов = 25 вопросов
-- Шкалы: rd_intimacy / rd_feelings / rd_success / rd_authenticity / rd_drivers
-- Auth wall: idx 16 (между Q16 и Q17, 70% от 25 вопросов)
-- Применено через Supabase MCP в коммите feat(redecision): add test + themes
-- =============================================================================

-- 1. INSERT test_configs
INSERT INTO test_configs (
  program_id, slug, title, short_title, description,
  questions, scales, scoring, ui_config,
  interpretation_prompt, mini_analysis_prompt_template, is_active
) VALUES (
  (SELECT id FROM programs WHERE slug = 'redecision-therapy'),
  'redecision-test',
  'Какое у тебя главное предписание?',
  'Предписания',
  'Диагностический тест по методу Гулдингов: 25 утверждений → 5 шкал родительских предписаний.',
  '[
    {"q":1,  "scale":"rd_intimacy",      "type":"direct",  "text":"Когда отношения становятся глубокими, я неосознанно начинаю отстраняться"},
    {"q":2,  "scale":"rd_intimacy",      "type":"direct",  "text":"Мне сложно просить о помощи, даже когда я её жду"},
    {"q":3,  "scale":"rd_intimacy",      "type":"direct",  "text":"Я часто скрываю настоящие чувства, чтобы не показаться уязвимым(-ой)"},
    {"q":4,  "scale":"rd_intimacy",      "type":"reverse", "text":"Я легко делюсь с близкими тем, что меня по-настоящему трогает"},
    {"q":5,  "scale":"rd_intimacy",      "type":"reverse", "text":"Когда мне плохо, я могу спокойно сказать об этом близкому человеку"},
    {"q":6,  "scale":"rd_feelings",      "type":"direct",  "text":"Я часто чувствую онемение или пустоту там, где должен(-на) бы быть сильно расстроен(а)"},
    {"q":7,  "scale":"rd_feelings",      "type":"direct",  "text":"Гнев, печаль или страх кажутся мне слабостью, которую нельзя показывать"},
    {"q":8,  "scale":"rd_feelings",      "type":"direct",  "text":"После сильных эмоций я часто чувствую вину или стыд за них"},
    {"q":9,  "scale":"rd_feelings",      "type":"reverse", "text":"Я могу спокойно плакать, злиться или бояться, не осуждая себя за это"},
    {"q":10, "scale":"rd_feelings",      "type":"reverse", "text":"Я различаю свои эмоции и могу назвать их словами"},
    {"q":11, "scale":"rd_success",       "type":"direct",  "text":"Перед важным шагом я неосознанно делаю что-то, что снижает мои шансы на успех"},
    {"q":12, "scale":"rd_success",       "type":"direct",  "text":"Когда у меня получается, я ощущаю тревогу или жду, что что-то пойдёт не так"},
    {"q":13, "scale":"rd_success",       "type":"direct",  "text":"Я часто откладываю важное дело и потом жалею об этом"},
    {"q":14, "scale":"rd_success",       "type":"reverse", "text":"Я спокойно принимаю свои достижения, без чувства что я их не заслужил(а)"},
    {"q":15, "scale":"rd_success",       "type":"reverse", "text":"Когда хочу чего-то добиться — иду к этому без саботажа"},
    {"q":16, "scale":"rd_authenticity",  "type":"direct",  "text":"Я часто говорю или делаю то, что от меня ждут, а не то, что хочу сам(а)"},
    {"q":17, "scale":"rd_authenticity",  "type":"direct",  "text":"Мне сложно сказать это моё мнение в группе, если оно отличается от других"},
    {"q":18, "scale":"rd_authenticity",  "type":"direct",  "text":"Я не знаю наверняка, чего хочу — обычно ориентируюсь на других"},
    {"q":19, "scale":"rd_authenticity",  "type":"reverse", "text":"Я могу спокойно настоять на своём, даже когда это неудобно окружающим"},
    {"q":20, "scale":"rd_authenticity",  "type":"reverse", "text":"Я хорошо понимаю свои ценности и живу в согласии с ними"},
    {"q":21, "scale":"rd_drivers",       "type":"direct",  "text":"Я ощущаю себя ценным(-ой) только когда что-то делаю быстро, идеально или для других"},
    {"q":22, "scale":"rd_drivers",       "type":"direct",  "text":"Я редко позволяю себе остановиться и просто побыть"},
    {"q":23, "scale":"rd_drivers",       "type":"direct",  "text":"Если задача сделана не идеально, я ощущаю это как провал"},
    {"q":24, "scale":"rd_drivers",       "type":"reverse", "text":"Я могу спокойно работать в комфортном темпе, не подгоняя себя"},
    {"q":25, "scale":"rd_drivers",       "type":"reverse", "text":"Я отдыхаю без чувства вины, что должен(-на) делать что-то полезное"}
  ]'::jsonb,
  '[
    {"key":"rd_intimacy",     "name":"Запрет на близость",   "order":1, "exercises":[], "radar_label":["Запрет","на близость"]},
    {"key":"rd_feelings",     "name":"Запрет на чувства",    "order":2, "exercises":[], "radar_label":["Запрет","на чувства"]},
    {"key":"rd_success",      "name":"Запрет на успех",      "order":3, "exercises":[], "radar_label":["Запрет","на успех"]},
    {"key":"rd_authenticity", "name":"Запрет на самость",    "order":4, "exercises":[], "radar_label":["Запрет","на самость"]},
    {"key":"rd_drivers",      "name":"Драйвер-зависимость",  "order":5, "exercises":[], "radar_label":["Драйвер-","зависимость"]}
  ]'::jsonb,
  '{
    "answer_range": [1, 5],
    "score_direction": "lower_is_better",
    "level_thresholds": [25, 50, 75],
    "level_labels": ["Низкий уровень", "Умеренный уровень", "Выраженный уровень", "Высокий уровень"]
  }'::jsonb,
  '{}'::jsonb,  -- ui_config: см. БД (welcome_title, block_insights, analyzing_stages, etc.)
  '<полный interpretation_prompt — см. БД>',
  '<полный mini_analysis_prompt_template — см. БД>',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Feature flag
UPDATE programs SET features = features || '{"test": true}'::jsonb WHERE slug = 'redecision-therapy';

-- 3. test_system_prompt (для streaming text-answers во время теста)
UPDATE programs SET test_system_prompt = E'<см. БД — полный текст с правилами тона и safety>'
WHERE slug = 'redecision-therapy' AND test_system_prompt IS NULL;

-- 4. landing_data.test секция
UPDATE programs SET landing_data = jsonb_set(landing_data, '{test}', '{
  "emoji": "🎭",
  "title": "Какое у тебя главное предписание?",
  "description": "Диагностика по методу Гулдингов: 5 ключевых запретов",
  "time_label": "~5 минут",
  "questions_label": "25 вопросов",
  "cta_text": "Найти своё предписание",
  "cta_href": "/program/redecision-therapy/test"
}'::jsonb) WHERE slug = 'redecision-therapy';

-- 5. mode_template + program_mode для теста
INSERT INTO mode_templates (key, name, description, icon, chat_type, route_suffix, is_chat_based, default_sort_order)
VALUES ('test_redecision', 'Какое у тебя предписание?', 'Тест на 5 предписаний', 'check', NULL, '/test/redecision-test', false, 10)
ON CONFLICT (key) DO NOTHING;

INSERT INTO program_modes (program_id, mode_template_id, sort_order, enabled, access_type)
SELECT
  (SELECT id FROM programs WHERE slug = 'redecision-therapy'),
  (SELECT id FROM mode_templates WHERE key = 'test_redecision'),
  0, true, 'free'
ON CONFLICT DO NOTHING;

-- 6. hub_messages (3 ключа: first / returning_test / returning_notest)
UPDATE programs SET hub_messages = '{
  "first": "Привет! Это метод Гулдингов — мы помогаем переписать ранние решения, которые принял маленький ты. Начни с теста — <strong>5 минут, 25 вопросов</strong>. Покажет твои главные предписания.",
  "returning_test": "По твоему профилю самые выраженные предписания — <strong>{theme1}</strong> и <strong>{theme2}</strong>. С чего начнём?",
  "returning_notest": "Пройди тест — <strong>5 минут</strong>, я найду твои главные предписания. А пока выбирай инструмент."
}'::jsonb WHERE slug = 'redecision-therapy';

-- Верификация
SELECT tc.slug, tc.title,
  jsonb_array_length(tc.questions) as q_count,
  jsonb_array_length(tc.scales) as scale_count,
  tc.scoring->>'score_direction' as score_dir,
  p.features->>'test' as test_feature,
  (p.test_system_prompt IS NOT NULL) as has_test_sp,
  (p.hub_messages->>'first' IS NOT NULL) as has_hub_msg
FROM test_configs tc
JOIN programs p ON p.id = tc.program_id
WHERE tc.slug = 'redecision-test';
