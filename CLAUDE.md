# CLAUDE.md — Nice Guy AI

Всегда общайся с пользователем на русском языке. Команды и код на английском, пояснения и вопросы — на русском.

## Проект

AI-платформа тренажёров по книгам. Первая программа — "No More Mr. Nice Guy" (Гловер), 46 упражнений.
Продакшен: nice-guy-ai.vercel.app

## Стек

- **Next.js 16** + TypeScript + Tailwind CSS 4
- **Supabase** — PostgreSQL + Auth (Magic Link, Telegram OIDC, Яндекс OAuth) + RLS
- **Google Gemini API** — Flash для чата (через Vercel AI SDK, `lib/ai.ts`), Pro для анализа портретов (`lib/gemini-portrait.ts`)
- **Vercel AI SDK** — стриминг чата (`streamText` + `toUIMessageStreamResponse`)
- **Vercel** — деплой из GitHub (автоматический)
- **YooKassa** — платежи (webhook, подписки, токены)
- **Sentry** — мониторинг ошибок (server, client, edge)

## Команды

```bash
npm run dev          # локальный сервер (localhost:3000)
npm run build        # проверка сборки перед деплоем
npm run lint         # линтер
npx tsc --noEmit     # проверка TypeScript без сборки
```

## Структура проекта

