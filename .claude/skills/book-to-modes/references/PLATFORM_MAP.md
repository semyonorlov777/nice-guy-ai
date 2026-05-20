# Platform Map: Как режимы ложатся на код

Этот файл описывает техническую сторону — как спроектированные режимы реализуются в базе данных и коде платформы Книжный Спарринг.

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
  welcome_message text,              -- Welcome-сообщение (первое сообщение в истории чата)
  system_prompt text,                -- Системный промпт (если отличается от program-level)
  config jsonb DEFAULT '{}',
  -- Welcome-поля для NewChatScreen (ВСЕ обязательны для корректного отображения):
  welcome_mode_label text,           -- Лейбл типа режима ('Анализ', 'Воркшоп', 'Свободный чат')
  welcome_title text,                -- Заголовок ('Деконструктор страхов', 'Спросить Гловера')
  welcome_subtitle text,             -- Подзаголовок (описание 1 строка)
  welcome_ai_message text,           -- Система на welcome-экране (ПЛЕЙН-ТЕКСТ, без markdown — рендерится без ReactMarkdown в NewChatScreen)
  welcome_replies jsonb DEFAULT '[]',-- Suggested replies: [{"text": "...", "type": "normal"}] — СТРОГО объекты, НЕ строки! Последний reply = {"type": "exit"} для safe-exit визуала
  welcome_system_context text,       -- Контекст для системного промпта (для тем)
  color_class text DEFAULT 'accent', -- CSS-класс цвета ('accent', 'green')
  badge text                         -- Бейдж на карточке ('Бесплатно', 'Новое')
);
```

**КРИТИЧНО:** Без `welcome_mode_label`, `welcome_title`, `welcome_ai_message` и `welcome_replies` — welcome-экран режима будет пустым (нет ИИ-сообщения, нет кнопок suggested replies). Это касается **ВСЕХ** режимов, включая `free_chat` и `author_chat`.

**welcome_ai_message антипаттерны (см. [chat-message-formatting runbook](../../../../docs/runbooks/chat-message-formatting.md)):**
- НЕ начинай с `эмодзи **Название режима**\n\n` — `welcome_title` уже рендерится карточкой выше; получится дубликат.
- НЕ используй markdown (`**bold**`, `#`, `- list`) — это поле рендерится plain-текстом, звёздочки будут видны буквально.
- Для буллетов — символ `•`, не markdown `-`. Между абзацами — ОБЯЗАТЕЛЬНО `\n\n` (одиночный `\n` = одна строка, абзацы склеются; `.nc-ai-text` имеет `white-space: pre-line`, но split по параграфам требует именно `\n\n`).
- Формат `[welcome_message]`, идущий в ChatWindow для 100-notes / nice-guy legacy tool modes, — наоборот рендерится через ReactMarkdown, там markdown ок. Но **дубликат title в начале всё равно запрещён** (ChatHeader показывает mode name).

**system_prompt каждого режима** содержит блок `### Quick replies — ФОРМАТ` из REFERENCE.md §5 — **при вставке в конкретный режим замени 3 плейсхолдера `«Вариант 1»/«Вариант 2»/«Мне сложно сформулировать»` на тематически-конкретные reply** под домен режима от первого лица пользователя. Literal `«Вариант 1»` Gemini копирует дословно → парсер получает plain-текст без «ёлочек» → кнопок нет. Детали и примеры замен — REFERENCE.md §5.

Также блок Quick replies обязан содержать **оба counterexample**:
- `НЕПРАВИЛЬНО (все на одной строке): «В1» «В2» «В3»` — против склейки через пробел
- `НЕПРАВИЛЬНО: <текст>` — против угловых скобок (Gemini временами выдаёт `<вариант>` если нет явного запрета; см. коммит `d2067ba` `fix-all-books-angle-bracket-counterexample-2026-04-25.sql` — пришлось патчить все 6 книг разом)

Линтер `npm run check:chats` ловит оба case-а.

**programs-level поля (`programs.system_prompt`, `author_chat_system_prompt`, `anonymous_system_prompt`, `free_chat_welcome`, `author_chat_welcome`):** ОБЯЗАТЕЛЬНО содержат блок `### Quick replies — ФОРМАТ` из REFERENCE.md §5 + стартовые «ёлочки» в конце welcome. Правила НЕ наследуются между уровнями — если только в `programs.system_prompt`, то author_chat и anonymous идут без кнопок.

**Ключевой момент:** `system_prompt` в `program_modes` переопределяет program-level промпт. Это позволяет каждому режиму иметь свой промпт.

## Как system_prompt выбирается (lib/chat/prepare-context.ts)

```
1. Ищет program_modes.system_prompt по program_id + chat_type
2. Если найден → использует его
3. Если нет → fallback:
   - chatType === "author" → programs.author_chat_system_prompt
   - else → programs.system_prompt
```

### Что подмешивается к выбранному system_prompt (порядок)

Поверх выбранного промпта runtime **префиксует** блок персонализации и **дописывает** контекст. Если автор seed не понимает порядок — может задублировать данные или потерять их.

```
[PersonalizationContext]  ← блок «КТО ПЕРЕД ТОБОЙ» + soft-onboarding (из user_profile_responses)
---
[selected system_prompt]
---
[Portrait ai_context]     ← КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ (из predыдущих упражнений)
---
[Test scores JSON]        ← если тест пройден
---
[Calibration context]     ← для книг с pishi_calibration / аналогичными
---
[Topic context]           ← КОНТЕКСТ ТЕМЫ (для тематических чатов)
---
[QR-reminder]             ← напоминание про формат «ёлочек» (recency)
```

Все блоки независимы — могут быть все, может не быть ни одного. Анкета пустая → нет блока КТО ПЕРЕД ТОБОЙ. Портрет не собран → нет блока контекста пользователя. Это работает по design'у.

## Анкета пользователя (user_profile_responses)

User-level опросник из 3 вопросов, общий для всех книг (per-book вопросы каталогизируются в `lib/anketa/questions.ts`). Заполняется при первом заходе в программу. Ответы используются в **четырёх** местах одновременно — учти это при добавлении анкеты к новой книге.

### Что нужно знать автору seed

| Где используется | Как работает | Что нужно от seed/конфига |
|---|---|---|
| **system_prompt каждого чата** | `buildPersonalizationContext` префиксует блок «КТО ПЕРЕД ТОБОЙ» к выбранному промпту. Test-режимы (chat_type содержит `test`/`exam`/`archetype-test`) пропускаются — там строгий скрипт скоринга. | Ничего. Работает автоматически если slug книги добавлен в `AnketaProgramSlug`. |
| **Портрет пользователя (Gemini Pro)** | `lib/portrait-updater.ts` подмешивает блок «АНКЕТА ПОЛЬЗОВАТЕЛЯ» в userMessage перед историей чата. AI-аналитик видит запрос пользователя при разборе диалога. | Ничего. Работает автоматически. |
| **Темы хаба (фильтрация)** | `getRelevantThemeKeys` (lib/anketa/theme-relevance.ts) вызывает Gemini Flash при первом заходе на хаб с анкетой → возвращает 2-4 релевантные темы → результат кешируется в `anketa_theme_relevance`. Кеш инвалидируется при сохранении новых ответов. | Минимум 4 темы в `program_themes` (иначе фильтровать нечего). |
| **Welcome AI на хабе** | `hub/page.tsx` выбирает welcome по состоянию (5 состояний с анкетой) и подставляет плейсхолдеры `{problem}` / `{context_intent}` (обрезка 60 символов с многоточием). | Ключи `anketa_only` и `anketa_and_test` в `programs.hub_messages` — см. шаблон ниже. |

