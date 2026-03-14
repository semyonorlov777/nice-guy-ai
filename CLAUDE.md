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
├── auth/page.tsx                         # Логин (Telegram/Яндекс/Magic Link)
├── auth/callback/route.ts                # Supabase OAuth callback
├── balance/page.tsx                      # Тариф и оплата (общий, не привязан к программе)
├── program/[slug]/
│   ├── page.tsx                          # Лендинг программы
│   └── (app)/                            # Группа с Sidebar + MobileTabs layout
│       ├── layout.tsx                    # Sidebar + авторизация
│       ├── chat/page.tsx                 # Свободный чат
│       ├── author-chat/page.tsx          # Разговор с автором (AI в роли Гловера)
│       ├── exercises/page.tsx            # Список упражнений
│       ├── exercise/[id]/page.tsx        # Чат по упражнению
│       └── portrait/page.tsx             # Психологический портрет
├── api/
│   ├── chat/route.ts                     # AI-чат (авторизованный, SSE стриминг)
│   ├── chat/anonymous/route.ts           # AI-чат (анонимный, для лендинга)
│   ├── portrait/route.ts                 # GET портрет
│   ├── portrait/update/route.ts          # Обновление портрета (Gemini Pro)
│   ├── auth/telegram/route.ts            # Telegram OIDC
│   └── auth/yandex/callback/route.ts     # Яндекс OAuth callback
components/
├── ChatWindow.tsx                        # Основной чат (стриминг, markdown, retry)
├── Sidebar.tsx                           # Десктоп-навигация
├── MobileTabs.tsx                        # Мобильная навигация
├── InChatAuth.tsx                        # Авторизация прямо в чате (popup)
├── BalanceClient.tsx                     # Клиентская часть страницы баланса
├── PublicHeader.tsx                      # Хедер для публичных страниц
lib/
├── supabase.ts                           # Клиент (браузер)
├── supabase-server.ts                    # Клиент (сервер) + Service Client
├── gemini.ts                             # streamChat() — Gemini Flash
├── gemini-portrait.ts                    # analyzeForPortrait() — Gemini Pro
├── config.ts                             # getConfig() — app_config из БД с кешем
├── yandex-auth.ts                        # Яндекс OAuth логика
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
- Middleware (`middleware.ts`) защищает `/program/*/...` и `/balance`
- Пропускает `/api/auth/*` без проверки
- `auth.uid()` в RLS-политиках Supabase работает для всех провайдеров

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

## Важные нюансы

- Telegram Bot ID `8544302305` захардкожен — это публичный ID, безопасно
- Яндекс OAuth Client ID `ce4f585bbcd846d9bc025c28a60ebe6e`
- Фейковые email для OAuth: `tg_XXX@niceguy.local`, `ya_XXX@niceguy.local`
- Баланс токенов — общий для аккаунта, страница `/balance` (не `/program/.../balance`)
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