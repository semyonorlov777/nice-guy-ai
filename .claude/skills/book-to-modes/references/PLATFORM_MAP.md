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

### chat_type

Совпадает с `mode_template.key` для уникальных режимов. Для shared режимов:
- `free` — свободный чат (все книги)
- `author` — разговор с автором (все книги)
- `exercise` — упражнения (если есть)

### route_suffix

Формат: `/program/[slug]/(app)/{route_suffix}`

Должен быть уникальным внутри программы. Для новых режимов можно группировать:
- `/ta/game-quiz`, `/ta/script`, `/ta/matrix` — под общим префиксом

## Чеклист файлов при добавлении режимов

| Файл | Что сделать | Обязательно? |
|------|-------------|-------------|
| SQL миграция | INSERT mode_templates + program_modes | Да |
| `programs.features` | Обновить если нужны новые feature flags | По ситуации |
| `lib/chat/prepare-context.ts` | Проверить что chat_type обрабатывается | Только если новая логика |
| `middleware.ts` | Добавить исключение если route должен быть public | Только для public |
| `app/program/[slug]/(app)/` | Создать page.tsx если нужен новый route | Только если route новый |
| `types/modes.ts` | Добавить новые chat_type если нужно | По ситуации |

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
