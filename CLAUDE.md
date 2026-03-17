# CLAUDE.md — Nice Guy AI

Всегда общайся с пользователем на русском языке. Команды и код на английском, пояснения и вопросы — на русском.

## Проект

AI-платформа тренажёров по книгам. Первая программа — "No More Mr. Nice Guy" (Гловер), 46 упражнений.
Продакшен: nice-guy-ai.vercel.app

## Стек

- **Next.js 16** + TypeScript + Tailwind CSS 4
- **Supabase** — PostgreSQL + Auth (Magic Link, Telegram OIDC, Яндекс OAuth) + RLS
- **Google Gemini API** — Flash для чата, Pro для анализа портретов
- **Vercel** — деплой из GitHub (автоматический)
- **YooKassa** — платежи (на модерации)

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
├── globals.css                           # Все стили (включая лендинг)
├── auth/page.tsx                         # Логин (AuthSheet fullscreen)
├── auth/callback/route.ts                # Magic Link callback
├── auth/popup-success/page.tsx           # Закрытие OAuth popup (postMessage)
├── auth/link-success/page.tsx            # Экран после Magic Link
├── auth/layout.tsx                       # Layout для auth-страниц
├── balance/page.tsx                      # Redirect → /program/nice-guy/balance
├── test/results/[id]/page.tsx            # Redirect → /program/nice-guy/test/results/[id]
├── test/issp/page.tsx                    # Redirect → /program/nice-guy/test/issp
├── program/[slug]/
│   ├── page.tsx                          # Лендинг программы (вне (app)/, без sidebar)
│   └── (app)/                            # Группа с Sidebar + MobileTabs layout
│       ├── layout.tsx                    # Sidebar (если auth) + авторизация
│       ├── chat/page.tsx                 # Свободный чат
│       ├── author-chat/page.tsx          # Разговор с автором (AI в роли Гловера)
│       ├── exercises/page.tsx            # Список упражнений
│       ├── exercise/[id]/page.tsx        # Чат по упражнению
│       ├── portrait/page.tsx             # Психологический портрет
│       ├── balance/page.tsx              # Тариф и оплата (protected)
│       ├── test/issp/page.tsx            # Тест ISSP (public)
│       └── test/results/[id]/page.tsx    # Результаты теста (public)
├── api/
│   ├── chat/route.ts                     # AI-чат (авторизованный, SSE стриминг)
│   ├── chat/anonymous/route.ts           # AI-чат (анонимный, для лендинга)
│   ├── portrait/route.ts                 # GET портрет
│   ├── portrait/update/route.ts          # Обновление портрета (Gemini Pro)
│   ├── auth/telegram/verify/route.ts     # Верификация Telegram JWT
│   ├── auth/yandex/route.ts              # Инициация Яндекс OAuth
│   └── auth/yandex/callback/route.ts     # Яндекс OAuth callback
components/
├── ChatWindow.tsx                        # Основной чат (стриминг, markdown, retry)
├── Sidebar.tsx                           # Десктоп-навигация
├── MobileTabs.tsx                        # Мобильная навигация
├── AuthSheet.tsx                         # Единый компонент авторизации (sheet/fullscreen)
├── AnonymousChat.tsx                     # Анонимный чат на лендинге
├── BalanceClient.tsx                     # Клиентская часть страницы баланса
├── PublicHeader.tsx                      # Хедер для публичных страниц
lib/
├── supabase.ts                           # Клиент (браузер)
├── supabase-server.ts                    # Клиент (сервер) + Service Client
├── gemini.ts                             # streamChat() — Gemini Flash
├── gemini-portrait.ts                    # analyzeForPortrait() — Gemini Pro
├── config.ts                             # getConfig() — app_config из БД с кешем
├── yandex-auth.ts                        # Яндекс OAuth логика
├── telegram-auth.ts                      # Telegram OIDC верификация
├── oauth-common.ts                       # Общая OAuth логика (findOrCreateUser)
├── prompts/portrait-analyst.ts           # Промпт для анализа портрета
types/
├── portrait.ts                           # Типы + EMPTY_PORTRAIT
middleware.ts                             # Auth guard для защищённых страниц
```

## Ключевые паттерны (используй как образец)

### Supabase-клиент
- Браузер: `import { createClient } from "@/lib/supabase"` 
- Сервер (с cookies): `import { createClient } from "@/lib/supabase-server"`
- Service role (обход RLS): `import { createServiceClient } from "@/lib/supabase-server"`

### API routes — SSE стриминг
Паттерн в `app/api/chat/route.ts`: ReadableStream + encoder + `data: JSON\n\n` формат.
Типы событий: `delta` (текст), `chat_id` (новый чат), `done`, `error`.

### Авторизация
- Единый компонент `AuthSheet.tsx` — все точки авторизации (sheet/fullscreen режимы)
- Middleware (`middleware.ts`) защищает `/program/*/...` и `/balance`, пропускает `/api/auth/*` и popup flow
- Тройное обнаружение: postMessage + onAuthStateChange + polling getUser()
- `auth.uid()` в RLS-политиках Supabase работает для всех провайдеров
- Подробности — см. секцию «Авторизация» ниже

### chatType в API
`chatType: "free" | "author"` — тип чата, передаётся из ChatWindow в API для выбора системного промпта.
`"author"` использует `programs.author_chat_system_prompt` вместо `programs.system_prompt`.

### Таблица profiles (не users!)
Профили хранятся в `profiles`, не `users`. Поля: id, email, name, balance_tokens, telegram_username, avatar_url.

### Конфигурация из БД
`lib/config.ts` — `getConfig<T>(key, default)` читает из таблицы `app_config` с кешем 60с.

## Дизайн

- Тёмная тема: фон #0f1114, карточки #16181d, акцент #c9a84c (золотой)
- Шрифты: Cormorant Garamond (заголовки), Onest (текст)
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
| `/program/[slug]/(app)/chat` | protected | Свободный чат |
| `/program/[slug]/(app)/exercises` | protected | Список упражнений |
| `/program/[slug]/(app)/exercise/[n]` | protected | Чат по упражнению |
| `/program/[slug]/(app)/portrait` | protected | Психологический портрет |
| `/program/[slug]/(app)/balance` | protected | Тариф и оплата |
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
- Welcome messages хранятся в exercises.welcome_message и programs.free_chat_welcome
- Gemini требует чтобы история начиналась с "user" — welcome-сообщения фильтруются

## Правила

- Коммить после каждой завершённой подзадачи с описательным сообщением на русском
- Перед изменениями в нескольких файлах — сначала озвучь план
- Не меняй `.env.local` без явного запроса
- При ошибке — ищи корневую причину, не обходной путь
- Серверные env-переменные недоступны на клиенте — публичные данные хардкодить

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