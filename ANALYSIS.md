# Анализ: добавление второй программы «Игры, в которые играют люди» (Эрик Берн)

## Уже универсально (не нужно менять)

- **`app/program/[slug]/(app)/layout.tsx`**: полностью универсален — загружает программу по slug из БД, передаёт slug в Sidebar и MobileTabs
- **`app/program/[slug]/(app)/exercise/[number]/page.tsx`**: универсален — загружает упражнение из БД по program_id и number, использует данные из БД (title, description, welcome_message, config)
- **`app/program/[slug]/(app)/exercises/page.tsx`**: логика универсальна (группировка по chapter, статусы чатов), кроме CHAPTER_TITLES (см. ниже)
- **`app/api/chat/route.ts`**: полностью универсален — system_prompt и exercise.system_prompt берутся из БД, портрет привязан к program_id
- **`app/api/chat/anonymous/route.ts`**: универсален — загружает program по slug, system_prompt из БД
- **`app/api/portrait/route.ts`**: универсален — принимает program_id как параметр
- **`app/api/portrait/update/route.ts`**: универсален — работает через chat → program_id из БД
- **`lib/gemini.ts`**: универсален — просто обёртка над Gemini API
- **`lib/gemini-portrait.ts`**: универсален — просто вызывает Gemini Pro с переданным промптом
- **`components/MobileTabs.tsx`**: универсален — принимает slug, строит пути динамически
- **`components/Sidebar.tsx`**: навигация универсальна (принимает slug), кроме лого (см. ниже)
- **`app/program/[slug]/page.tsx` (лендинг)**: логика универсальна — landing_data берётся из БД по slug, кроме metadata (см. ниже)
- **`app/api/payments/*`**: не привязаны к конкретной программе
- **`app/balance/page.tsx`**: не привязан к программе
- **`lib/config.ts`**: универсален

## Нужно сделать универсальным

### Критические (блокируют запуск второй программы)

- **`app/page.tsx:4`**: `redirect("/program/nice-guy")` → заменить на каталог программ (карточки с выбором программы) или динамический redirect на последнюю использованную программу
- **`middleware.ts:4`**: `DEFAULT_REDIRECT = "/program/nice-guy/chat"` → определять последнюю программу пользователя из БД, либо редиректить на `/` (каталог)
- **`app/auth/page.tsx:9`**: `DEFAULT_REDIRECT = "/program/nice-guy/chat"` → аналогично middleware
- **`app/auth/callback/route.ts:4`**: `DEFAULT_REDIRECT = "/program/nice-guy/chat"` → аналогично
- **`app/api/auth/yandex/callback/route.ts:5`**: `DEFAULT_REDIRECT = "/program/nice-guy/chat"` → аналогично
- **`components/PublicHeader.tsx:19`**: `href="/program/nice-guy/chat"` → динамический href (последняя программа или каталог `/`)

### Структуры данных — специфичны для "Nice Guy"

- **`types/portrait.ts:40`**: поле `nice_guy_patterns` → переименовать в универсальное `behavior_patterns` или `core_patterns`. Затрагивает:
  - `types/portrait.ts:40,69` — определение и EMPTY_PORTRAIT
  - `lib/prompts/portrait-analyst.ts:110` — JSON-структура в промпте
  - `app/program/[slug]/(app)/portrait/page.tsx:37,89` — чтение `nice_guy_patterns`
- **`lib/prompts/portrait-analyst.ts`**: весь промпт заточен под Гловера:
  - строка 7: "специализация — методология Роберта Гловера"
  - строки 48-63: "ТЕРМИНОЛОГИЯ ГЛОВЕРА" — все термины Гловера
  - строки 110-121: `nice_guy_patterns` в JSON-формате
  - → сделать промпт шаблонным (загружать специализацию и терминологию из БД или из файла per-program)

### Захардкоженные тексты

- **`app/program/[slug]/(app)/exercises/page.tsx:4-14`**: `CHAPTER_TITLES` — 9 глав книги Гловера → вынести в таблицу `chapters` в БД или в поле `exercises.chapter_title` / `programs.chapter_titles` (JSON)
- **`app/program/[slug]/(app)/portrait/page.tsx:6`**: `TOTAL_EXERCISES = 46` → загружать COUNT из exercises для данной программы (уже есть подобный запрос в exercise/[number]/page.tsx:50-53)
- **`app/program/[slug]/(app)/chat/page.tsx:81`**: `"46 упражнений"` — захардкожено → брать из БД (count упражнений или поле programs.exercise_count)
- **`app/program/[slug]/page.tsx:12-15`**: metadata захардкожена ("НеСлавный — AI-тренажёр по книге «No More Mr. Nice Guy»", "46 упражнений из книги Роберта Гловера") → generateMetadata() динамически из БД

