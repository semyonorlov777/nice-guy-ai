# Runbook: Добавление новой книги (программы)

**Когда использовать:** При добавлении новой книги/программы на платформу.
**Время выполнения:** ~2-4 часа (промпты + seed + тестирование)
**Требования:** Supabase SQL Editor, доступ к production/staging БД
**Связанные ADR:** [ADR-003](../adr/003-test-system.md), [ADR-004](../adr/004-context-assembly.md)

## Предварительные проверки

- [ ] Книга прочитана, ключевые концепции выписаны
- [ ] Выделены 5-7 главных концептов книги (для `landing_data.main_concepts` и блока Д anonymous_system_prompt)
- [ ] Определены режимы: какие включать (free_chat, author_chat, portrait, exercises, test)
- [ ] Промпты написаны (см. skill `book-to-modes`)
- [ ] Slug программы выбран (kebab-case: `games-people-play`, `love-languages`)
- [ ] Фото автора найдено и скачано в `public/authors/<slug>.jpg`:
  - **Размер файла ≥100 КБ.** Wikipedia thumbnail (~30-50 КБ) — запрещены: мутное, читается как «постер на стене».
  - **Разрешение ≥500×500 px.**
  - Источник: страница института/университета/издательства, не Wikipedia thumbnails.
  - Проверка: `npm run check:author-photos` без жалоб.
  - Прецедент: seven-principles — первая итерация Готтмана с Wikipedia thumbnail 38 КБ.

## Шаги

### 1. Спроектировать режимы через skill `book-to-modes`

Используй Claude Code skill `book-to-modes` для генерации:
- System prompt для каждого режима
- Welcome messages
- Тематические чаты (если нужны)
- Author chat prompt (от лица автора)

**Ожидаемый результат:** Markdown-файл с промптами для всех режимов.

### 2. Создать seed SQL для программы

Файл: `scripts/seed-{book-slug}.sql`

Референс: `scripts/seed-games-people-play.sql` (самый чистый пример)

```sql
-- Seed программы "{Название}" ({Автор})
-- Slug: {book-slug}
-- Features: free_chat, author_chat, portrait
-- SQL выполнять вручную через Supabase SQL Editor

-- ═══════════════════════════════════════════════════
-- 1. INSERT программы
-- ═══════════════════════════════════════════════════

INSERT INTO programs (
  slug,
  title,
  description,
  category,                 -- 'psychology' | 'marketing' (text, не enum)
  system_prompt,            -- Основной промпт для free_chat
  anonymous_system_prompt,  -- Укороченный промпт для лендинга
  free_chat_welcome,        -- Welcome message для free_chat
  author_chat_system_prompt,-- Промпт "от лица автора"
  author_chat_welcome,      -- Welcome message для author_chat
  portrait_prompt,          -- Промпт для ИИ-анализа портрета
  config,                   -- '{}' если нет кастомной конфигурации
  features,                 -- JSON с флагами включённых режимов
  meta_title,               -- SEO title
  meta_description,         -- SEO description
  landing_data,             -- JSONB с данными лендинга
  anonymous_quick_replies   -- Quick replies для анонимного чата
) VALUES (
  '{book-slug}',
  '{Название книги}',
  '{Описание программы}',
  'psychology',             -- или 'marketing' (default 'psychology', менять явно для маркетинговых книг)
  E'{system_prompt}',       -- E-строка для escape \n
  E'{anonymous_system_prompt}',
  E'{free_chat_welcome}',
  E'{author_chat_system_prompt}',
  E'{author_chat_welcome}',
  E'{portrait_prompt}',
  '{}'::jsonb,
  '{"free_chat": true, "exercises": false, "portrait": true, "author_chat": true, "test": false}'::jsonb,
  '{meta_title}',
  '{meta_description}',
  '{landing_data}'::jsonb,
  '[{"text": "Вариант 1"}, {"text": "Вариант 2"}]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  system_prompt = EXCLUDED.system_prompt,
  -- ... все поля
;
```

**Ожидаемый результат:** SQL-файл в `scripts/`.

### 3. Создать seed SQL для режимов

Файл: `scripts/seed-{book-slug}-modes.sql`

Референс: `scripts/seed-games-people-play-modes.sql`