### Схема таблицы

```
user_profile_responses
├── user_id              UUID (FK auth.users, ON DELETE CASCADE)
├── question_id          TEXT (например: context_intent, problem, need_payoff, implication)
├── answer_text          TEXT (≤4000 символов после save)
├── version              INT (per (user_id, question_id), монотонная; getFacts берёт max)
├── source               TEXT ('anketa' | 'soft_onboarding' | 'manual_edit')
└── confirmed_at         TIMESTAMPTZ (зарезервирован для cross-book confirmation, пока не используется)

anketa_theme_relevance (кеш AI-фильтра)
├── user_id              UUID (PK part 1)
├── program_id           UUID (PK part 2)
├── relevant_keys        TEXT[] (массив ключей program_themes)
└── computed_at          TIMESTAMPTZ
```

### Каталог вопросов (lib/anketa/questions.ts)

```typescript
export type AnketaProgramSlug = "nice-guy" | "<новая-книга>";

export const ANKETA_QUESTIONS: Record<AnketaProgramSlug, AnketaQuestion[]> = {
  "nice-guy": [ /* 3 вопроса для Гловера */ ],
  "<новая-книга>": [ /* 3 вопроса для новой книги */ ],
};
```

Стандарт — 3 вопроса по SPIN-структуре. Подробнее — [SKILL.md → Этап 2.5](../SKILL.md).

`IDENTITY_QUESTION_IDS` в `lib/personalization.ts` — белый список question_id. Если для новой книги хочешь использовать НЕ-стандартный вопрос — расширь массив там. Сейчас допустимы: `context_intent`, `problem`, `implication`, `need_payoff`.

### Шаблон hub_messages с плейсхолдерами анкеты

При добавлении анкеты к книге **обязательно** обнови `programs.hub_messages` — иначе пользователи с заполненной анкетой попадут на старый welcome (`returning_test` или `returning_notest`), и анкета на хаб никак не повлияет.

```sql
UPDATE programs SET hub_messages = COALESCE(hub_messages, '{}'::jsonb) || jsonb_build_object(
  'anketa_only',
    'Помню что ты пришёл с запросом: <strong>{problem}</strong>. Самое близкое в программе — <strong>{theme1}</strong>. Пройди тест (7 минут) — подскажу точнее.',
  'anketa_and_test',
    'Помню твой запрос — <strong>{problem}</strong>. По тесту сейчас самое горячее — <strong>{theme1}</strong>. Начнём оттуда?'
) WHERE slug = 'BOOK_SLUG';
```

Эти 2 ключа добавляются к существующим 3 (`first`, `returning_test`, `returning_notest`) → итого 5 состояний.

### Поддерживаемые плейсхолдеры в hub_messages

| Плейсхолдер | Источник | Поведение |
|---|---|---|
| `{theme1}` / `{theme2}` | Топ-2 темы после фильтра анкетой + сортировки тестом | Подставляется `title.toLowerCase()`. Если тем меньше — fallback на `returning_notest`. |
| `{problem}` | `facts.problem` из анкеты | Обрезка 60 символов по последнему пробелу + `…`. |
| `{context_intent}` | `facts.context_intent` из анкеты | Тот же truncate. |

Если в строке остался неразрешённый плейсхолдер (например, `{problem}` без анкеты) — он автоматически стрипается + fallback на `returning_notest`.

### Состояния хаба (полный список)

```
hasAnketa = есть ≥1 ответ в user_profile_responses
hasTestResult = есть test_results.status='ready'
isFirstVisit = chatCount=0 && !hasTestResult && !hasAnketa

if isFirstVisit → "first"
elif hasAnketa && hasTestResult → "anketa-and-test"
elif hasAnketa → "anketa-only"
elif hasTestResult → "returning-test"
else → "returning-notest"
```

Можно проверить вручную через `?hub_state=anketa-only` (и другие) на dev-сервере.

### Когда НЕ делать анкету для книги

- Marketing/копирайтинг-книги — у пользователя нет «личной боли» которую можно вынести в SPIN-вопросы.
- Книга с одной центральной темой (нечего фильтровать).
- Книга с собственным калибровочным чат-режимом (Ильяхов `pishi_calibration`) — он уже играет роль анкеты, плюс ещё анкета = дубль.

