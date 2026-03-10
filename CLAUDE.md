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