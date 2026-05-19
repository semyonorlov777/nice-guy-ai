-- =============================================================================
-- Программа «Transdiagnostic Road Map to Case Formulation»
-- Slug: transdiagnostic-cbt
-- Книга: Frank, R. I., & Davidson, J. (2014). The Transdiagnostic Road Map
--        to Case Formulation and Treatment Planning: Practical Guidance for
--        Clinical Decision Making. New Harbinger Publications.
--        ISBN 9781608828968. Forward by Jacqueline B. Persons, PhD.
-- Тип: профессиональная учебная программа по CBT case formulation
-- ЦА: practicing psychologists, advanced CBT students, клинические супервизоры
-- Features: free_chat, author_chat (Persons), portrait, test, modes, themes
-- Архетипы режимов: Лекция-сократ ×1 + Анализ ×2 + Воркшоп ×2 + Ролевая ×1 + Экзамен ×1
-- Тон Система: «коллега-супервизор» — академический peer-level, на «ты»
-- =============================================================================
-- Применено через Supabase MCP. Этот файл — для воспроизводимости.
-- Полные тексты:
--   programs.system_prompt          — см. transdiagnostic_cbt_SYSTEM_PROMPTS.md секция «programs.system_prompt»
--   programs.anonymous_system_prompt — см. transdiagnostic_cbt_SYSTEM_PROMPTS.md секция «programs.anonymous_system_prompt»
--   programs.author_chat_system_prompt — см. transdiagnostic_cbt_SYSTEM_PROMPTS.md секция «programs.author_chat_system_prompt»
--   programs.test_system_prompt      — см. transdiagnostic_cbt_SYSTEM_PROMPTS.md секция «programs.test_system_prompt»
--   programs.free_chat_welcome       — см. transdiagnostic_cbt_SYSTEM_PROMPTS.md секция «programs.free_chat_welcome»
--   programs.author_chat_welcome     — см. transdiagnostic_cbt_SYSTEM_PROMPTS.md секция «programs.author_chat_welcome»
-- =============================================================================