```
app/
├── page.tsx                              # Главная (каталог программ)
├── layout.tsx                            # Корневой layout + шрифты
├── globals.css                           # Все стили (CSS-переменные, лендинг)
├── global-error.tsx                      # Глобальная обработка ошибок (Sentry)
├── auth/page.tsx                         # Логин (AuthSheet fullscreen)
├── auth/callback/route.ts                # Magic Link callback
├── auth/popup-success/page.tsx           # Закрытие OAuth popup (postMessage)
├── auth/link-success/page.tsx            # Экран после Magic Link
├── auth/layout.tsx                       # Layout для auth-страниц
├── legal/page.tsx                        # Правовая информация
├── support-access/page.tsx               # Временная страница проверки YooKassa
├── balance/page.tsx                      # Redirect → /program/nice-guy/balance
├── test/results/[id]/page.tsx            # Redirect → /program/nice-guy/test/results/[id]
├── test/issp/page.tsx                    # Redirect → /program/nice-guy/test/issp
├── test/debug/page.tsx                   # Debug-страница тестов
├── program/[slug]/
│   ├── page.tsx                          # Лендинг программы (вне (app)/, без sidebar)
│   └── (app)/                            # Группа с Sidebar + MobileTabs layout
│       ├── layout.tsx                    # Sidebar (если auth) + авторизация
│       ├── chat/page.tsx                 # Список чатов / новый свободный чат
│       ├── chat/[chatId]/page.tsx        # Конкретный чат по ID
│       ├── author-chat/page.tsx          # Разговор с автором (AI в роли Гловера)
│       ├── exercises/page.tsx            # Список упражнений
│       ├── exercise/[number]/page.tsx    # Чат по упражнению
│       ├── exercise/[number]/[chatId]/page.tsx  # Чат упражнения по ID
│       ├── portrait/page.tsx             # Психологический портрет
│       ├── balance/page.tsx              # Тариф и оплата (protected)
│       ├── test/page.tsx                 # Промежуточная страница теста (public)
│       ├── test/issp/page.tsx            # Тест ISSP (public)
│       └── test/results/[id]/page.tsx    # Результаты теста (public)
├── api/
│   ├── chat/route.ts                     # AI-чат (авторизованный, Vercel AI SDK стриминг)
│   ├── chat/anonymous/route.ts           # AI-чат (анонимный, для лендинга)
│   ├── chat/migrate/route.ts             # Миграция анонимных чатов после авторизации
│   ├── chats/route.ts                    # Список чатов пользователя
│   ├── chats/[id]/route.ts               # GET/DELETE конкретного чата
│   ├── portrait/route.ts                 # GET портрет
│   ├── portrait/update/route.ts          # Обновление портрета (Gemini Pro)
│   ├── test/route.ts                     # Создание теста ISSP
│   ├── test/answer/route.ts              # Отправка ответа на вопрос теста
│   ├── test/result/route.ts              # Получение результата теста
│   ├── test/results/[id]/route.ts        # Результаты по ID (публичный)
│   ├── test/migrate/route.ts             # Миграция анонимных тестов
│   ├── test/debug/route.ts               # Debug-эндпоинт тестов
│   ├── payments/create/route.ts          # Создание платежа YooKassa
│   ├── payments/status/route.ts          # Проверка статуса платежа
│   ├── payments/webhook/route.ts         # Webhook YooKassa
│   ├── payments/cancel-subscription/route.ts  # Отмена подписки
│   ├── payments/unlink-card/route.ts     # Отвязка карты
│   ├── transcribe/route.ts              # Speech-to-text (голосовой ввод)
│   ├── auth/dev-login/route.ts           # Dev-логин (только dev)
│   ├── auth/telegram/verify/route.ts     # Верификация Telegram JWT
│   ├── auth/yandex/route.ts              # Инициация Яндекс OAuth
│   └── auth/yandex/callback/route.ts     # Яндекс OAuth callback
components/
├── ChatWindow.tsx                        # Основной чат (стриминг, markdown, retry)
├── ChatHeader.tsx                        # Заголовок чата (название, действия)
├── ChatListItem.tsx                      # Элемент списка чатов
├── ChatErrorBoundary.tsx                 # Error boundary для чата
├── MobileChatHeader.tsx                  # Мобильный заголовок чата
├── MobileChatList.tsx                    # Мобильный список чатов
├── Sidebar.tsx                           # Десктоп-навигация
├── MobileTabs.tsx                        # Мобильная навигация
├── ProfileMenu.tsx                       # Меню профиля пользователя
├── PreviousSessions.tsx                  # Предыдущие сессии чатов
├── AuthSheet.tsx                         # Единый компонент авторизации (sheet/fullscreen)
├── AnonymousChat.tsx                     # Анонимный чат на лендинге
├── BalanceClient.tsx                     # Клиентская часть страницы баланса
├── PublicHeader.tsx                      # Хедер для публичных страниц
├── TestCardFlow.tsx                      # Оркестратор тест-flow (ISSP)
├── InputBar/                             # Текстовый + голосовой ввод
│   ├── InputBar.tsx                      # Компонент ввода сообщений
│   └── useInputBar.ts                    # Хук логики ввода
├── test/                                 # Компоненты ISSP-теста
│   ├── WelcomeScreen.tsx                 # Приветствие теста
│   ├── QuestionScreen.tsx                # Экран вопроса
│   ├── CompletionScreen.tsx              # Завершение теста
│   ├── AnalyzingScreen.tsx               # Экран анализа результатов
│   ├── HistoryScreen.tsx                 # История прохождений
│   └── BlockTransition.tsx               # Анимация перехода между блоками
├── test-results/                         # Компоненты результатов теста
│   ├── TestResultsPage.tsx               # Страница результатов
│   ├── RadarChart.tsx                    # Радар-диаграмма шкал
│   ├── ShareButtons.tsx                  # Кнопки шаринга
│   ├── useCountUp.ts                     # Анимация счётчика
│   └── useScrollReveal.ts               # Анимация при скролле
├── landing/                              # Секции лендинга программы
│   ├── LandingHeader.tsx                 # Хедер лендинга
│   ├── LandingFooter.tsx                 # Футер лендинга
│   ├── HeroSection.tsx                   # Герой-секция
│   ├── TestSection.tsx                   # Секция теста
│   ├── ChatSection.tsx                   # Секция чата
│   ├── HowItWorksSection.tsx             # Как это работает
│   ├── ComparisonSection.tsx             # Сравнение
│   ├── OutcomesSection.tsx               # Результаты
│   ├── AuthorSection.tsx                 # Об авторе
│   ├── PersonasSection.tsx               # Для кого
│   └── SocialProof.tsx                   # Социальное доказательство
lib/
├── ai.ts                                 # Конфигурация Google Generative AI (Vercel AI SDK)
├── supabase.ts                           # Клиент (браузер)
├── supabase-server.ts                    # Клиент (сервер) + Service Client
├── gemini-portrait.ts                    # analyzeForPortrait() — Gemini Pro
├── config.ts                             # getConfig() — app_config из БД с кешем
├── products.ts                           # Каталог продуктов (токены, подписки)
├── yookassa.ts                           # Клиент YooKassa
├── yandex-auth.ts                        # Яндекс OAuth логика
├── telegram-auth.ts                      # Telegram OIDC верификация
├── oauth-common.ts                       # Общая OAuth логика (findOrCreateUser)
├── constants.ts                          # Константы приложения
├── time.ts                               # Форматирование относительного времени
├── utils.ts                              # Утилиты (toUIMessages и др.)
├── issp-config.ts                        # Конфигурация шкал ISSP
├── issp-scoring.ts                       # Подсчёт баллов ISSP
├── issp-parser.ts                        # Парсинг ответов ISSP
├── issp-interpretation.ts                # Интерпретация результатов ISSP
├── prompts/portrait-analyst.ts           # Промпт для анализа портрета
├── prompts/issp-mini-prompt.ts           # Промпт мини-анализа ISSP
hooks/
├── useVoiceInput.ts                      # Голосовой ввод (запись + транскрипция)
contexts/
├── ChatListContext.tsx                    # Контекст списка чатов (React Context)
types/
├── portrait.ts                           # Типы + EMPTY_PORTRAIT
├── yookassa.d.ts                         # Типы YooKassa API
middleware.ts                             # Auth guard для защищённых страниц
instrumentation.ts                        # Sentry серверная инструментация
sentry.server.config.ts                   # Sentry конфиг (сервер)
sentry.client.config.ts                   # Sentry конфиг (клиент)
sentry.edge.config.ts                     # Sentry конфиг (edge)
```

