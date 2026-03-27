# Platform Map: Как режимы ложатся на код

Этот файл описывает техническую сторону — как спроектированные режимы реализуются в базе данных и коде платформы Nice Guy AI.

## Таблицы БД

### mode_templates — каталог всех режимов (shared)

```sql
CREATE TABLE mode_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,          -- 'exercises', 'ta_game_quiz', etc.
  name text NOT NULL,                -- 'Какие игры ты видишь?'
  description text,                  -- Описание для UI
  icon text DEFAULT 'chat',          -- Иконка (pen, book, chat, check, clock, etc.)
  chat_type text,                    -- 'exercise', 'author', 'free', 'ta_game_quiz', etc.
  route_suffix text NOT NULL,        -- '/chat', '/author-chat', '/ta/game-quiz', etc.
  is_chat_based boolean DEFAULT true,-- true для чат-режимов, false для тестов
  default_sort_order int DEFAULT 0
);
```

### program_modes — привязка режимов к программе

```sql
CREATE TABLE program_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid REFERENCES programs(id),
  mode_template_id uuid REFERENCES mode_templates(id),
  enabled boolean DEFAULT true,
  sort_order int DEFAULT 0,
  access_type text DEFAULT 'paid',   -- 'free' | 'paid'
  welcome_message text,              -- Welcome-сообщение для этого режима
  system_prompt text,                -- Системный промпт (если отличается от program-level)
  config jsonb DEFAULT '{}'
);
```

**Ключевой момент:** `system_prompt` в `program_modes` переопределяет program-level промпт. Это позволяет каждому режиму иметь свой промпт.

## Как system_prompt выбирается (lib/chat/prepare-context.ts)

```
1. Ищет program_modes.system_prompt по program_id + chat_type
2. Если найден → использует его
3. Если нет → fallback:
   - chatType === "author" → programs.author_chat_system_prompt
   - else → programs.system_prompt
```

## Шаблон SQL для новой книги

### 1. Создать mode_templates (если key ещё не существует)

```sql
INSERT INTO mode_templates (key, name, description, icon, chat_type, route_suffix, is_chat_based, default_sort_order)
VALUES
  ('BOOK_mode_key', 'Название режима', 'Описание', 'icon_name', 'BOOK_chat_type', '/BOOK/route', true, N)
ON CONFLICT (key) DO NOTHING;
```

### 2. Привязать к программе с промптами

```sql
INSERT INTO program_modes (program_id, mode_template_id, enabled, sort_order, access_type, welcome_message, system_prompt)
SELECT
  p.id,
  mt.id,
  true,
  N,                          -- sort_order
  'paid',                     -- или 'free'
  E'Welcome-сообщение...',   -- из этапа 3b
  E'Системный промпт...'     -- из этапа 4
FROM programs p
CROSS JOIN mode_templates mt
WHERE p.slug = 'BOOK_SLUG'
  AND mt.key = 'BOOK_mode_key';
```

### 3. Обновить features (если нужно)

```sql
UPDATE programs
SET features = features || '{"new_feature": true}'::jsonb
WHERE slug = 'BOOK_SLUG';
```

## Naming conventions

### mode_template.key

Формат: `{book_prefix}_{mode_type}`

Примеры:
- Гловер: `exercises`, `self_work`, `test_issp`, `author_chat`, `free_chat`
- Берн: `ta_game_quiz`, `ta_game_analysis`, `ta_ego_states`, `ta_life_script`, `ta_script_matrix`, `ta_game_exit`, `ta_permission`, `ta_diagnostic`

Префикс по книге:
- nice-guy → без префикса (первая книга, legacy)
- games-people-play → `ta_`
- 5-love-languages → `ll_`
- razgovorny-gipnoz → `hypno_`

### chat_type

Совпадает с `mode_template.key` для уникальных режимов. Для shared режимов:
- `free` — свободный чат (все книги)
- `author` — разговор с автором (все книги)
- `exercise` — упражнения (если есть)

### route_suffix

Формат: `/program/[slug]/(app)/{route_suffix}`

Должен быть уникальным внутри программы. Для новых режимов можно группировать:
- `/ta/game-quiz`, `/ta/script`, `/ta/matrix` — под общим префиксом

## Чеклист реализации (после утверждения промптов)

Задачи в порядке зависимостей. Задачи без зависимостей можно запускать параллельно через worktree-агентов.