INSERT INTO programs (
  slug,
  title,
  description,
  system_prompt,
  anonymous_system_prompt,
  free_chat_welcome,
  author_chat_system_prompt,
  author_chat_welcome,
  test_system_prompt,
  config,
  features,
  meta_title,
  meta_description,
  landing_data,
  hub_messages,
  anonymous_quick_replies
) VALUES (
  'transdiagnostic-cbt',

  'Transdiagnostic Road Map',

  'Учебный тренажёр по книге Frank & Davidson (2014) — case formulation в трансдиагностическом подходе CBT. Для практикующих психологов и продвинутых студентов: разбор кейсов, симуляция клиента, экзамен с винетками. Опора — supervisory research (Eells, Kuyken, Persons, Bennett-Levy, Padesky).',

  -- ═══ programs.system_prompt — полный текст применяется через MCP (см. transdiagnostic_cbt_SYSTEM_PROMPTS.md)
  '[применяется через MCP — см. transdiagnostic_cbt_SYSTEM_PROMPTS.md секция «programs.system_prompt»]',

  -- ═══ anonymous_system_prompt (демо-чат на лендинге)
  '[применяется через MCP — см. transdiagnostic_cbt_SYSTEM_PROMPTS.md секция «programs.anonymous_system_prompt»]',

  -- ═══ free_chat_welcome
  '[применяется через MCP — см. transdiagnostic_cbt_SYSTEM_PROMPTS.md секция «programs.free_chat_welcome»]',

  -- ═══ author_chat_system_prompt (Persons)
  '[применяется через MCP — см. transdiagnostic_cbt_SYSTEM_PROMPTS.md секция «programs.author_chat_system_prompt»]',

  -- ═══ author_chat_welcome
  '[применяется через MCP — см. transdiagnostic_cbt_SYSTEM_PROMPTS.md секция «programs.author_chat_welcome»]',

  -- ═══ test_system_prompt (применяется отдельным seed-test файлом)
  NULL,

  -- ═══ config
  '{}'::jsonb,

  -- ═══ features (test и themes включаются отдельными seed'ами)
  '{"free_chat": true, "exercises": false, "portrait": false, "author_chat": true, "test": false, "modes": true}'::jsonb,

  -- ═══ meta_title
  'Transdiagnostic Road Map — учебный тренажёр по книге Frank & Davidson | Книжный Спарринг',

  -- ═══ meta_description
  'Учебный тренажёр по case formulation в трансдиагностическом подходе CBT. Книга Frank & Davidson (2014, New Harbinger). Для практикующих психологов и продвинутых студентов: разбор кейсов, симуляция клиента, экзамен.',

  -- ═══ landing_data
  '{
    "hero_tag": "Учебный тренажёр по книге The Transdiagnostic Road Map",
    "hero_title": "Тренируй <em>case formulation</em> в трансдиагностическом подходе",
    "hero_subtitle": "Учебный тренажёр по книге Frank & Davidson (2014, New Harbinger). Для практикующих психологов и продвинутых студентов CBT: разбор клинических случаев, симуляция клиента, экзамен с типизированными ловушками.",
    "hero_cta": "Узнать свой уровень ↓",
    "hero_hint": "Бесплатный тест, без регистрации",
    "book": {
      "cover_url": "/covers/transdiagnostic-roadmap.jpg",
      "alt": "The Transdiagnostic Road Map to Case Formulation and Treatment Planning — Frank & Davidson",
      "author_top": "Rochelle I. Frank, Joan Davidson",
      "title": "The Transdiagnostic Road Map to Case Formulation",
      "subtitle": "Practical Guidance for Clinical Decision Making",
      "author_bottom": "Frank, R. I., & Davidson, J., New Harbinger Publications, 2014. Forward by Jacqueline B. Persons, PhD."
    },
    "main_concepts": [
      "Transdiagnostic Mechanisms",
      "Vulnerability mechanisms",
      "Response mechanisms",
      "Working hypothesis",
      "Skillful creativity",
      "Collaborative empiricism",
      "Iterative revision"
    ],
    "social_proof": [
      {"icon": "book-open", "main": "2014", "sub": "год книги — стандарт CBT case formulation"},
      {"icon": "users", "main": "200+", "sub": "эмпирических источников у Frank & Davidson"},
      {"icon": "target", "main": "5", "sub": "этапов road map — карта клинических решений"},
      {"icon": "clock", "main": "86%", "sub": "повышение качества формулировки после структурированного тренинга (Kendjelic & Eells 2007)"}
    ],
    "outcomes": {
      "label": "Что освоишь",
      "title": "Навыки <em>case formulation</em> через тренировку, не теорию",
      "subtitle": "Не пересказ книги. Конкретная работа по road map — для твоего реального кейса или винетки.",
      "items": [
        {"icon": "📖", "title": "Словарь TDMs", "description": "Все категории механизмов из глав 2-3 — vulnerability + response. Кросс-таблица к Kuyken и Persons"},
        {"icon": "🔍", "title": "Разбор кейса", "description": "Свой клиент или винетка из библиотеки. PDL и chain analysis через сократические вопросы"},
        {"icon": "✍️", "title": "Сборка гипотезы", "description": "Working hypothesis как связный нарратив 150-250 слов. CCC-RS rubric для оценки"},
        {"icon": "🎭", "title": "Симуляция клиента", "description": "AI играет клиента с встроенными data inconsistencies. Тренировка procedural knowledge (Bennett-Levy DPR)"},
        {"icon": "🎯", "title": "Treatment Plan", "description": "Mechanism → intervention. Блок против a la carte CBT"},
        {"icon": "✅", "title": "Экзамен с винетками", "description": "18+ кейсов с типизированными ловушками. Адаптивная сложность"},
        {"icon": "👥", "title": "Кабинет супервизии", "description": "Пересмотр застрявших кейсов — confirmation bias, anchoring, Forever Fallacy challenge"},
        {"icon": "💬", "title": "Разговор с Persons", "description": "Прямые вопросы Jacqueline B. Persons (Forward к книге, автор case formulation approach)"}
      ]
    },
    "author": {
      "photo_url": "/authors/persons.jpg",
      "name": "Jacqueline B. Persons, PhD",
      "credentials": "Директор Cognitive Behavior Therapy and Science Center в Беркли (Калифорния). Clinical Professor психологического факультета UC Berkeley. Главный авторитет CBT по case formulation approach. Автор книг «The Case Formulation Approach to Cognitive-Behavior Therapy» (2008) и «Cognitive Therapy in Practice: A Case Formulation Approach» (1989). Написала Forward к книге Frank & Davidson 2014.",
      "quote": "Знание о механизмах, на которых поддерживаются проблемы пациента, — критический аспект клинического суждения и необходимый шаг к разработке эффективного лечения."
    },
    "personas": {
      "label": "Для кого",
      "title": "Для тех, кто <em>учится мыслить</em>, а не следовать протоколу",
      "items": [
        {"headline": "Практикующий психолог", "body": "Уже знаешь CBT-протоколы, но клиенты приходят с коморбидностью, и нужен инструмент думать через mechanisms, а не диагнозы"},
        {"headline": "Студент продвинутой CBT", "body": "Освоил базу, но супервизор говорит «case conceptualization» — а с чего начать кроме списка проблем, непонятно"},
        {"headline": "Клинический супервизор", "body": "Обучаешь стажёров case formulation. Нужны структурированные кейсы и rubric для тренировок между сессиями"},
        {"headline": "Преподаватель CBT-программы", "body": "Готовишь курс по case formulation. Ищешь тренажёр, который дополнит твои лекции практикой"}
      ]
    },
    "problem": {
      "label": "Проблема",
      "title": "Между знанием CBT и <em>умением формулировать кейс</em> — пропасть",
      "lead": "Эмпирические исследования (Eells, Kendjelic & Lucas 1998 на 56 интейках) показывают: только 43% формулировок содержат гипотезу о механизме. Остальные 57% — описание симптомов вместо объяснения, что их поддерживает. Pattern устойчив у новичков и развивающихся специалистов.",
      "pain_cards": [
        {"icon": "🌫️", "title": "Клиент комплексный — план «солянка»", "text": "Депрессия + OCD + травма у одного клиента. Протоколы для каждого, но как собрать в один план — непонятно. Получается a la carte CBT"},
        {"icon": "🔄", "title": "Сформулировал — но это описание, не объяснение", "text": "Список проблем, перечень механизмов. А связной истории «как именно X поддерживает Y» — нет. Не отличаешь descriptive от explanatory"},
        {"icon": "🎯", "title": "Знаю интервенции, не знаю как выбрать", "text": "Cognitive restructuring? Exposure? Mindfulness? Какую тащить под этого клиента и почему — каждый раз заново гадаешь"},
        {"icon": "🧭", "title": "Кейс стагнирует — а гипотеза не меняется", "text": "Прошло 5 сессий, симптомы те же. Клиент говорит то, что не вписывается в твою формулировку, — а ты не пересматриваешь. Это confirmation bias"}
      ]
    },
    "comparison": {
      "label": "Сравнение",
      "title": "Как <em>тренировать</em> case formulation?",
      "subtitle": "Три способа развивать навык",
      "columns": [
        {"icon": "📕", "name": "Книга", "role": "Теория"},
        {"icon": "🧠", "name": "Очная супервизия", "role": "Практика с супервизором"},
        {"icon": "🤖", "name": "Книжный Спарринг", "role": "Практика", "highlight": true}
      ],
      "rows": [
        {"param": "Разбор твоего кейса", "values": ["Нет, чужие кейсы из глав", "Да, но 1-2 в месяц", "Да, в любой момент"], "dim": [0]},
        {"param": "Тренировка в реальном времени (procedural)", "values": ["Только теория", "Редко", "Симуляция клиента"], "dim": [0, 1]},
        {"param": "Структурированная обратная связь", "values": ["Нет", "Личная супервизия", "По CCC-RS rubric"], "dim": [0]},
        {"param": "Тренировка против confirmation bias", "values": ["Только описание", "Зависит от супервизора", "Встроенный паттерн"], "dim": [0, 1]},
        {"param": "Стоимость", "values": ["~$30 книга", "от 5000₽ за час", "Бесплатные пробные сообщения"], "dim": [1]}
      ],
      "conclusion": "Тренажёр — <em>мост между книгой и супервизией</em>. Не заменяет очную супервизию для сложных кейсов, но даёт ежедневную практику между ней."
    },
    "how_it_works": {
      "label": "Как это работает",
      "title": "От <em>понимания TDMs</em> к working hypothesis за 4 шага",
      "steps": [
        {"type": "test", "title": "Пройди тест мастерства (≈10 минут, 25 вопросов)"},
        {"type": "insight", "title": "Получи профиль по 5 шкалам road map: где сильно, где зона роста"},
        {"type": "chat", "title": "Разбери реальный кейс — свой или из библиотеки (Tom, Linda, Jonah из книги + 5+ русифицированных)"},
        {"type": "portrait", "title": "Собери working hypothesis и treatment plan; протестируй в симуляции клиента"}
      ],
      "summary_text": "Система помнит твой контекст. Каждый следующий разбор использует данные предыдущих режимов."
    },
    "chat_header": {
      "title": "У тебя сложный кейс?",
      "subtitle": "Опиши клинический материал — попробуем определить TDMs за 3 сообщения"
    },
    "price": {
      "trial_text": "Тест и демо-чат — бесплатно",
      "price_text": "Полный доступ — дешевле часа супервизии",
      "anchor_text": "Подробнее о тарифах"
    }
  }'::jsonb,

  -- ═══ hub_messages (приветствие Системы на хабе — обязательно)
  '{
    "first": "Привет, коллега. Это твой тренажёр по case formulation в трансдиагностическом подходе Frank & Davidson. Начни с теста — <strong>10 минут, 25 вопросов</strong>. По профилю по 5 шкалам road map подскажу, с какого режима начать.",
    "returning_test": "По твоему профилю самые сильные зоны роста — <strong>{theme1}</strong> и <strong>{theme2}</strong>. С чего начнём?",
    "returning_notest": "Пройди тест — <strong>10 минут</strong>, и я подскажу персонализированный путь по 5 шкалам road map. А пока выбирай инструмент."
  }'::jsonb,

  -- ═══ anonymous_quick_replies
  '[
    {"text": "У меня клиент с депрессией + ОКР, не знаю как собрать в один план", "type": "normal"},
    {"text": "Сформулировал гипотезу, не уверен(а) что она правильная", "type": "normal"},
    {"text": "Хочу разобраться что такое transdiagnostic mechanisms", "type": "normal"},
    {"text": "Просто пройду тест — посмотрю свой уровень", "type": "exit"}
  ]'::jsonb
);

-- ═══ Верификация ═══
SELECT
  slug, title,
  features->>'free_chat' as free_chat,
  features->>'author_chat' as author_chat,
  features->>'test' as test,
  features->>'modes' as modes,
  (system_prompt IS NOT NULL) as has_sp,
  (author_chat_system_prompt IS NOT NULL) as has_acsp,
  (anonymous_system_prompt IS NOT NULL) as has_asp,
  (landing_data IS NOT NULL) as has_landing,
  (hub_messages IS NOT NULL) as has_hub,
  jsonb_array_length(landing_data->'main_concepts') as concepts_count,
  landing_data->'author'->>'photo_url' as photo_url,
  landing_data->'book'->>'cover_url' as cover_url
FROM programs
WHERE slug = 'transdiagnostic-cbt';