## Ключевые паттерны (используй как образец)

### Supabase-клиент
- Браузер: `import { createClient } from "@/lib/supabase"` 
- Сервер (с cookies): `import { createClient } from "@/lib/supabase-server"`
- Service role (обход RLS): `import { createServiceClient } from "@/lib/supabase-server"`

### API routes — AI SDK стриминг
Паттерн в `app/api/chat/route.ts`: Vercel AI SDK `streamText()` + `toUIMessageStreamResponse()`.
Модель: `google("gemini-2.5-flash")` через `lib/ai.ts` (`createGoogleGenerativeAI()`).

### Авторизация
- Единый компонент `AuthSheet.tsx` — все точки авторизации (sheet/fullscreen режимы)
- Middleware (`middleware.ts`) защищает `/program/*/...` и `/balance`, пропускает `/api/auth/*` и popup flow
- Тройное обнаружение: postMessage + onAuthStateChange + polling getUser()
- `auth.uid()` в RLS-политиках Supabase работает для всех провайдеров
- Подробности — см. секцию «Авторизация» ниже

### chatType в API
`chatType: "free" | "author" | "exercise"` — тип чата, передаётся из ChatWindow в API для выбора системного промпта.
`"author"` использует `programs.author_chat_system_prompt` вместо `programs.system_prompt`.
`"exercise"` определяется автоматически при наличии `exerciseId`.

### Таблица profiles (не users!)
Профили хранятся в `profiles`, не `users`. Поля: id, email, name, balance_tokens, telegram_username, avatar_url.

### Конфигурация из БД
`lib/config.ts` — `getConfig<T>(key, default)` читает из таблицы `app_config` с кешем 60с.

## Дизайн

- Три цветовые системы через CSS-переменные в `globals.css`:
  - **Тёмная тема (основная):** фон `--bg-main: #111318`, карточки `--bg-card: #1C1F26`, акцент `--accent: #D4A545` (золотой)
  - **Светлая тема (auth):** `--auth-bg: #FAFAF5`, `--auth-bg-card: #FFFFFF`, `--auth-accent: #C9963B`
  - **Тест-результаты:** `--tr-bg: #0f1114`, `--tr-bg2: #16181d`, `--tr-gold: #c9a84c` (отдельные токены)
- Шрифты: Cormorant Garamond `--font-cormorant` (заголовки), Onest `--font-onest` (текст)
- Стили: в основном в `globals.css` (CSS-переменные), Tailwind для утилит
- Мобильная адаптация: Sidebar скрывается, MobileTabs внизу

## Как добавить новую страницу в кабинет

1. Создать папку в `app/program/[slug]/(app)/`
2. Layout, sidebar, контейнер — автоматически
3. По умолчанию страница **PROTECTED** (требует auth) — middleware блокирует анонимов
4. Если страница должна быть **PUBLIC** (доступна без логина):
   - Добавить regex exception в `middleware.ts` → `isProtected()` ПЕРЕД основным regex
   - Пример: `if (/^\/program\/[^/]+\/test\//.test(pathname)) return false;`
