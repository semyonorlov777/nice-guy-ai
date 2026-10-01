-- Голосовой практикум учебных консультаций (структура, без текстов персонажей).
-- Тексты персонажей, рамки режимов и правила клиента — в закрытых таблицах
-- voice_modes / voice_clients; их seed лежит вне git (репозиторий публичный).
-- Повторный запуск безопасен (ON CONFLICT).

INSERT INTO programs (slug, title, description, category, features, landing_data, hub_messages, meta_title, meta_description, is_active)
VALUES (
  'mipp-praktikum',
  'Практикум учебных консультаций',
  'Голосовые учебные консультации с учебными клиентами и разбор после каждой встречи.',
  'psychology',
  '{"voice": true, "free_chat": false, "author_chat": false, "exercises": false, "test": false, "portrait": false}'::jsonb,
  '{"brand_name": "Практикум учебных консультаций", "hidden_from_catalog": true, "auth_providers": ["email", "yandex"]}'::jsonb,
  '{"first": "Здесь вы проводите учебные консультации голосом. Начните с разминки на три минуты: клиент скажет одну фразу, вы ответите.", "returning_test": "С возвращением. Продолжим с того места, где остановились.", "returning_notest": "С возвращением. Продолжим с того места, где остановились."}'::jsonb,
  'Практикум учебных консультаций',
  'Учебные консультации голосом с разбором после каждой встречи.',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  landing_data = programs.landing_data || EXCLUDED.landing_data,
  hub_messages = EXCLUDED.hub_messages,
  meta_title = EXCLUDED.meta_title,
  meta_description = EXCLUDED.meta_description;

INSERT INTO mode_templates (key, name, description, icon, chat_type, route_suffix, is_chat_based, interaction, default_sort_order) VALUES
  ('voice_warmup',              'Первые слова',          'Клиент говорит одну фразу, вы отвечаете. Разминка на три минуты',               'lightning', NULL, '/voice/warmup',        false, 'voice', 10),
  ('voice_first_minutes',       'Первые минуты',         'Начало встречи: контакт, ожидания клиента, рамка времени и цели',               'compass',   NULL, '/voice/first-minutes', false, 'voice', 20),
  ('voice_hard_moments',        'Трудный момент',        'Одна трудная реплика клиента, ваш ответ, разбор и та же реплика ещё раз',     'shield',    NULL, '/voice/hard-moments',  false, 'voice', 30),
  ('voice_first_meeting',       'Первая встреча',        'Сжатая первая консультация: контакт, ситуация, запрос и завершение',           'users',     NULL, '/voice/first-meeting', false, 'voice', 40),
  ('voice_closing',             'Мягкая посадка',        'Последние пять минут встречи: итоги, состояние клиента, следующий шаг',       'clock',     NULL, '/voice/closing',       false, 'voice', 50),
  ('voice_complaint_to_request','Жалоба → запрос',       'От сумбурной жалобы к рабочему запросу, сформулированному вместе с клиентом', 'target',    NULL, '/voice/request',       false, 'voice', 60),
  ('voice_listening',           'Слушание',              'Открытые вопросы, перефразирование, отражение чувств',                         'heart',     NULL, '/voice/listening',     false, 'voice', 70),
  ('voice_refer',               'Распознать и направить','Клиент, которому нужен врач: заметить, спросить, бережно направить',          'search',    NULL, '/voice/refer',         false, 'voice', 80),
  ('voice_red_flag',            'Красный флаг',          'Клиент в кризисе: распознать риск и направить к живой помощи',                 'unlock',    NULL, '/voice/red-flag',      false, 'voice', 90)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  route_suffix = EXCLUDED.route_suffix,
  is_chat_based = EXCLUDED.is_chat_based,
  interaction = EXCLUDED.interaction,
  default_sort_order = EXCLUDED.default_sort_order;

-- Режимы программы: system_prompt и welcome_* пустые — голосовые режимы собирает ретранслятор.
INSERT INTO program_modes (program_id, mode_template_id, enabled, sort_order, access_type, config, welcome_replies)
SELECT p.id, mt.id,
       mt.key <> 'voice_red_flag',
       mt.default_sort_order,
       'free',
       jsonb_build_object('voice', jsonb_build_object(
         'max_seconds', CASE mt.key
           WHEN 'voice_warmup' THEN 0
           WHEN 'voice_first_minutes' THEN 240
           WHEN 'voice_hard_moments' THEN 420
           WHEN 'voice_first_meeting' THEN 600
           WHEN 'voice_closing' THEN 300
           WHEN 'voice_complaint_to_request' THEN 480
           WHEN 'voice_listening' THEN 300
           WHEN 'voice_refer' THEN 600
           ELSE 0 END,
         'coming_soon', mt.key IN ('voice_closing', 'voice_complaint_to_request', 'voice_listening', 'voice_refer', 'voice_red_flag')
       )),
       '[]'::jsonb
FROM programs p
JOIN mode_templates mt ON mt.interaction = 'voice'
WHERE p.slug = 'mipp-praktikum'
ON CONFLICT (program_id, mode_template_id) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  sort_order = EXCLUDED.sort_order,
  config = EXCLUDED.config;

-- Проверка
-- SELECT mt.key, pm.enabled, pm.config FROM program_modes pm JOIN mode_templates mt ON mt.id = pm.mode_template_id
--  JOIN programs p ON p.id = pm.program_id WHERE p.slug = 'mipp-praktikum' ORDER BY pm.sort_order;