```sql
-- ═══════════════════════════════════════════════════
-- 2. Mode templates (если нужны новые типы)
-- ═══════════════════════════════════════════════════

-- Обычно mode_templates уже есть (free_chat, author_chat, portrait, etc.)
-- Новые нужны только для тематических чатов

INSERT INTO mode_templates (chat_type, slug, label, description, icon)
VALUES ('theme_boundaries', 'boundaries', 'Границы', 'Работа с границами', 'shield')
ON CONFLICT (chat_type) DO NOTHING;

-- ═══════════════════════════════════════════════════
-- 3. Program modes (включение режимов для программы)
-- ═══════════════════════════════════════════════════

INSERT INTO program_modes (
  program_id,
  mode_template_id,
  enabled,
  sort_order,
  system_prompt,      -- Mode-specific prompt (перекрывает program.system_prompt)
  welcome_message,    -- Mode-specific welcome
  welcome_replies     -- JSONB массив объектов [{text, type}], НЕ строк!
)
SELECT
  p.id,
  mt.id,
  true,
  1,
  E'{mode_system_prompt}',
  E'{mode_welcome}',
  '[{"text": "Вариант 1", "type": "text"}, {"text": "Вариант 2", "type": "text"}]'::jsonb
FROM programs p, mode_templates mt
WHERE p.slug = '{book-slug}' AND mt.chat_type = 'free_chat'
ON CONFLICT (program_id, mode_template_id) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt,
  welcome_message = EXCLUDED.welcome_message,
  welcome_replies = EXCLUDED.welcome_replies;
```

> ⚠️ **КРИТИЧНО:** `welcome_replies` должен быть массивом **объектов** `[{text, type}]`, НЕ массивом строк `["text1", "text2"]`. Строки приведут к ошибке в UI.

**Ожидаемый результат:** SQL-файл в `scripts/`.

### 4. Подготовить landing_data

JSONB-поле в `programs` с данными лендинга. Структура:

```json
{
  "hero_tag": "Онлайн-тренажёр по книге [Название]",
  "hero_title": "Заголовок с <em>акцентом</em>",
  "hero_subtitle": "Описание...",
  "hero_cta": "Начать бесплатно ↓",
  "hero_hint": "Без регистрации",
  "book": {
    "cover_url": "https://cdn.litres.ru/...",
    "alt": "Название книги — Автор",
    "author_top": "Автор",
    "title": "Название",
    "subtitle": "Original Title",
    "author_bottom": "Author Name"
  },
  "social_proof": [
    { "icon": "users", "main": "15M+", "sub": "копий продано" }
  ],
  "pricing": {
    "is_paid": false
  }
}
```

> 💰 **Платная программа?** В `landing_data.pricing` укажи `{"is_paid": true, "price_rub": 490}` — карточка в каталоге `/programs` получит акцентный бейдж «490 ₽» вместо «Бесплатно». Для бесплатных можно опустить `pricing` или ставить `{"is_paid": false}` — fallback в `lib/queries/programs-catalog.ts` всё равно посчитает бесплатной.

### 5. Выполнить SQL в Supabase

1. Открой Supabase SQL Editor
2. Выполни `seed-{book-slug}.sql` (программа)
3. Выполни `seed-{book-slug}-modes.sql` (режимы)
4. (Опционально) Выполни `seed-{book-slug}-test.sql` (тест) — см. [create-test.md](create-test.md)

**Ожидаемый результат:** Новые записи в `programs`, `program_modes`. Проверь:
```sql
SELECT slug, title, features FROM programs WHERE slug = '{book-slug}';
SELECT pm.*, mt.chat_type FROM program_modes pm
  JOIN mode_templates mt ON mt.id = pm.mode_template_id
  WHERE pm.program_id = (SELECT id FROM programs WHERE slug = '{book-slug}');
```

### 6. 🔴 Прогнать линтер чатовых полей (обязательно)

**До любых UI-проверок** — прогон линтера. Он быстрее всего ловит проблемы в seed-SQL: дубликаты заголовков, отсутствующие блоки в промптах, неправильный порядок вопросов теста, HTML-теги в полях без разметки.

```bash
npm run check:chats -- --book={book-slug}
```

**🔴 Книга не считается готовой пока линтер не вернёт 0 errors.**

Если errors — починить промпты/seed, перевыполнить INSERT/UPDATE в БД (через Supabase MCP `apply_migration` или SQL Editor), снова прогнать линтер.

Что ловит линтер (полный список — в [chat-message-formatting.md §Чеклист](chat-message-formatting.md)):
- Дубликат `welcome_title` и `mode_templates.name`
- Перемешанный порядок шкал в `test_configs.questions[]`
- HTML-теги в полях лендинга без поддержки разметки
- Отсутствие блоков «Запрет приветствий» / «ОБРАЩЕНИЕ» / Quick replies в промптах
- Отсутствие блока «СТРУКТУРА ПЕРВОГО ОТВЕТА» и «КРИТИЧЕСКОЕ ПРАВИЛО» в `anonymous_system_prompt`
- markdown в `welcome_ai_message`, неправильный формат `welcome_replies`
- внешний URL для `landing_data.author.photo_url`

```bash
npm run check:author-photos
```

Отдельно проверяет что все файлы в `public/authors/*.jpg` имеют размер ≥100 КБ.

### 7. Проверить в приложении

После зелёного линтера — UI-верификация.