5. Sidebar показывается автоматически для залогиненных, скрывается для анонимов (решает layout)
6. Для разного контента по auth: в page.tsx проверять user через `supabase.auth.getUser()`

### URL-структура кабинета

| URL | Доступ | Описание |
|-----|--------|----------|
| `/program/[slug]/(app)/chat` | protected | Список чатов / новый свободный чат |
| `/program/[slug]/(app)/chat/[chatId]` | protected | Конкретный чат по ID |
| `/program/[slug]/(app)/author-chat` | protected | Разговор с автором |
| `/program/[slug]/(app)/exercises` | protected | Список упражнений |
| `/program/[slug]/(app)/exercise/[number]` | protected | Чат по упражнению |
| `/program/[slug]/(app)/exercise/[number]/[chatId]` | protected | Чат упражнения по ID |
| `/program/[slug]/(app)/portrait` | protected | Психологический портрет |
| `/program/[slug]/(app)/balance` | protected | Тариф и оплата |
| `/program/[slug]/(app)/test` | public | Промежуточная страница теста |
| `/program/[slug]/(app)/test/issp` | public | Тест ISSP |
| `/program/[slug]/(app)/test/results/[id]` | public | Результаты теста |

Старые URL (`/balance`, `/test/results/[id]`, `/test/issp`) — redirect-заглушки.

## Авторизация

### Архитектура
Единый компонент `components/AuthSheet.tsx` — все точки авторизации в проекте.
Два режима:
- **sheet** — bottom sheet снизу экрана (тест Q34, чат на лендинге). Scrim + blur, grab handle, slide-up анимация.
- **fullscreen** — карточка по центру с логотипом (страница /auth).

Три контекста (контекстные заголовки):
- `test` — «Сохрани свой результат» (TestCardFlow, phase=auth_wall)
- `chat` — «Продолжим разговор?» (AnonymousChat, лимит сообщений)
- `default` — «Войти в аккаунт» (страница /auth, middleware redirect)

### Методы входа
- **Telegram** — OIDC SDK (`oauth.telegram.org/js/telegram-login.js`), inline popup
- **Яндекс** — OAuth popup через window.open, callback → /auth/popup-success
- **Email (Magic Link)** — signInWithOtp, поле видно сразу (не за ссылкой), ссылка на почтовый сервис после отправки

### Обнаружение авторизации (тройное, параллельное)
1. postMessage — мгновенный сигнал от popup (десктоп)
2. onAuthStateChange — Supabase cross-tab синхронизация (Magic Link, мобилка)
3. polling getUser() каждые 3 сек — fallback

calledRef паттерн — onSuccess вызывается ровно один раз.

### Callback-страницы
- `/auth/popup-success` — для закрытия OAuth popup (postMessage + window.close)
- `/auth/link-success` — экран после Magic Link ("Вернитесь на вкладку")

### Визуал
Светлая тема, CSS variables с префиксом --auth-* (не конфликтуют с тёмной темой приложения).

### Файлы
- `components/AuthSheet.tsx` — единый компонент
- `app/auth/page.tsx` — страница /auth (AuthSheet fullscreen)
- `app/auth/popup-success/page.tsx` — закрытие popup
- `app/auth/link-success/page.tsx` — экран после Magic Link
- `app/auth/callback/route.ts` — обработка Magic Link callback
- `app/api/auth/yandex/route.ts` — инициация Яндекс OAuth
- `app/api/auth/yandex/callback/route.ts` — обработка Яндекс callback
- `app/api/auth/telegram/verify/route.ts` — верификация Telegram JWT
- `lib/telegram-auth.ts` — Telegram OIDC верификация
- `lib/oauth-common.ts` — общая OAuth логика (findOrCreateUser с fallback)
- `middleware.ts` — защита routes, исключение для popup flow

### ENV variables (Telegram)
- `NEXT_PUBLIC_TELEGRAM_BOT_ID` — Bot ID (клиент + audience check)
- `TELEGRAM_CLIENT_SECRET` — Bot Token (HMAC для генерации пароля Supabase)

### Удалено
- `components/InChatAuth.tsx` — заменён AuthSheet
- CSS `.in-chat-auth-*` — удалены
- Inline styles в auth/page.tsx — удалены

## Важные нюансы