| # | Задача | Тип | Зависит от | Параллельно? |
|---|--------|-----|-----------|-------------|
| 1 | SQL: INSERT mode_templates (новые ключи) | SQL (Supabase MCP) | — | — |
| 2 | SQL: INSERT/UPDATE program_modes (промпты, welcome, sort_order) | SQL (Supabase MCP) | 1 | — |
| 3 | Код: новые routes (page.tsx для каждого нового route_suffix) | Код | — | ✅ с 4, 5, 7 |
| 4 | Код: иконки в mode-icons.tsx (если нужны новые) | Код | — | ✅ с 3, 5, 7 |
| 5 | Код: prepare-context.ts (если нужна новая логика загрузки) | Код | — | ✅ с 3, 4, 7 |
| 6 | SQL: маппинг тем → режимы (program_themes.recommended_route) | SQL (Supabase MCP) | 1, 2 | — |
| 7 | Код: инжекция данных теста в контекст чата (если есть тест) | Код | — | ✅ с 3, 4, 5 |
| 8 | Проверка: npm run build + dev + runtime в браузере | Ручная | все | — |

**Код-задачи (3, 4, 5, 7)** можно запускать параллельно через `isolation: "worktree"` агентов.
**SQL-задачи (1, 2, 6)** выполнять в основном чате через Supabase MCP.

## Чеклист файлов при добавлении режимов

| Файл | Что сделать | Обязательно? |
|------|-------------|-------------|
| SQL миграция | INSERT mode_templates + program_modes | Да |
| `programs.features` | Обновить если нужны новые feature flags | По ситуации |
| `lib/chat/prepare-context.ts` | Проверить что chat_type обрабатывается | Только если новая логика |
| `middleware.ts` | Добавить исключение если route должен быть public | Только для public |
| `app/program/[slug]/(app)/` | Создать page.tsx если нужен новый route | Только если route новый |
| `types/modes.ts` | Добавить новые chat_type если нужно | По ситуации |
| `components/hub/mode-icons.tsx` | Добавить иконку + в iconMap | Только если icon нет в iconMap |

## program_themes → режимы

Если у программы есть Темы (program_themes), привязанные к шкалам теста — каждая тема должна вести в конкретный режим, а не только в свободный чат.

### Поле recommended_route

`program_themes.recommended_route` (text, nullable) — куда тема ведёт при клике. Если null — fallback на `/chat/new?topic=<key>`.

### SQL шаблон

```sql
UPDATE program_themes
SET recommended_route = '/ROUTE_SUFFIX'
WHERE program_id = (SELECT id FROM programs WHERE slug = 'BOOK_SLUG')
  AND key = 'THEME_KEY';
```

### Маппинг (заполнять на этапе 4, после таблицы режимов)

| Тема (key) | Шкала теста | → Режим (route_suffix) |
|-----------|------------|----------------------|
| ... | ... | ... |

---

## programs.landing_data — JSON-схема лендинга

`landing_data` — JSONB-поле в таблице `programs`. Содержит ВСЕ данные для лендинга программы. UI (компоненты в `components/landing/`) полностью data-driven — рендерит то, что есть в JSON.

**TypeScript-интерфейс** определён в `app/program/[slug]/page.tsx` → `interface LandingData`.

### Секции

| Секция | Тип | Обязательна? | Компонент | Описание |
|--------|-----|-------------|-----------|----------|
| `hero_tag` | string | ✅ | HeroSection | Мини-тег над заголовком, обычно «AI-тренажёр по книге» |
| `hero_title` | string | ✅ | HeroSection | H1, поддерживает `<em>` для акцента |
| `hero_subtitle` | string | ✅ | HeroSection | 1-2 предложения, value proposition |
| `hero_cta` | string | ✅ | HeroSection | Текст кнопки CTA |
| `hero_hint` | string | ✅ | HeroSection | Подпись под кнопкой (обычно «Без регистрации» или «Бесплатно, без регистрации») |
| `book` | object | ✅ | HeroSection | Данные книги (см. ниже) |
| `social_proof` | array | ✅ | SocialProof | 4 карточки `{icon, main, sub}` |
| `problem` | object | ✅ | PersonasSection | Блок «боль ЦА» (см. ниже) |
| `personas` | object | ✅ | PersonasSection | Сегменты ЦА `{label, title, items: [{headline, body}]}` |
| `outcomes` | object | ✅ | OutcomesSection | Блок «что получишь» (см. ниже) |
| `comparison` | object | ✅ | ComparisonSection | Таблица сравнения (см. ниже) |
| `how_it_works` | object | ✅ | HowItWorksSection | Шаги работы `{label, title, steps: [{type, title}], summary_text}` |
| `chat_header` | object | ✅ | ChatSection | CTA для демо-чата `{title, subtitle}` |
| `price` | object | ✅ | — | Цены `{trial_text, price_text, anchor_text}` |
| `author` | object | ⚡ | AuthorSection | Секция автора, если `features.author_chat=true` |
| `test` | object | ⚡ | TestSection | Секция теста, если `features.test=true` |