### Брендинг

- **`components/Sidebar.tsx:41-42`**: лого `НС` + текст `НеСлавный` → загружать из programs или показывать общее лого платформы
- **`app/layout.tsx:20-21`**: metadata `title: "НеСлавный"`, `description: "AI-тренажёр по книге «Хватит быть славным парнем»"` → общее название платформы (не привязанное к одной книге)
- **`app/auth/page.tsx:282`**: текст "НеСлавный" на странице логина → общее название
- **`app/legal/page.tsx:47,307`**: ссылки на `/program/nice-guy` → ссылка на главную `/`

### Тест ИССТ (ISSP) — специфичен для "Nice Guy"

- **`lib/issp-config.ts`**: 35 вопросов теста ИССТ — полностью специфичны для синдрома славного парня
- **`lib/issp-scoring.ts`**: подсчёт результатов по 7 шкалам ИССТ
- **`lib/issp-parser.ts`** (предположительно): парсинг ответов AI
- **`app/program/[slug]/(app)/test/page.tsx:94`**: текст "синдром славного парня"
- → для Берна нужен свой тест (или без теста). Тестовая система должна стать модульной: config вопросов и scoring привязаны к program_id

## Нужно создать с нуля

### Для второй программы (БД)
- **Запись в таблице `programs`**: slug `games-people-play`, title, description, system_prompt, free_chat_welcome, test_system_prompt, anonymous_system_prompt, landing_data, anonymous_quick_replies, config
- **Упражнения в таблице `exercises`**: упражнения по Берну с chapter, title, description, system_prompt, welcome_message
- **Промпт портрета для Берна**: новый файл `lib/prompts/portrait-analyst-bern.ts` или хранить промпт в таблице programs (поле `portrait_prompt`)

### Для универсальности (код)
- **Каталог программ `app/page.tsx`**: страница с карточками программ (загружать список programs из БД)
- **Таблица `chapters` или поле `programs.chapter_titles`**: JSON с названиями глав per-program
- **Шаблонная система портретов**: вместо `nice_guy_patterns` → `core_patterns` (универсальное), промпт портрета хранить в programs или в отдельных файлах
- **Модульная тестовая система**: config вопросов и scoring per-program (или поле programs.test_config JSON)
- **Промпт портрета для Берна**: адаптированный промпт с терминологией ТА (Родитель/Взрослый/Ребёнок, скрипты, игры, поглаживания)

## Рекомендуемый порядок шагов

### Этап 1: Универсальные редиректы и брендинг (быстро, не ломает текущее)
1. Вынести `DEFAULT_REDIRECT` в один общий конфиг (`lib/constants.ts`) — пока оставить `/program/nice-guy/chat`, но из одного места
2. Заменить захардкоженные `/program/nice-guy` в `PublicHeader`, `legal/page` на конфиг
3. Переименовать глобальный title/description в `layout.tsx` на общее название платформы

### Этап 2: Универсальная структура портрета
4. Переименовать `nice_guy_patterns` → `core_patterns` в `types/portrait.ts`
5. Обновить `portrait/page.tsx` — использовать `core_patterns`
6. Обновить `portrait-analyst.ts` — заменить `nice_guy_patterns` на `core_patterns` в JSON-формате
7. Добавить поле `portrait_prompt` в таблицу `programs` — хранить специализированный промпт портрета
8. В `portrait/update/route.ts` — загружать промпт из `programs.portrait_prompt` вместо импорта файла

### Этап 3: Динамические данные программы
9. Вынести `CHAPTER_TITLES` из кода — добавить поле `chapter_titles` (JSON) в таблицу `programs` или поле `chapter_title` в exercises
10. Заменить `TOTAL_EXERCISES = 46` на COUNT запрос из БД
11. Заменить `"46 упражнений"` в chat/page.tsx на данные из БД
12. Сделать `generateMetadata()` в `program/[slug]/page.tsx` — брать title/description из programs

### Этап 4: Каталог программ
13. Переделать `app/page.tsx` — из редиректа в каталог программ (список карточек из БД)
14. Обновить `DEFAULT_REDIRECT` в middleware/auth — редиректить на `/` (каталог)

### Этап 5: Модульные тесты
15. Добавить поле `test_config` (JSON) в programs — конфиг вопросов и шкал
16. Абстрагировать `issp-config.ts` / `issp-scoring.ts` — загружать конфиг per-program
17. Создать тест для программы Берна (или отключить тест для неё)

### Этап 6: Контент второй программы
18. Создать запись в `programs` для Берна (system_prompt, portrait_prompt, landing_data, etc.)
19. Создать упражнения в `exercises`
20. Создать лендинг-данные в `programs.landing_data`
21. Протестировать полный флоу: лендинг → регистрация → упражнения → портрет