- Telegram Bot ID — через `NEXT_PUBLIC_TELEGRAM_BOT_ID` env variable
- Яндекс OAuth Client ID `ce4f585bbcd846d9bc025c28a60ebe6e`
- Фейковые email для OAuth: `tg_XXX@niceguy.local`, `ya_XXX@niceguy.local`
- Баланс токенов — общий для аккаунта, страница `/program/[slug]/balance`
- Портрет обновляется автоматически каждые N сообщений (вызов из chat/route.ts)
- Welcome messages хранятся в `exercises.welcome_message`, `programs.free_chat_welcome`, `programs.author_chat_welcome`
- Gemini Flash для чата — через Vercel AI SDK (`lib/ai.ts`), Gemini Pro для портрета — напрямую (`lib/gemini-portrait.ts`)
- YooKassa интеграция: webhook, создание платежа, статус, отвязка карты, отмена подписки
- Голосовой ввод: `hooks/useVoiceInput.ts` + `app/api/transcribe/route.ts`
- ISSP тест: полный flow от создания (`/api/test`) до результатов (`/api/test/result`), UI в `components/test/` и `components/test-results/`
- Управление чатами: `contexts/ChatListContext.tsx`, API `/api/chats/*`
- Каталог продуктов (токены, подписки): `lib/products.ts`

## Правила

- Перед изменениями в нескольких файлах — сначала озвучь план
- Не меняй `.env.local` без явного запроса
- При ошибке — ищи корневую причину, не обходной путь
- Серверные env-переменные недоступны на клиенте — публичные данные хардкодить

## Правила при написании нового кода

- **Новый API-роут**: используй `requireAuth()` и `apiError()` из `lib/api-helpers.ts` — не пиши проверку auth вручную
- **Запрос к profiles/chats/exercises/messages**: используй хелпер из `lib/queries/`, не пиши Supabase-запрос заново
- **Не хардкодь slug программы** — используй параметр из URL или `DEFAULT_PROGRAM_SLUG` из `lib/constants.ts`
- **Не хардкодь URL приложения** — используй `APP_URL` из `lib/constants.ts`
- **Новая страница программы** (`app/program/[slug]/(app)/`): проверяй features через `requireProgramFeature()` из `lib/queries/program.ts`
- **Файл > 300 строк** — подумай о разделении на модули
- **Новый компонент** не должен напрямую вызывать `supabase.from()` — данные через props или API
- **Все функции в `lib/`** должны иметь явные типы параметров и возврата
- **Контент программы** (обложка, автор, описание): бери из `programs.landing_data`, не хардкодь
- **Проверка**: запусти `npm run check` перед коммитом — ищет типичные хардкоды

## Git commits

- After completing a task, commit each logical change separately, not everything in one commit
- Use conventional commit format: refactor:, fix:, feat:, chore:
- Each commit should be independently revertable without breaking other changes
- If a task involves multiple logical steps (e.g. extract util + update imports + remove dead code), make separate commits for each

## Тестирование в браузере

- Перед тестированием защищённых страниц зайди на `http://localhost:3000/api/auth/dev-login`
- Это создаст тестовую сессию (dev_test@niceguy.local) и перенаправит в приложение
- Работает ТОЛЬКО в dev-окружении, в production возвращает 404
- После этого можно тестировать любые защищённые страницы

## Правило интеграционной проверки (Data Flow Verification)

**Контекст:** Мы несколько раз ловили баг, когда новый компонент проходил TypeScript и build, но в runtime данные не доходили через props/SSE/API. Причина — проверялась корректность кода, но не проверялась цепочка передачи данных между компонентами.

### Когда применять

Каждый раз, когда компонент получает данные извне (props от родителя, SSE-события, API-ответы, URL params) — и эти данные критичны для работы (без них компонент ломается или зависает).

### Что делать

**1. В промпте/плане — секция DATA FLOW:**

Для каждого внешнего значения описать полную цепочку:

```
## DATA FLOW

### resultId
- ИСТОЧНИК: /api/test/result → поле result_id в JSON
- ПУТЬ: TestCardFlow polling → setResultId(id) → <AnalyzingScreen resultId={resultId}>
- ФОРМАТ: string (UUID) | null
- КОГДА ПОЯВЛЯЕТСЯ: через 5-30 сек после 35-го ответа (фоновый after() на сервере)
```