### Детали вложенных объектов

**book:**
```json
{
  "cover_url": "https://cdn.litres.ru/pub/c/cover_415/XXXXX.webp",
  "alt": "Название книги — Автор",
  "author_top": "Имя Автора (рус)",
  "title": "Название книги (рус)",
  "subtitle": "Original Title (eng)",
  "author_bottom": "Author Name, Credentials"
}
```

> **cover_url**: ВСЕГДА брать с Литрес (cdn.litres.ru). Найти книгу на litres.ru → ПКМ на обложку → «Копировать адрес изображения». Формат: `https://cdn.litres.ru/pub/c/cover_415/{id}.webp` (или `.jpg`). Размер 415px — оптимальный для лендинга.

**author** (секция автора книги):
```json
{
  "photo_url": "https://...",
  "name": "Имя Автора",
  "credentials": "Краткая биография (1-2 предложения)",
  "quote": "Цитата автора, которая отражает суть книги"
}
```

> **photo_url**: Найти фото автора в интернете. Приоритет источников: (1) Wikipedia Commons — лицензионно чисто, (2) официальный сайт автора, (3) издательство. Формат: прямая ссылка на изображение, не на страницу. Проверить что ссылка работает.

**problem:**
```json
{
  "label": "Проблема",
  "title": "Текст с <em>акцентом</em>",
  "lead": "1-2 предложения — контекст проблемы",
  "pain_cards": [
    { "icon": "🔄", "title": "Цитата боли", "text": "Раскрытие в 1-2 предложения" }
  ]
}
```

**outcomes:**
```json
{
  "label": "Решение",
  "title": "AI, который <em>глагол</em> результат",
  "subtitle": "Позиционирование — что это и что НЕ это",
  "items": [
    { "icon": "🎯", "title": "Конкретный результат", "description": "Как именно AI это делает" }
  ]
}
```

**comparison:**
```json
{
  "label": "Сравнение",
  "title": "Как <em>работать</em> с книгой?",
  "subtitle": "Три способа применить методику",
  "columns": [
    { "icon": "📕", "name": "Книга", "role": "Теория" },
    { "icon": "🧠", "name": "Профессионал", "role": "Очный специалист" },
    { "icon": "🤖", "name": "AI-тренажёр", "role": "Ежедневная практика", "highlight": true }
  ],
  "rows": [
    { "param": "Критерий", "values": ["Книга", "Проф", "AI"], "dim": [0] }
  ],
  "conclusion": "Позиционирование AI как <em>моста</em>."
}
```

**test** (только если `features.test=true`):
```json
{
  "emoji": "📊",
  "title": "Название теста",
  "description": "Краткое описание",
  "time_label": "~10 минут",
  "questions_label": "35 вопросов",
  "cta_text": "Пройти тест",
  "cta_href": "/program/SLUG/test"
}
```

### Смежные поля в programs (НЕ внутри landing_data)

Эти поля — часть лендинга, но хранятся отдельно:

| Поле | Описание | Пример |
|------|----------|--------|
| `anonymous_system_prompt` | Промпт для демо-чата на лендинге | Короткий, зацепить интерес |
| `anonymous_quick_replies` | Стартовые кнопки демо-чата | `["Вопрос 1?", "Вопрос 2?"]` |
| `free_chat_welcome` | Welcome-сообщение свободного чата | Используется как fallback на ленде |
| `meta_title` | SEO title | `"AI-тренажёр: Название — Автор"` |
| `meta_description` | SEO description | 1-2 предложения |

### Реестр обложек и фото авторов

| Книга | cover_url | author photo_url |
|-------|-----------|-----------------|
| Гловер «Славные парни» | (в seed-landing-data.sql, без cover_url) | — |
| Берн «Игры» | `cdn.litres.ru/pub/c/cover_415/73470133.webp` | `upload.wikimedia.org/wikipedia/ru/6/67/Erik_Bern.jpg` |
| Чепмен «5 языков» | `cdn.litres.ru/pub/c/cover_415/161177.jpg` | `upload.wikimedia.org/.../Gary_D._Chapman.jpg` |
| Бакиров «Разговорный гипноз» | `cdn.litres.ru/pub/c/cover_415/70789098.webp` | (найти) |

---

## test_configs — таблица тестов

Тесты хранятся в таблице `test_configs`. Один INSERT = один полностью работающий тест. UI, скоринг и интерпретация адаптируются автоматически.

