-- =============================================================================
-- Seed: 5 тем хаба для programs.slug = 'redecision-therapy'
-- Маппинг тем на шкалы теста через test_scale_key
-- Иконки добавлены в components/icons/hub-icons.tsx → THEME_ICON_MAP
-- =============================================================================

INSERT INTO program_themes (
  program_id, key, sort_order, title, description, icon_key,
  welcome_mode_label, welcome_title, welcome_subtitle,
  welcome_ai_message, welcome_replies, welcome_system_context, test_scale_key, enabled
)
SELECT
  (SELECT id FROM programs WHERE slug = 'redecision-therapy'),
  v.key, v.sort_order, v.title, v.description, v.icon_key,
  v.welcome_mode_label, v.welcome_title, v.welcome_subtitle,
  v.welcome_ai_message, v.welcome_replies::jsonb, v.welcome_system_context, v.test_scale_key, true
FROM (VALUES
  -- intimacy → rd_intimacy
  ('intimacy', 1, 'Близость без потери себя',
   'Запрет на близость — раннее решение «безопаснее в одиночестве»',
   'intimacy', 'РАБОТА С ТЕМОЙ', 'Запрет на близость',
   'Раннее решение: «безопаснее одному»',
   '<welcome_ai_message — см. БД>',
   '[{"text":"Я отталкиваю людей","type":"normal"},{"text":"Сложно говорить о чувствах","type":"normal"},{"text":"Не умею просить о помощи","type":"normal"},{"text":"Не знаю с чего начать","type":"exit"}]',
   'КОНТЕКСТ ТЕМЫ: Пользователь работает с темой «Запрет на близость»...',
   'rd_intimacy'),

  -- feelings → rd_feelings
  ('feelings', 2, 'Разрешить себе чувствовать',
   'Запрет на чувства — раннее решение «эмоции опасны»',
   'feelings', 'РАБОТА С ТЕМОЙ', 'Запрет на чувства',
   'Раннее решение: «чувствовать — слабость»',
   '<welcome_ai_message — см. БД>',
   '[{"text":"Не позволяю себе злиться","type":"normal"},{"text":"Чувствую вину после эмоций","type":"normal"},{"text":"Онемение — не понимаю что чувствую","type":"normal"},{"text":"Мне сложно сформулировать","type":"exit"}]',
   'КОНТЕКСТ ТЕМЫ: Пользователь работает с темой «Запрет на чувства»...',
   'rd_feelings'),

  -- success → rd_success
  ('success', 3, 'Идти к успеху без саботажа',
   'Запрет на успех — раннее решение «успех опасен»',
   'success', 'РАБОТА С ТЕМОЙ', 'Запрет на успех',
   'Раннее решение: «лучше не выделяться»',
   '<welcome_ai_message — см. БД>',
   '[{"text":"Откладываю важное","type":"normal"},{"text":"Тревога когда получается","type":"normal"},{"text":"Делаю что снижает шансы","type":"normal"},{"text":"Не уверен что про меня","type":"exit"}]',
   'КОНТЕКСТ ТЕМЫ: Пользователь работает с темой «Запрет на успех»...',
   'rd_success'),

  -- authenticity → rd_authenticity
  ('authenticity', 4, 'Быть собой',
   'Запрет на самость — раннее решение «удобный = безопасный»',
   'authenticity', 'РАБОТА С ТЕМОЙ', 'Запрет на самость',
   'Раннее решение: «я тот, кем меня хотят видеть»',
   '<welcome_ai_message — см. БД>',
   '[{"text":"Говорю что от меня ждут","type":"normal"},{"text":"Не знаю чего хочу сам(а)","type":"normal"},{"text":"Сложно высказать мнение в группе","type":"normal"},{"text":"Не уверен с чего начать","type":"exit"}]',
   'КОНТЕКСТ ТЕМЫ: Пользователь работает с темой «Запрет на самость»...',
   'rd_authenticity'),

  -- drivers → rd_drivers
  ('drivers', 5, 'Замедлиться с драйверами',
   'Драйвер-зависимость — «я ценен только когда…»',
   'drivers', 'РАБОТА С ТЕМОЙ', 'Драйвер-зависимость',
   'Контрсценарная стратегия Калера',
   '<welcome_ai_message — см. БД>',
   '[{"text":"Если не идеально — провал","type":"normal"},{"text":"Редко позволяю остановиться","type":"normal"},{"text":"Чужие нужды выше своих","type":"normal"},{"text":"Сложно выбрать главный драйвер","type":"exit"}]',
   'КОНТЕКСТ ТЕМЫ: Пользователь работает с темой «Драйвер-зависимость»...',
   'rd_drivers')
) AS v(key, sort_order, title, description, icon_key,
       welcome_mode_label, welcome_title, welcome_subtitle,
       welcome_ai_message, welcome_replies, welcome_system_context, test_scale_key)
ON CONFLICT (program_id, key) DO NOTHING;

-- ВНИМАНИЕ: полные тексты welcome_ai_message и welcome_system_context — в БД.
-- Этот файл — заглушка для воспроизводимости из БД через pg_dump.
-- При первичном seed данные применены через Supabase MCP (см. git history).

-- Верификация
SELECT pt.sort_order, pt.key, pt.icon_key, pt.title, pt.test_scale_key,
  (pt.welcome_ai_message IS NOT NULL) as has_msg,
  jsonb_array_length(pt.welcome_replies) as replies_count,
  (pt.welcome_system_context IS NOT NULL) as has_ctx
FROM program_themes pt
JOIN programs p ON p.id = pt.program_id
WHERE p.slug = 'redecision-therapy'
ORDER BY pt.sort_order;