Если цепочка содержит больше 2 звеньев — это red flag, нужно проверять каждое.

**2. В коде — dev-mode warning для критических ожиданий:**

```typescript
// Добавлять в компоненты, которые ЖДУТ внешние данные и ломаются без них
useEffect(() => {
  if (process.env.NODE_ENV !== 'development') return;
  const t = setTimeout(() => {
    if (!criticalProp) {
      console.error(
        `[ComponentName] criticalProp is still null after 10s. ` +
        `Data flow: ParentComponent → setCriticalProp → <ComponentName criticalProp={...}>. ` +
        `Check that parent actually sets this value.`
      );
    }
  }, 10000);
  return () => clearTimeout(t);
}, [criticalProp]);
```

Сообщение должно содержать: имя компонента, имя prop, ожидаемую цепочку данных.

**3. После реализации — runtime-проверка перед коммитом:**

Не считать задачу выполненной только потому что `tsc --noEmit` и `npm run build` прошли. Для компонентов с внешними данными — обязательно:

- Открыть в браузере (или `npm run dev`)
- Проверить что данные реально приходят (Network tab / console.log)
- Убедиться что полный пользовательский путь работает, а не только изолированный компонент

### Типичные ловушки

| Ловушка | Как ловить |
|---------|-----------|
| Компонент рендерится, но prop всегда null | Dev-mode warning (см. выше) |
| SSE-событие отправляется, но фронт не читает стрим | Проверить что reader не убит при смене state/phase |
| API возвращает данные после response (after/background job) | Нужен polling или webhook, а не надежда на синхронный ответ |
| fire-and-forget fetch — ответ сервера игнорируется | Если из ответа нужны данные — это НЕ fire-and-forget |
| TypeScript доволен, но значение undefined в runtime | TypeScript не проверяет что данные реально придут, только типы |

### Мнемоника

> "Билд прошёл ≠ данные дошли." TypeScript проверяет форму, а не содержание. Каждый prop с внешними данными — проверить в runtime.

## Правила планирования

### Перед любым изменением — исследование
Не начинай писать код пока не ответил на:
1. Какие файлы затронуты? Прочитай каждый.
2. Какие данные уже есть на сервере/в storage? Не дублируй.
3. Какие edge cases? (перезагрузка, мобилка, потеря сети, две вкладки)
4. Что сломается если этот код упадёт? Есть ли fallback?

### Самопроверка плана
Перед выполнением плана проверь:
- Middleware: не заблокирует ли новые routes?
- Существующие компоненты: кто ещё использует то что ты меняешь?
- Props: все ли нужные props описаны? Сравни с тем как компонент используется.
- Redirect chain: пройди весь путь пользователя от клика до возврата.
```

Это не магия — Claude Code буквально следует инструкциям из CLAUDE.md. Чем конкретнее правила, тем лучше результат.

## Паттерн «сначала вопросы, потом план»

Вместо одного большого промпта — разбивай на два сообщения:

**Сообщение 1 — исследование:**
```
Прочитай файлы X, Y, Z. Ответь на вопросы:
1. Как работает flow от A до B?
2. Где хранится состояние?
3. Что произойдёт если [конкретный сценарий]?
Не пиши код. Только ответы.
```

**Сообщение 2 — план (после ревью ответов):**
```
На основе того что ты нашёл — предложи план.
Для каждого файла: что меняется, от чего зависит.
```

Два сообщения вместо одного дают тебе точку контроля — ты видишь что он нашёл, и можешь скорректировать до того как он начнёт планировать.

## Паттерн «роли-проверщики» в промпте

То что я делаю при ревью — проверяю план с разных ролей. Можешь закодировать это прямо в промпт:
```
После составления плана проверь его сам:

Как РАЗРАБОТЧИК: компилируется ли? Все ли imports/exports на месте?
Как АРХИТЕКТОР: нет ли дублирования? Не создаёшь ли второй путь 
  для того же? Все ли edge cases покрыты?
Как ТЕСТИРОВЩИК: пройди руками путь пользователя по каждому 
  сценарию. Каждый redirect — куда ведёт? Middleware — пропустит?
Как ПРОДУКТ: пользователь видит что ожидает? Нет ли моментов 
  где он «застрянет» не понимая что делать?

Если нашёл проблему — исправь план и явно напиши что нашёл.