### Схема таблицы

```sql
CREATE TABLE test_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id),
  slug text NOT NULL UNIQUE,              -- 'issp', 'ta_ego_states', etc.
  title text NOT NULL,                    -- 'Тест ИССП'
  short_title text,                       -- 'ИССП' (для UI)
  description text,                       -- Описание на лендинге

  -- Вопросы (JSONB-массив)
  questions jsonb NOT NULL,               -- [{q, scale, type, text}]
  total_questions int GENERATED ALWAYS AS (jsonb_array_length(questions)) STORED,

  -- Шкалы (JSONB-массив)
  scales jsonb NOT NULL,                  -- [{key, name, order, exercises?, radar_label?}]

  -- Скоринг
  scoring jsonb NOT NULL DEFAULT '{}',

  -- UI-конфиг
  ui_config jsonb NOT NULL DEFAULT '{}',

  -- Промпты
  interpretation_prompt text,             -- Промпт для AI-интерпретации (Gemini Pro)
  mini_analysis_prompt_template text,     -- Шаблон мини-анализа ({{questionText}})

  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Структура JSONB-полей

**questions** — массив вопросов:
```json
[
  {"q": 1, "scale": "nice_guy", "type": "direct", "text": "Я часто ставлю потребности других выше своих"},
  {"q": 2, "scale": "nice_guy", "type": "reverse", "text": "Я легко говорю «нет» другим людям"}
]
```
- `q` — порядковый номер (1-based)
- `scale` — ключ шкалы (должен совпадать с `scales[].key`)
- `type` — `"direct"` (высокий балл = высокий показатель) или `"reverse"` (инвертируется)
- `text` — текст вопроса (русский)

**scales** — массив шкал:
```json
[
  {
    "key": "nice_guy",
    "name": "Синдром славного парня",
    "order": 0,
    "exercises": [1, 5, 12],
    "radar_label": ["Синдром", "славного парня"]
  }
]
```
- `key` — уникальный идентификатор (с префиксом книги: `ta_`, `ll_`, etc.)
- `name` — человеческое название
- `order` — порядок на радар-диаграмме (0-based)
- `exercises` — номера упражнений, связанных со шкалой (опционально)
- `radar_label` — как подписывать на радаре (массив строк для переноса)

**scoring:**
```json
{
  "answer_range": [1, 5],
  "score_direction": "lower_is_better",
  "level_thresholds": [25, 50, 75],
  "level_labels": ["Низкий уровень", "Умеренный уровень", "Выраженный уровень", "Высокий уровень"]
}
```
- `answer_range` — диапазон ответов по Ликерту (обычно [1, 5])
- `score_direction` — `"lower_is_better"` (ISSP: низкий = здоровый) или `"higher_is_better"`
- `level_thresholds` — границы уровней в процентах (N порогов = N+1 уровень)
- `level_labels` — названия уровней (от низкого к высокому)

**ui_config:**
```json
{
  "questions_per_block": 5,
  "auth_wall_question": 14,
  "welcome_stats": [
    {"num": "18", "label": "вопросов"},
    {"num": "4", "label": "шкалы"},
    {"num": "~5", "label": "минут"}
  ],
  "block_insights": [
    "Хороший старт! Уже видны первые паттерны.",
    "Интересная картина. Продолжаем.",
    "Последний рывок — почти готово!"
  ],
  "quick_answer_labels": ["Совсем нет", "Скорее нет", "Иногда", "Скорее да", "Полностью"],
  "radar_labels": {
    "scale_key": ["Строка 1", "Строка 2"]
  },
  "analyzing_stages": [
    {"title": "Анализируем ответы", "substeps": ["Обрабатываем паттерны", "Считаем баллы"]},
    {"title": "Готовим интерпретацию", "substeps": ["Формируем профиль", "Подбираем рекомендации"]}
  ],
  "timeframe_text": "за последние 6 месяцев"
}
```
- `questions_per_block` — вопросов в блоке (после каждого — переход/insight)
- `auth_wall_question` — на каком вопросе показать auth wall (0-based index, `null` = нет auth wall)
- `welcome_stats` — статистика на экране приветствия
- `block_insights` — мотивирующие фразы между блоками
- `quick_answer_labels` — подписи под шкалой Ликерта (от 1 до max)
- `analyzing_stages` — этапы анимации «анализируем» (опционально)
- `timeframe_text` — подсказка «за какой период оценивать» (опционально)

### SQL-шаблон создания теста

```sql
INSERT INTO test_configs (
  program_id, slug, title, short_title, description,
  questions, scales, scoring, ui_config,
  interpretation_prompt, mini_analysis_prompt_template
) VALUES (
  (SELECT id FROM programs WHERE slug = 'BOOK_SLUG'),
  'TEST_SLUG',
  'Название теста',
  'Короткое название',
  'Описание для лендинга',

  -- questions (JSONB массив)
  '[
    {"q":1, "scale":"scale_key", "type":"direct", "text":"Текст вопроса 1"},
    {"q":2, "scale":"scale_key", "type":"reverse", "text":"Текст вопроса 2"}
  ]'::jsonb,

  -- scales (JSONB массив)
  '[
    {"key":"scale_key", "name":"Название шкалы", "order":0, "radar_label":["Строка 1","Строка 2"]}
  ]'::jsonb,

  -- scoring
  '{"answer_range":[1,5], "score_direction":"lower_is_better", "level_thresholds":[25,50,75], "level_labels":["Низкий","Умеренный","Выраженный","Высокий"]}'::jsonb,

  -- ui_config
  '{"questions_per_block":5, "auth_wall_question":null, "welcome_stats":[{"num":"N","label":"вопросов"},{"num":"K","label":"шкал"},{"num":"~M","label":"минут"}], "block_insights":["Insight 1","Insight 2"], "quick_answer_labels":["Совсем нет","Скорее нет","Иногда","Скорее да","Полностью"]}'::jsonb,

  -- interpretation_prompt
  E'Ты — психолог, специализирующийся на [тема книги].\n\nТвоя задача — написать персонализированную интерпретацию результатов теста.\n\n...',

  -- mini_analysis_prompt_template ({{questionText}} будет заменён)
  E'Вопрос: «{{questionText}}»\nОцени ответ пользователя по шкале от 1 до 5.\n...'
);
```

### После создания теста — чеклист

| # | Задача | Описание |
|---|--------|----------|
| 1 | Обновить `programs.features` | Добавить `"test": true` если ещё нет |
| 2 | Обновить `landing_data.test` | Секция теста на лендинге (emoji, title, description, cta_href) |
| 3 | Создать URL роут | `app/program/[slug]/(app)/test/[testSlug]/page.tsx` (если slug ≠ issp) |
| 4 | Проверить middleware | Route `/program/*/test/*` должен быть public |
| 5 | Маппинг шкалы → режим | `scales[].exercises` указывает на режимы для рекомендаций |

### Реестр тестов

| Книга | test slug | Вопросов | Шкал | Auth wall | Статус |
|-------|-----------|----------|------|-----------|--------|
| Гловер «Славные парни» | issp | 35 | 7 | Q34 | ✅ Работает |
| Берн «Игры» | — | — | — | — | ❌ Нет (ta_diagnostic = чат-режим) |
| Чепмен «5 языков» | — | — | — | — | ❌ Нет |

---

## Доступные иконки (mode-icons.tsx)

Перед назначением icon в таблице маппинга — проверь что иконка существует в `components/hub/mode-icons.tsx` → `iconMap`.

**Существующие:** pen, clock, check, book, chat, target, search, message-circle, book-open, map, drama, sparkles, heart, users, shield

Если нужной иконки нет → добавь SVG-компонент + запись в iconMap. Формат: Feather/Lucide-style (24x24 viewBox, stroke, no fill).

---

## Таблица маппинга (заполнять на этапе 4)

Пример для Берна:

| Режим | key | chat_type | route_suffix | icon | sort_order | access |
|-------|-----|-----------|-------------|------|------------|--------|
| Диагностика ТА | ta_diagnostic | ta_diagnostic | /ta/diagnostic | check | 1 | free |
| Какие игры видишь? | ta_game_quiz | ta_game_quiz | /ta/game-quiz | target | 2 | paid |
| Разбор твоей игры | ta_game_analysis | ta_game_analysis | /ta/game-analysis | search | 3 | paid |
| Кто сейчас говорит? | ta_ego_states | ta_ego_states | /ta/ego-states | chat | 4 | paid |
| Твой сценарий | ta_life_script | ta_life_script | /ta/life-script | book | 5 | paid |
| Сценарная матрица | ta_script_matrix | ta_script_matrix | /ta/script-matrix | map | 6 | paid |
| Выход из игры | ta_game_exit | ta_game_exit | /ta/game-exit | theater | 7 | paid |
| Разрешение | ta_permission | ta_permission | /ta/permission | sparkle | 8 | paid |
| Свободный чат | free_chat | free | /chat | chat | 9 | free |
| Разговор с Берном | author_chat | author | /author-chat | book | 10 | paid |