Определитель из 4 критериев — [SKILL.md → Этап 2.5](../SKILL.md#когда-применять).

### Линтер

Для пилота (май 2026) `npm run check:chats` **не** проверяет анкету — правила добавятся когда анкета будет на 2-3 книгах. До этого ручная сверка по чеклисту из SKILL.md.

## Шаблон SQL для новой книги

### 1. Создать mode_templates (если key ещё не существует)

```sql
INSERT INTO mode_templates (key, name, description, icon, chat_type, route_suffix, is_chat_based, default_sort_order)
VALUES
  ('BOOK_mode_key', 'Название режима', 'Описание', 'icon_name', 'BOOK_chat_type', '/BOOK/route', true, N)
ON CONFLICT (key) DO NOTHING;
```

### 2. Привязать к программе с промптами и welcome-данными

```sql
INSERT INTO program_modes (
  program_id, mode_template_id, enabled, sort_order, access_type,
  welcome_message, system_prompt,
  welcome_mode_label, welcome_title, welcome_subtitle,
  welcome_ai_message, welcome_replies, color_class, badge
)
SELECT
  p.id,
  mt.id,
  true,
  N,                              -- sort_order
  'paid',                         -- или 'free'
  E'Welcome-сообщение (история)',  -- первое сообщение в чате (из этапа 3b)
  E'Системный промпт...',         -- из этапа 4
  'Анализ',                       -- welcome_mode_label (из этапа 3)
  'Название режима',              -- welcome_title (из этапа 3)
  'Описание в 1 строку',          -- welcome_subtitle
  E'Система на welcome-экране...', -- welcome_ai_message (markdown, из этапа 3)
  '[{"text": "Кнопка 1", "type": "normal"}, {"text": "Кнопка 2", "type": "normal"}]'::jsonb,  -- ⚠️ ОБЯЗАТЕЛЬНО объекты {text, type}, НЕ строки ["текст"] — иначе кнопки будут пустыми!
  'accent',                       -- color_class ('accent' | 'green')
  NULL                            -- badge ('Бесплатно', 'Новое', или NULL)
FROM programs p
CROSS JOIN mode_templates mt
WHERE p.slug = 'BOOK_SLUG'
  AND mt.key = 'BOOK_mode_key';
```

**ВАЖНО: free_chat и author_chat тоже нуждаются в welcome-данных!**

```sql
-- Шаблон для free_chat:
-- welcome_mode_label = 'Свободный чат'
-- welcome_title = 'Просто поговорить'
-- welcome_subtitle = 'Любой вопрос по [тема книги]'
-- welcome_ai_message = 'Привет! Спроси о чём угодно — я отвечу через призму [книга]...'
-- welcome_replies = [{"text": "Стартовый вопрос 1", "type": "normal"}, ...] — ОБЪЕКТЫ, не строки!

-- Шаблон для author_chat:
-- welcome_mode_label = 'Разговор с автором'
-- welcome_title = 'Спросить [Фамилия]'
-- welcome_subtitle = 'AI в стиле автора книги'
-- welcome_ai_message = 'Привет, я [Имя Фамилия]... [1-2 фразы в стиле автора]'
-- welcome_replies = [{"text": "Вопрос к автору", "type": "normal"}, ...] — ОБЪЕКТЫ, не строки!
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
| SQL миграция | INSERT mode_templates + program_modes **со всеми welcome_* полями** | Да |
| SQL: free_chat/author_chat | Заполнить welcome_* поля для free_chat и author_chat | **Да** — без них welcome-экран пустой |
| `programs.features` | Обновить если нужны новые feature flags | По ситуации |
| `lib/chat/prepare-context.ts` | Проверить что chat_type обрабатывается | Только если новая логика |
| `middleware.ts` | Добавить исключение если route должен быть public | Только для public |
| `app/program/[slug]/(app)/` | Создать page.tsx если нужен новый route | Только если route новый |
| `types/modes.ts` | Добавить новые chat_type если нужно | По ситуации |
| `components/hub/mode-icons.tsx` | Добавить иконку + в iconMap | Только если icon нет в iconMap |

### Верификация welcome-данных после INSERT

После выполнения SQL проверь что ВСЕ режимы имеют welcome-данные + корректный формат QUICK REPLIES в system_prompt:

```sql
-- Все колонки должны быть TRUE для каждого режима
SELECT mt.key, pm.welcome_title,
  pm.welcome_ai_message IS NOT NULL                                        AS has_msg,
  pm.welcome_replies::text != '[]'                                          AS has_replies,
  -- Welcome_ai_message: если есть ≥2 строки, должны быть \n\n между ними
  (pm.welcome_ai_message !~ '\n[^\n]' OR pm.welcome_ai_message ~ '\n\n')    AS has_paragraph_breaks,
  -- system_prompt содержит усиленный Quick replies блок
  pm.system_prompt LIKE '%НИКОГДА не склеивай%'                             AS has_niggda_rule,
  pm.system_prompt LIKE '%НЕПРАВИЛЬНО (все на одной строке)%'               AS has_counter_example,
  -- system_prompt НЕ содержит абстрактный placeholder «Вариант 1» как позитивный пример
  -- (допустим только внутри контрпримера НЕПРАВИЛЬНО)
  (pm.system_prompt NOT LIKE E'%\n«Вариант 1»\n«Вариант 2»%')               AS placeholders_replaced
FROM program_modes pm
JOIN mode_templates mt ON mt.id = pm.mode_template_id
WHERE pm.program_id = (SELECT id FROM programs WHERE slug = 'BOOK_SLUG');

-- Проверка landing_data: photo_url — ЛОКАЛЬНЫЙ путь
SELECT slug,
  landing_data->'author'->>'photo_url' AS photo_url,
  (landing_data->'author'->>'photo_url') LIKE '/authors/%' AS is_local_photo
FROM programs
WHERE slug = 'BOOK_SLUG';
```

Если `is_local_photo = false` — перед деплоем скачай фото в `public/authors/{slug}.jpg` и обнови `landing_data.author.photo_url` через `jsonb_set`, иначе фото может не загрузиться из-за CSP.

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
| `hero_tag` | string | ✅ | HeroSection | Мини-тег над заголовком, всегда «Книжный Спарринг» (бренд платформы — см. [brand-glossary.md](../../../../docs/brand-glossary.md)) |
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
| `price` | object | ✅ | — | Длинное описание цен на лендинге программы `{trial_text, price_text, anchor_text}` |
| `pricing` | object | ⚡ | ProgramCard (`/programs`, главная) | Источник правды для бейджа в каталоге. Для платных: `{is_paid: true, price_rub: 490, price_label?: "490 ₽"}`. Для бесплатных: `{is_paid: false}` или поле отсутствует (UI считает бесплатной). НЕ путать с `price` выше — то для лендинга, это для карточки в каталоге. |
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

> **photo_url** — **ВСЕГДА локальный путь** `/authors/{slug}.jpg`, где `{slug}` = lowercased фамилия автора (напр. `bradberry`, `glover`, `chapman`, `bern`, `bakirov`).
>
> Шаги перед seed:
> 1. Найти исходник в интернете: приоритет Wikipedia Commons → офф. сайт автора → издательство.
> 2. Скачать в `public/authors/{slug}.jpg` (или `.webp` — родной формат).
> 3. В `landing_data.author.photo_url` прописать `/authors/{slug}.jpg`.
>
> **Внешние URL запрещены.** Каждый новый домен требует правки `img-src` в [next.config.ts](../../../../next.config.ts) (иначе фото не грузится на проде из-за CSP). Локальный путь не ломается при смене издательского URL и не зависит от внешнего CDN.
>
> Прецедент: eq-2-0 Бредберри с `mann-ivanov-ferber.ru` не грузился из-за CSP (`mann-ivanov-ferber.ru` отсутствовал в allowlist). Решение — скачать локально.

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
    { "icon": "🤖", "name": "Книжный Спарринг", "role": "Практика", "highlight": true }
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
| `category` | Высокоуровневый жанр книги (text, не enum — дёшево добавлять новые) | `'psychology'` (default) или `'marketing'` |
| `anonymous_system_prompt` | Промпт для демо-чата на лендинге | Короткий, зацепить интерес |
| `anonymous_quick_replies` | Стартовые кнопки демо-чата | `["Вопрос 1?", "Вопрос 2?"]` |
| `free_chat_welcome` | Welcome-сообщение свободного чата | Используется как fallback на ленде |
| `meta_title` | SEO title | `"Книжный Спарринг: Название — Автор"` |
| `meta_description` | SEO description | 1-2 предложения |

### landing_data.main_concepts — обязательный список концептов книги (≥5)

Используется в шаблоне `anonymous_system_prompt` (блок Д «СТРУКТУРА ПЕРВОГО ОТВЕТА») для требования «назови концепт по имени». Без него демо-чат отвечает общими словами.

```json
{
  "main_concepts": [
    "Карта любви",
    "Нежность и восхищение",
    "Поворот к партнёру",
    "Принятие влияния",
    "Мягкий старт",
    "Скрытая мечта",
    "Общий смысл"
  ]
}
```

**Правила:**
- 5-7 элементов (меньше — концепт-словарь слабый, больше — Gemini забывает).
- Каждый — имя собственное концепта (как в книге автора), не общее слово («любовь», «общение» не подходят).
- Имя на русском, как пользователь увидит в чате.
- При seed подставляются в `anonymous_system_prompt` как `«{name1} / {name2} / {name3} / ...»` явным списком.

**Линтер `npm run check:chats`** проверяет: `landing_data.main_concepts` существует, это массив из ≥5 строк, и для каждого концепта проверяет что он встречается в `anonymous_system_prompt` (по подстроке). Отсутствие — warning.

**Прецедент:** seven-principles — без явного списка концептов AI на демо-чате отвечал «бывает, многие пары через это проходят...» вместо «Мягкий старт у Готтмана говорит, что...».

### Реестр обложек и фото авторов

Обложки — `cdn.litres.ru` (разрешён в CSP, см. next.config.ts).
Фото авторов — **ВСЕГДА локально** в `/public/authors/{slug}.jpg` (см. правило photo_url выше).

| Книга | cover_url | author photo_url |
|-------|-----------|-----------------|
| Гловер «Славные парни» | (в seed-landing-data.sql) | `/authors/glover.jpg` |
| Берн «Игры» | `cdn.litres.ru/pub/c/cover_415/73470133.webp` | `/authors/bern.jpg` |
| Чепмен «5 языков» | `cdn.litres.ru/pub/c/cover_415/161177.jpg` | `/authors/chapman.jpg` |
| Бакиров «Разговорный гипноз» | `cdn.litres.ru/pub/c/cover_415/70789098.webp` | `/authors/bakirov.jpg` |
| 100 заметок о себе | (в seed-landing-data.sql) | `/authors/100-notes.jpg` |
| Бредберри «Эмоц. интеллект 2.0» | `cdn.litres.ru/pub/c/cover_415/…` | `/authors/bradberry.jpg` |

Если новая книга — перед seed: скачать фото в `public/authors/{slug}.jpg`, прописать `/authors/{slug}.jpg` в landing_data, добавить строку в эту таблицу.

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
  interpretation_prompt text,             -- Промпт для ИИ-интерпретации (Gemini Pro)
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
  "auth_wall_question": 19,
  "welcome_title": "Название теста<br /><span>вторая строка</span>",
  "welcome_subtitle": "Подзаголовок (необязательно)",
  "welcome_description": "Описание теста на экране приветствия",
  "welcome_badge": "Диагностика",
  "welcome_cta": "Начать тест",
  "welcome_meta": "Результаты конфиденциальны. Правильных ответов нет.",
  "welcome_stats": [
    {"num": "25", "label": "вопросов"},
    {"num": "5", "label": "шкал"},
    {"num": "~5", "label": "минут"}
  ],
  "block_insights": [
    "Insight после блока 1",
    "Insight после блока 2"
  ],
  "quick_answer_labels": ["Совсем нет", "Скорее нет", "Иногда", "Скорее да", "Полностью"],
  "radar_labels": {
    "scale_key": ["Строка 1", "Строка 2"]
  },
  "analyzing_stages": [
    {"title": "Анализируем ответы", "substeps": ["Обрабатываем паттерны", "Считаем баллы"]},
    {"title": "Готовим интерпретацию", "substeps": ["Формируем профиль", "Подбираем рекомендации"]}
  ],
  "timeframe_text": "Вспомни последние 2–4 недели"
}
```
- `questions_per_block` — вопросов в блоке (после каждого — переход/insight)
- `auth_wall_question` — на каком вопросе показать auth wall (0-based index, `null` = нет auth wall). Формула: `Math.floor(total_questions * 0.8) - 1`
- **welcome_title** — заголовок WelcomeScreen (поддерживает HTML: `<br />`, `<span>`). Fallback: `testConfig.title`
- **welcome_subtitle** — подзаголовок (опционально)
- **welcome_description** — описание (опционально). Fallback: `testConfig.description`
- **welcome_badge** — бейдж вверху (опционально). Fallback: `"Диагностика"`
- **welcome_cta** — текст кнопки (опционально). Fallback: `"Начать тест"`
- **welcome_meta** — текст под кнопкой (опционально). Fallback: `"Результаты конфиденциальны. Правильных ответов нет."`
- `welcome_stats` — статистика на экране приветствия
- `block_insights` — мотивирующие фразы между блоками (по 1 на блок, count = `ceil(total_questions / questions_per_block)`)
- `quick_answer_labels` — подписи под шкалой Ликерта (от 1 до max)
- `analyzing_stages` — этапы анимации «анализируем» (опционально)
- `timeframe_text` — подсказка «за какой период оценивать» (опционально)

### SQL-шаблон создания теста (полный seed-файл)

**ВАЖНО:** Весь SQL ниже — единый файл `scripts/seed-{book-slug}-test.sql`. Выполняется за один раз в Supabase SQL Editor. Порядок операций критичен — не менять!

```sql
-- =============================================================
-- Seed: Тест для программы {BOOK_NAME}
-- Файл: scripts/seed-{book-slug}-test.sql
-- =============================================================

-- 1. INSERT тест (основная операция)
INSERT INTO test_configs (
  program_id, slug, title, short_title, description,
  questions, scales, scoring, ui_config,
  interpretation_prompt, mini_analysis_prompt_template
) VALUES (
  (SELECT id FROM programs WHERE slug = 'BOOK_SLUG'),
  'TEST_SLUG',          -- URL: /program/BOOK_SLUG/test/TEST_SLUG
  'Полное название теста',
  'Короткое',           -- Для UI-заголовков
  'Описание для лендинга',

  -- questions: [{q, scale, type, text}]
  -- q: 1-based номер, scale: ключ шкалы, type: direct|reverse
  '[
    {"q":1, "scale":"scale_key", "type":"direct", "text":"Утверждение 1..."},
    {"q":2, "scale":"scale_key", "type":"reverse", "text":"Утверждение 2..."}
  ]'::jsonb,

  -- scales: [{key, name, order, radar_label}]
  -- key: с префиксом книги (ta_, ll_, ng_), order: 0-based для radar
  '[
    {"key":"prefix_scale1", "name":"Название шкалы", "order":0, "radar_label":["Строка 1","Строка 2"]}
  ]'::jsonb,

  -- scoring
  '{
    "answer_range": [1, 5],
    "score_direction": "lower_is_better",
    "level_thresholds": [25, 50, 75],
    "level_labels": ["Низкий", "Умеренный", "Выраженный", "Высокий"]
  }'::jsonb,

  -- ui_config (все поля обязательны для корректного UI)
  '{
    "questions_per_block": 5,
    "auth_wall_question": null,
    "welcome_title": "Название<br /><span>подзаголовок</span>",
    "welcome_subtitle": "N вопросов · ~M минут",
    "welcome_description": "Описание на welcome screen",
    "welcome_badge": "Бесплатно",
    "welcome_cta": "Начать тест",
    "welcome_meta": "~M минут",
    "welcome_stats": [
      {"num": "N", "label": "вопросов"},
      {"num": "K", "label": "шкал"},
      {"num": "~M", "label": "минут"}
    ],
    "block_insights": ["Блок 1: Тема", "Блок 2: Тема"],
    "quick_answer_labels": ["Совсем нет", "Скорее нет", "Иногда", "Скорее да", "Полностью"],
    "analyzing_stages": [
      {"title": "Анализ ответов", "substeps": ["Обработка данных", "Подсчёт баллов"]},
      {"title": "Интерпретация", "substeps": ["Анализ паттернов", "Формирование выводов"]}
    ]
  }'::jsonb,

  -- interpretation_prompt (ИИ-интерпретация результатов).
  -- ВАЖНО: JSON-схема top_zones имеет ДВА формата (см. раздел «Формат top_zones» ниже).
  -- Для тестов-навыков — минимальный (scale_key + action_text).
  -- Для тестов-типологий/профилей — расширенный (+ score + headline + body + action_route).
  -- В обоих случаях основное поле — scale_key (внутренний ключ из scales[]),
  -- НЕ русское имя архетипа. UI режется по scale_key.
  E'Ты — психолог, специализирующийся на [тема книги].\n\n...',

  -- mini_analysis_prompt_template ({{questionText}} заменяется автоматически)
  E'Вопрос: «{{questionText}}»\n...'
);

-- 2. Feature flag (БЕЗ ЭТОГО тест не появится в UI)
UPDATE programs
SET features = features || '{"test": true}'::jsonb
WHERE slug = 'BOOK_SLUG';

-- 3. System prompt для тестового чата (БЕЗ ЭТОГО AI получит пустой контекст)
-- ВАЖНО: используется programs.test_system_prompt, НЕ test_configs.system_prompt
-- API не падает если NULL (есть `?? ""` fallback в app/api/test/route.ts), но
-- AI streaming text-answers уйдёт без понимания контекста теста — качество
-- интерпретации текстовых ответов резко упадёт.
UPDATE programs
SET test_system_prompt = E'Ты проводишь тест по книге [название].\n\n...'
WHERE slug = 'BOOK_SLUG'
  AND test_system_prompt IS NULL;

-- 4. Landing секция теста
UPDATE programs
SET landing_data = jsonb_set(
  landing_data,
  '{test}',
  '{
    "emoji": "🎯",
    "title": "Название теста",
    "description": "Краткое описание (1-2 предложения)",
    "time_label": "~M минут",
    "questions_label": "N вопросов",
    "cta_text": "Пройти тест бесплатно",
    "cta_href": "/program/BOOK_SLUG/test"
  }'::jsonb
)
WHERE slug = 'BOOK_SLUG';

-- 5. mode_template + program_mode для теста (если ещё нет)
-- Без этого тест не появится на хабе как карточка инструмента
INSERT INTO mode_templates (key, name, description, icon, chat_type, route_suffix, is_chat_based)
VALUES ('test_TEST_SLUG', 'Название теста', 'Описание для хаба', 'check', NULL, '/test/TEST_SLUG', false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO program_modes (program_id, mode_template_id, sort_order, enabled, access_type)
SELECT
  (SELECT id FROM programs WHERE slug = 'BOOK_SLUG'),
  (SELECT id FROM mode_templates WHERE key = 'test_TEST_SLUG'),
  1,    -- sort_order (тест обычно первый)
  true,
  'free'
ON CONFLICT DO NOTHING;

-- Примечание: color_class для test-карточки в program_modes можно не указывать.
-- InstrumentList (components/hub/InstrumentList.tsx) для всех test-режимов
-- (is_chat_based=false AND route_suffix LIKE '/test/%') форсит зелёный цвет
-- независимо от значения в БД — единообразие карточки теста на хабе.

-- 6. Верификация (выполни и проверь результат)
SELECT slug, title,
  jsonb_array_length(questions) as q_count,
  jsonb_array_length(scales) as scale_count
FROM test_configs
WHERE slug = 'TEST_SLUG';

-- 7. Hub welcome messages (БЕЗ ЭТОГО Система на хабе пустой кружок)
-- 3 ключа: first / returning_test / returning_notest.
-- Плейсхолдеры {theme1}/{theme2} в returning_test резолвятся в топ-2 тем по баллам
-- теста (см. hub/page.tsx). Если у программы нет program_themes — плейсхолдеры
-- автоматически стрипаются и выводится returning_notest.
UPDATE programs SET hub_messages = '{
  "first": "Привет! [хук про книгу]. Начни с теста — <strong>N минут, K вопросов</strong>. [что даст тест].",
  "returning_test": "По твоему профилю самые сильные темы — <strong>{theme1}</strong> и <strong>{theme2}</strong>. С чего начнём?",
  "returning_notest": "Пройди тест — <strong>N минут</strong>, и я подскажу, с чего начать. А пока выбирай инструмент."
}'::jsonb
WHERE slug = 'BOOK_SLUG';
```

### После создания теста — чеклист

**Все SQL-операции уже в шаблоне выше.** Этот чеклист — для верификации:

| # | Что проверить | Как | Критично? |
|---|--------------|-----|-----------|
| 0 | Линтер чат-полей не выдаёт ошибок | `npm run check:chats -- --book=BOOK_SLUG` → 0 errors | 🔴 Ловит косяки до того как они пойдут в UI |
| 1 | `test_configs` содержит запись | `SELECT * FROM test_configs WHERE slug = 'TEST_SLUG'` | 🔴 Без этого тест не существует |
| 2 | `programs.features.test = true` | `SELECT features->>'test' FROM programs WHERE slug = 'BOOK_SLUG'` | 🔴 Без этого тест скрыт в UI |
| 3 | `programs.test_system_prompt` заполнен | `SELECT test_system_prompt IS NOT NULL FROM programs WHERE slug = 'BOOK_SLUG'` | 🔴 Без этого AI streaming text-answers идёт без контекста теста (API не падает — есть `?? ""` fallback, но качество интерпретации текстовых ответов резко падает) |
| 4 | `landing_data.test` заполнен | `SELECT landing_data->'test' FROM programs WHERE slug = 'BOOK_SLUG'` | 🟡 Без этого нет секции теста на лендинге |
| 5 | `mode_template` + `program_mode` созданы | `SELECT key FROM mode_templates WHERE key = 'test_TEST_SLUG'` | 🟡 Без этого нет карточки на хабе |
| 6 | `auth_wall_question` рассчитан | `floor(total_questions * 0.7) - 1` (0-based) | 🟡 null = без auth wall |
| 7 | Middleware пропускает | Route `/program/*/test/*` уже public | ✅ Не нужно менять |
| 8 | Роут `test/[testSlug]` | Уже существует и работает для любого slug | ✅ Не нужно менять |
| 9 | Пройти тест в браузере | Welcome → вопросы → auth wall → результаты → radar | 🔴 Обязательно! |
| 9.5 | `programs.hub_messages` заполнены | `/program/<slug>/hub?hub_state=first` → ИИ-message не пустой; `?hub_state=returning-notest` → тот же тест | 🔴 Без этого на хабе пустой золотой кружок |
| 9.6 | `HistoryScreen` теста — правильный заголовок | `/program/<slug>/test/<testSlug>?test_state=history-multi` → заголовок из `testConfig.ui_config.welcome_title`, не от другой книги | 🟡 Быстрый визуальный прогон через debug-параметр |

### Важно: какой system_prompt используется

- **`programs.test_system_prompt`** — используется API `/api/test` для генерации ответов во время теста. **Обязательно заполнить, иначе 404!**
- **`test_configs.interpretation_prompt`** — используется при генерации финальной интерпретации результатов (Gemini Pro)
- **`test_configs.mini_analysis_prompt_template`** — используется для мини-анализа текстовых ответов

### Как работает localStorage (storageKey)

Анонимная сессия сохраняется в `localStorage` / `sessionStorage` под ключом `test_session_{testConfig.slug}`. Например:
- ISSP тест: `test_session_issp`
- GPP тест: `test_session_gpp-test`

Ключ формируется автоматически из slug теста. **Не нужно** ничего хардкодить.

### Как работает статус «Пройден» на хабе

Хаб определяет тест-режим generic-проверкой: `!mode.is_chat_based && mode.route_suffix?.startsWith("/test")`. Для корректной работы:
- `mode_template.is_chat_based` = `false`
- `mode_template.route_suffix` начинается с `/test/`

Если оба условия выполнены, хаб автоматически показывает «Пройден · AI учитывает результаты» при наличии `hasTestResult`.

### Как работает сортировка тем по тесту

Таблица `program_themes` имеет колонку `test_scale_key` (бывш. `issp_scale_key`). Если заполнена — темы сортируются по баллам теста (высшие первые). Маппинг: `program_themes.test_scale_key` → `test_results.scores_by_scale[key]`.

### Формат `top_zones` в `interpretation_prompt`

`top_zones` — блок «С чего начать» на странице результатов теста. У него **два формата**, оба поддерживаются компонентом `TopZones` (`components/test-results/TestResultsPage.tsx`):

**Минимальный (для тестов-навыков: eq-test, issp-test)** — одна-три карточки с тегами упражнений:

```json
"top_zones": [
  { "scale_key": "eq_self_awareness", "action_text": "Начни с самосознания..." }
]
```

**Расширенный (для тестов-типологий: archetype-test, MBTI-подобные)** — две карточки с заголовком, абзацем и кнопкой-CTA в режим:

```json
"top_zones": [
  {
    "scale_key": "belonging_lover",
    "score": 88,
    "headline": "Любовник — твой ведущий архетип",
    "body": "1-2 абзаца про этот архетип…",
    "action_text": "Разобрать архетип твоего бренда",
    "action_route": "/program/heroes-and-outlaws/chat/new?tool=arch_brand"
  }
]
```

**Правила:**
- `scale_key` — ВСЕГДА внутренний ключ из `scales[].key`. НЕ русское имя. UI режется по этому ключу через `scaleNames`/`scoresByScale`.
- Если есть `headline` — он используется как заголовок (вместо `{name} — {pct}%`). `score` подменяет `scoresByScale[key].pct` если задан.
- Если есть `body` — он рендерится как абзац (вместо одной строки `action_text`).
- Если есть `action_route` — рендерится большая кнопка-CTA, ведущая в режим (приоритет над тегами упражнений).
- Если нет `action_route` — рендерятся теги упражнений из `scales[].exercises` (как в issp-test).

**Legacy-safety:** нормализатор `normalizeInterpretation(interp, scaleNames)` ([lib/test-interpretation.ts](lib/test-interpretation.ts)) автоматически конвертирует старое поле `archetype` (русское имя) в `scale_key` через инверсию `scaleNames` — это для старых результатов в БД. Новые промпты должны сразу выдавать `scale_key`.

### Известные баги и грабли (lessons learned)

| # | Баг | Причина | Как избежать |
|---|-----|---------|-------------|
| 1 | INSERT в test_results падает | Колонка `test_slug` отсутствовала в таблице | Чеклист п.5: проверять схему `test_results` перед первым тестом |
| 2 | WelcomeScreen показывал ИССП для всех тестов | Компонент был захардкожен | Исправлено: WelcomeScreen теперь динамический (ui_config.welcome_*) |
| 3 | `/test/issp` хардкод в HubScreen, SiteFooter | Ссылки вели на конкретный slug | Исправлено: используют `/program/{slug}/test` → redirect на правильный slug |
| 4 | Build проходит, но данные не доходят | TypeScript не проверяет что DB-колонка существует | Правило: после SQL seed — обязательно пройти тест в браузере до результатов |
| 5 | API тест вернул 404 | `programs.test_system_prompt` не заполнен | Чеклист п.3: **обязательно** заполнить |
| 6 | localStorage чистился неправильно | Хардкод `issp_session_id` вместо динамического ключа | Исправлено: используется `test_session_{slug}` автоматически |
| 7 | Хаб не показывал «Пройден» для нового теста | Хардкод `mode.key === "test_issp"` | Исправлено: generic проверка `route_suffix.startsWith("/test")` |
| 8 | Пустой золотой кружок вместо Система на хабе GPP | `programs.hub_messages = {}` для новой книги | Шаг 7 в SQL-шаблоне теперь обязательный; визуальная проверка `?hub_state=first` |
| 9 | HistoryScreen теста показывал «Индекс Синдрома Славного Парня» для других книг | Захардкожен h1 и badge | Исправлено: `HistoryScreen` берёт из `testConfig.ui_config.welcome_title/welcome_badge`. Проверка через `?test_state=history-multi` |
| 10 | RadarChart рендерил высокий навык красным (тревога) для навыкового теста | `dotColor` и текстовые лейблы зон были захардкожены под `lower_is_better` | Исправлено в Phase A теста Бакирова: `RadarChart` принимает prop `scoreDirection`, инвертирует пороги цвета и зоны лейблов для `higher_is_better`. `TestResultsPage` пробрасывает `testConfig.scoring.score_direction`. Регрессия: ISSP/GPP остались как раньше (default `lower_is_better`) |
| 11 | `TestResultsPage` хардкодил `getLevelLabel(score)` русскими строками для ISSP | Fallback при отсутствии `interpretation.level_label` от AI всегда возвращал «Низкий/…/Высокий» | Исправлено вместе с #10: `TestResultsPage` принимает props `levelLabels` и `levelThresholds` из `testConfig.scoring`, использует их для fallback. Bakirov-уровни «Новичок/…/Мастер» работают сразу |
| 12 | Блок «С чего начать» в archetype-test показывал «1 — 0%» / «2 — 0%» с одинаковым текстом | Промпт выдавал `archetype: "Любовник"` (русское имя) вместо `scale_key`, и компонент `TopZones` игнорировал расширенные поля `headline`/`body`/`action_route` | Исправлено: расширили `TopZones` под два формата (минимальный + расширенный), `normalizeInterpretation` теперь принимает `scaleNames` и инвертирует `archetype → scale_key` для legacy. Промпт `archetype-test` в БД поправлен на `scale_key`. См. раздел «Формат top_zones» выше |

### Реестр тестов

| Книга | test slug | Вопросов | Шкал | Auth wall | Формат | Статус |
|-------|-----------|----------|------|-----------|--------|--------|
| Гловер «Славные парни» | issp | 35 | 7 | Q34 (idx 33) | Диагностический (`lower_is_better`) | ✅ Работает |
| Берн «Игры» | gpp-test | 25 | 5 | Q20 (idx 19) | Диагностический (`lower_is_better`) | ✅ Работает |
| Бакиров «Разговорный гипноз» | hypnosis-test | 25 | 5 | Q17 (idx 16) | Навыковый (`higher_is_better`) | ✅ Работает |
| Чепмен «5 языков» | — | — | — | — | — | ❌ Нет |

---

## Иконки — ТРИ системы, которые нужно синхронизировать

В проекте **три независимые карты иконок**, и каждая закрывает свой кусок UI. Когда добавляешь новый режим/тему — пройди по всем трём, иначе пользователь увидит пустой кружок там, где ты этого не ожидаешь.

| # | Файл (source of truth) | Карта | Ключ из БД | Где рендерится | Симптом если ключа нет |
|---|------------------------|-------|-----------|----------------|------------------------|
| 1 | `components/hub/mode-icons.tsx` | `iconMap` | `mode_templates.icon` | Лендинг программы — секция "Решение" | Нет иконки в карточке выгод на ленде |
| 2 | `components/hub/InstrumentList.tsx` | `INSTRUMENT_ICON_MAP` | `mode_templates.icon` | **Хаб → карточки инструментов** | Карточка инструмента без иконки |
| 3 | `components/icons/theme-icon-map.tsx` | `THEME_ICON_MAP` | `program_themes.icon_key` **И** `test_configs.scales[].key` | **Хаб → карточки тем** + **страница результатов теста** | Пустой золотой кружок темы на хабе и в радаре теста |

Формат всех — Feather/Lucide-style SVG, 24×24 viewBox, stroke-based. №2 и №3 принимают `IconProps { size?: number; className?: string }`.

**Дополнительно: `toolKeyMap`** в `InstrumentList.tsx` — маппинг `mode_template.key` → `tool-slug` для URL `/chat/new?tool=...`. Нужно дополнить, если новый chat-based режим имеет нестандартный ключ (иначе будет дефолт `key.replace(/_/g, '-')`).

### Чеклист при добавлении НОВОЙ иконки

| Шаг | Файл | Что сделать | Когда нужно |
|-----|------|-------------|------------|
| 1 | `components/icons/hub-icons.tsx` | Создать SVG-компонент (`function FooIcon({ size, className })`) — это базовый файл, из него реэкспортируют другие | Всегда |
| 2 | `components/hub/InstrumentList.tsx` | Импорт `FooIcon` + запись в `INSTRUMENT_ICON_MAP` под ключом из `mode_templates.icon` | Если добавляешь новый режим с новой `icon` |
| 3 | `components/icons/theme-icon-map.tsx` | Импорт `FooIcon` + запись в `THEME_ICON_MAP` под ключом из `program_themes.icon_key` | Если добавляешь новую тему с новым `icon_key` |
| 4 | `components/hub/mode-icons.tsx` | Создать упрощённый SVG (без props) + запись в `iconMap` | Если иконка нужна и на лендинге |
| 5 | `components/hub/InstrumentList.tsx` | Если ключ режима нестандартный — дополнить `toolKeyMap` | Только если `is_chat_based=true` и URL не стандартный |

### Существующие ключи

**`INSTRUMENT_ICON_MAP` (карточки инструментов на хабе):**
pen, clock, check, book, chat, heart, users, compass, lightbulb, translate, drama, target, search, message-circle, book-open, map, sparkles, shield, unlock, rocket, lightning, flask, brain, layout, eraser.

**`THEME_ICON_MAP` (темы программ + шкалы тестов):**
- nice-guy: approval, contracts, suppression, control, boundaries, masculinity, attachment
- games-people-play: games, ego-states, life-script, strokes, karpman
- razgovorny-gipnoz: rapport, suggestions, strategy, awareness, trance
- 100-notes: fear_mastery, scale_thinking, energy_agency, environment_hygiene, self_reflection
- redecision-therapy: intimacy, feelings, success, authenticity, drivers
- heroes-and-outlaws: arch_paradise, arch_impact, arch_belonging, arch_order

Если нужного ключа нет — добавь во все нужные файлы (см. таблицу). Линтер `npm run check:chats` ловит отсутствие через правила `theme-icon-missing` (error) и `mode-icon-missing` (warn) — прогоняй перед коммитом.

---

## Runtime: что код делает поверх seed

Эти три механизма автоматически работают после INSERT'а — автор seed должен про них **знать** (чтобы не дублировать и не путаться), но **руками настраивать не нужно**.

### 1. QR-reminder auto-inject в `/api/chat/route.ts`

[app/api/chat/route.ts](../../../../app/api/chat/route.ts) при сборке system_prompt для Gemini добавляет в **самый конец** короткое напоминание про формат «ёлочек» — recency effect, последнее видит модель. Это страховка от мелких сбоев Gemini.

**Где работает:**
- `/api/chat` (free chat, темы, tool-режимы, author chat — все авторизованные чаты программы)

**Где НЕ работает:**
- `/api/chat/anonymous` (демо-чат на лендинге) — там свой укороченный reminder
- `/api/test` (тестовые text-answers) — там идёт `programs.test_system_prompt` без модификаций

**Импликация для seed:** auto-inject **не повод опускать** блок `### Quick replies — ФОРМАТ` в seed-промптах. Каждый из 4 system_prompt уровней (programs + 3 program_modes уровня) должен быть самодостаточным. Reminder — backup, не source of truth.

### 2. Welcome serialization для F5 (`serializeWelcomeWithReplies`)

В seed мы пишем `welcome_ai_message` и `welcome_replies` в **разные поля** БД. Когда пользователь открывает чат через NewChatScreen, runtime-функция [lib/chat/prepare-context.ts](../../../../lib/chat/prepare-context.ts) → `serializeWelcomeWithReplies` склеивает их в один text с «ёлочками» в конце:

```
{welcome_ai_message}

«{reply 1.text}»
«{reply 2.text}»
«{reply 3.text}»
```

Этот склеенный text сохраняется в `messages.content` как первое сообщение AI. После F5 (или загрузки истории) `parseQuickReplies` извлекает кнопки из конца текста — UX сохраняется.

**Импликация для seed:**
- **НЕ заполняй `welcome_message` (legacy) и `welcome_ai_message` одновременно** — `prepare-context.ts` отдаёт приоритет legacy, новые поля просто теряются. Линтер `npm run check:chats` ловит это (`welcome-message-exclusive`).
- Для **новых режимов** используй ТОЛЬКО `welcome_ai_message` + `welcome_replies`. `welcome_message` — только если режим существует с legacy-времён.

### 3. AIBubble + QuickReplyBar split (рендер ИИ-сообщений)

Все чат-поверхности (ChatWindow, NewChatScreen, AnonymousChat) рендерят ИИ-сообщения через ДВА компонента из [components/chat/ChatMessage.tsx](../../../../components/chat/ChatMessage.tsx):
- `<AIBubble>` — пузырь с ReactMarkdown + `remark-breaks`
- `<QuickReplyBar>` — блок кнопок, **SIBLING** контейнера `.msg`/`.nc-msg`, не внутри

Парсер «ёлочек» — единый: [lib/chat/parse-quick-replies.ts](../../../../lib/chat/parse-quick-replies.ts). Срезает leading `* `, `- `, `• `, `1. ` перед matchhing — толерантен к буллет-обёртке.

**Импликация для seed:** ничего не делать — это runtime. Но если делаешь новый чат-экран — следуй шаблону из runbook §"Шаблон для нового чат-экрана", иначе кнопки уедут в узкую колонку справа.

---

## Линтер `npm run check:chats`

Автоматическая проверка seed-полей. Файл: [scripts/check-chat-seed.ts](../../../../scripts/check-chat-seed.ts). Запуск:

```bash
npm run check:chats                       # все книги в БД
npx tsx scripts/check-chat-seed.ts --book=<slug>   # одна книга (быстрее)
```

**Exit code:** 0 (или только warnings) / 1 (errors) / 2 (нет .env / SUPABASE_SERVICE_ROLE_KEY).

### Что проверяет

На уровне **program_modes** (для каждого режима):
- `welcome_mode_label` — UPPERCASE (`АНАЛИЗ`, `ВОРКШОП`...)
- `welcome_title` — без эмодзи в начале
- `welcome_title` ≠ `mode_templates.name` (фраза-действие, не дубль ярлыка) — error
- `welcome_subtitle` — ≤80 символов
- `welcome_ai_message` — нет `**bold**`, `# headings`, `- lists`, нумерации; нет дубликата `эмодзи **Title**` в начале; абзацы через `\n\n`
- `welcome_replies` — массив **объектов** `{text, type}` (не строки); последний `type: "exit"`; каждый `text` ≤60 символов, без вложенных «ёлочек», без markdown
- `welcome_message` + `welcome_ai_message` — взаимоисключающие
- `system_prompt` — содержит блок `QUICK REPLIES`, буквальный пример «ёлочек», counterexample `НЕПРАВИЛЬНО`, фразу `НИКОГДА не склеивай`, counterexample про `<угловые скобки>`. Плейсхолдеры `«Вариант 1»` не должны оставаться в **позитивном** примере (допустимы только в `НЕПРАВИЛЬНО` блоке).
- `system_prompt` — содержит блок «Запрет приветствий» (кирпич Б из REFERENCE.md §5.0) — warning
- `system_prompt` — содержит блок «ОБРАЩЕНИЕ» с правилом «ты» (кирпич А) — warning

На уровне **programs**:
- `system_prompt` / `author_chat_system_prompt` / `anonymous_system_prompt` — содержат QR-блок (правила не наследуются)
- `system_prompt` / `author_chat_system_prompt` / `anonymous_system_prompt` — содержат «Запрет приветствий» (кирпич Б) — error для `anonymous_system_prompt`, warning для остальных
- `system_prompt` / `anonymous_system_prompt` — содержат «ОБРАЩЕНИЕ» с правилом «ты» (кирпич А) — error для `anonymous_system_prompt`, warning для `system_prompt`. `author_chat_system_prompt` исключение (автор сам формулирует обращение)
- `anonymous_system_prompt` — содержит «СТРУКТУРА ПЕРВОГО ОТВЕТА» с **ОБЯЗАТЕЛЬНО назови ... по имени** (блок Д) — error
- `anonymous_system_prompt` — содержит «Quick replies — КРИТИЧЕСКОЕ ПРАВИЛО» **и** контр-пример «без кавычек» (блок Е) — error
- `landing_data.main_concepts` — массив из ≥5 строк, каждая встречается в `anonymous_system_prompt` — warning
- `landing_data.chat_header` / `book` / `personas.items[].body` / `social_proof[].sub` — без HTML-тегов `<em>`/`<strong>`/`<br>` (поля не поддерживают разметку) — warning
- `free_chat_welcome` / `author_chat_welcome` — содержат ≥3 «ёлочки» в конце на отдельных строках
- `landing_data.author.photo_url` — локальный путь `/authors/*`

На уровне **program_themes**:
- те же правила welcome_ai_message + welcome_replies
- `welcome_system_context` — НЕ дублирует QR-блок (наследуется из `programs.system_prompt`)
- `icon_key` — есть в `THEME_ICON_MAP` (components/icons/theme-icon-map.tsx) — error, иначе пустой кружок на хабе

На уровне **mode_templates** (через JOIN с program_modes):
- `icon` — есть в `INSTRUMENT_ICON_MAP` (components/hub/InstrumentList.tsx) — warn

На уровне **test_configs** (если есть):
- `questions[]` группируется по блокам `ui_config.questions_per_block` — все вопросы внутри блока должны иметь одну `scale` — error

**Новые правила (после ретро 9 книг 2026-05):**
- `programs.hub_messages` — 3 обязательных ключа (`first`, `returning_test`, `returning_notest`); если у программы есть тест и hub_messages пуст — error, иначе warn
- `programs.test_system_prompt` — заполнен если `features.test=true` (error, иначе AI streaming text-answers идёт без контекста)
- `landing_data.author.photo_url` — файл реально существует в `public/` (warn, иначе broken image)
- Запрещённые фразы из `docs/brand-glossary.md` (`AI-тренажёр`, `Nice Guy AI`, `ИИ-/AI-<существительное>`) в любых seed-полях программы, режимов и тем — warn. Исключения зашиты для допустимых локаций (`meta_title`, `meta_description`, `landing_data.comparison.columns[*].name`).

Дополнительно: отдельный скрипт `npm run check:author-photos` проверяет `public/authors/*.jpg` на размер ≥100 КБ (фото мутное при меньшем размере — Wikipedia thumbnails запрещены).

### Когда запускать

- **После seed новой книги** — обязательно. Не должно быть ни одной error. Warnings — обсудить, фиксать в seed.
- **После любого fix-*.sql** — убедиться что фикс не сломал что-то ещё.
- **В CI** (опционально) — `npm run check` в `package.json` уже делает `check-hardcodes + check:chats`.

### Что НЕ проверяется

- Содержание промптов (тон, fidelity к книге, авторская терминология) — это смысловая работа.
- Корректность тестовых вопросов, шкал — отдельный домен.
- UI-рендеринг — нужна ручная UI-верификация на dev-сервере (SKILL.md Этап 4.8).

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