UI data-driven — после INSERT в БД новая программа автоматически появится:
1. Главная страница (`/`) — карточка программы в каталоге
2. Лендинг (`/program/{slug}`) — данные из `landing_data`
3. Хаб (`/program/{slug}/hub`) — режимы из `program_modes`
4. Чат (`/program/{slug}/chat`) — system_prompt из программы/режима

```bash
npm run dev
# Открой http://localhost:3000
# Проверь лендинг: http://localhost:3000/program/{book-slug}
# Авторизуйся: http://localhost:3000/api/auth/dev-login
# Проверь хаб: http://localhost:3000/program/{book-slug}/hub
```

**Ожидаемый результат:** Программа видна, режимы работают, чат отвечает.

## Верификация

1. ✅ **Линтер `npm run check:chats -- --book={slug}` — 0 errors**
2. ✅ **Линтер `npm run check:author-photos` — без жалоб на фото автора**
3. ✅ Программа появилась на главной странице
4. ✅ Лендинг рендерится без ошибок (обложка, описание, social proof)
5. ✅ Анонимный чат на лендинге работает (anonymous_system_prompt) — **в первом ответе AI называет концепт книги по имени и даёт «ёлочки»**
6. ✅ После авторизации — хаб показывает все включённые режимы
7. ✅ Свободный чат работает (system_prompt) — AI начинает не со «Здравствуй»/«Отличный вопрос», обращается на «ты»
8. ✅ Чат с автором работает (author_chat_system_prompt)
9. ✅ Каждый tool-режим — welcome-карточка без markdown-артефактов, заголовок не дублируется
10. ✅ Если есть тест — переходы между блоками корректные (Q5: «Блок 1 / Следующий: Y» → Q6 действительно из Y)
11. ✅ Портрет обновляется после нескольких сообщений
12. ✅ `npm run build` проходит без ошибок

## Откат

```sql
-- Удалить режимы программы
DELETE FROM program_modes
WHERE program_id = (SELECT id FROM programs WHERE slug = '{book-slug}');

-- Удалить программу
DELETE FROM programs WHERE slug = '{book-slug}';
```

## Частые ошибки

| Симптом | Причина | Решение |
|---------|---------|---------|
| Программа не появляется на главной | `landing_data` невалидный JSON | Проверь JSON через jsonlint.com |
| Чат не отвечает | `system_prompt` пустой | Проверь INSERT — E-строка без ошибок? |
| Welcome message не показывается | `welcome_replies` — строки вместо объектов | Замени `["text"]` на `[{"text": "...", "type": "text"}]` |
| Режим не виден в хабе | `program_modes` не создан или `enabled = false` | Проверь SELECT из шага 5 |
| Кэш не обновился | 60с TTL в `lib/config.ts` | Подожди минуту или рестартни dev-сервер |
| Лендинг 404 | Slug не совпадает | `programs.slug` должен совпадать с URL |
| Обложка не грузится | CSP блокирует домен | Добавь домен в `img-src` в `next.config.ts` |
| Пустой золотой кружок на хабе у темы | `THEME_ICON_MAP` не содержит ключ темы | Добавь иконку в `components/icons/theme-icon-map.tsx` под ключом из `program_themes.icon_key`. Линтер `npm run check:chats` ловит это правилом `theme-icon-missing` |
| Пустой золотой кружок на хабе вместо приветствия Системы | `programs.hub_messages` пуст или не содержит 3 ключей | Заполни через `UPDATE programs SET hub_messages = jsonb_build_object('first', '...', 'returning_test', '...', 'returning_notest', '...')`. Линтер: `hub-messages-missing` / `hub-messages-key-missing` |
| Broken image для фото автора на лендинге | Файла нет в `public/authors/<slug>.jpg` или путь не локальный | Скачай фото (≥100 КБ, ≥500×500 px) в `public/authors/<slug>.jpg`, в `landing_data.author.photo_url` пропиши `/authors/<slug>.jpg`. Линтер: `author-photo-file-missing` |
| AI streaming text-answers в тесте без понимания книги | `programs.test_system_prompt` пуст (при `features.test=true`) | Заполни промптом про логику теста и книгу. Линтер: `test-system-prompt-missing` |
| Карточка инструмента на хабе без иконки | `mode_templates.icon` ссылается на отсутствующий ключ | Добавь в `components/hub/InstrumentList.tsx::INSTRUMENT_ICON_MAP` или переиспользуй существующий (pen, clock, check, book, chat, heart, и др.). Линтер: `mode-icon-missing` |
| Запрещённая фраза «AI-тренажёр» / «ИИ-ассистент» / «Nice Guy AI» в seed-полях | Старая версия словаря бренда | Замени по `docs/brand-glossary.md`: «Онлайн-тренажёр по книге X», «Система», «Книжный Спарринг». Линтер: `brand-banned-phrase` |
