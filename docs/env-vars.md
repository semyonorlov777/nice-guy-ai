# Справочник переменных окружения

Все переменные хранятся в `.env.local` (не коммитится в git).

## NEXT_PUBLIC_ (доступны на клиенте)

| Переменная | Описание | Обязательная | Где используется |
|-----------|----------|:---:|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase проекта | ✅ | `lib/supabase.ts`, `lib/supabase-server.ts`, `middleware.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Публичный anon key Supabase | ✅ | `lib/supabase.ts`, `lib/supabase-server.ts`, `middleware.ts` |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Username Telegram-бота для login link `t.me/<bot>?start=<code>` (без `@`). См. [runbook](runbooks/telegram-bot-setup.md). | ✅ | `lib/telegram-login.ts` |
| `NEXT_PUBLIC_TELEGRAM_BOT_ID` | Bot ID (числовая часть до `:` в bot token). Сейчас в коде не используется — оставлен в env для возможной будущей логики. | ❌ | — |
| `NEXT_PUBLIC_SITE_URL` | URL сайта (для redirect'ов, OG) | ✅ | `lib/constants.ts`, `app/api/payments/create/route.ts` |
| `NEXT_PUBLIC_APP_URL` | URL приложения (fallback) | ❌ | `lib/constants.ts` |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN для клиентского мониторинга | ❌ | `sentry.client.config.ts` |
| `NEXT_PUBLIC_DEBUG_ENABLED` | Включить debug-страницы (`"true"`) | ❌ | `app/test/debug/page.tsx` |
| `NEXT_PUBLIC_ENABLE_MAX_TROLL` | Включает шуточную кнопку «Войти через Мах» в `AuthSheet` (`"1"` — включено, иначе выкл). Kill switch — убирается за ~2 мин через Vercel Dashboard без коммита. | ❌ | `components/AuthSheet.tsx` |

## Server-only (только сервер)

### Supabase

| Переменная | Описание | Обязательная |
|-----------|----------|:---:|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (обход RLS) | ✅ |

### AI / LLM

| Переменная | Описание | Обязательная |
|-----------|----------|:---:|
| `GOOGLE_GEMINI_API_KEY` | Google Gemini API key | ✅ |
| `GEMINI_CHAT_MODEL` | Модель для чата и обработки тестов (default: `gemini-2.5-flash`, рекомендуется: `gemini-3-flash-preview`) | ❌ |
| `GEMINI_PORTRAIT_MODEL` | Модель для портрета (default: `gemini-2.5-pro`) | ❌ |

> ⚠️ Vercel AI SDK по умолчанию ищет `GOOGLE_GENERATIVE_AI_API_KEY`. У нас кастомное имя `GOOGLE_GEMINI_API_KEY` — настроено в `lib/ai.ts`. См. [ADR-001](adr/001-dual-ai-sdk.md).

### OAuth

| Переменная | Описание | Обязательная |
|-----------|----------|:---:|
| `TELEGRAM_CLIENT_SECRET` | Telegram Bot Token (для Bot API запросов + HMAC-паролей Supabase) | ✅ |
| `TELEGRAM_WEBHOOK_SECRET` | Случайный секрет, передаваемый в `setWebhook?secret_token=...`. Telegram шлёт его в header `X-Telegram-Bot-Api-Secret-Token` при каждом вызове webhook — защищает от поддельных запросов. См. [runbook](runbooks/telegram-bot-setup.md). | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | ✅ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | ✅ |
| `YANDEX_CLIENT_ID` | Яндекс OAuth Client ID | ✅ |
| `YANDEX_CLIENT_SECRET` | Яндекс OAuth Client Secret | ✅ |

> OAuth-провайдеры используют HMAC-пароли и fake emails. См. [ADR-002](adr/002-unified-oauth.md).

### Платежи (YooKassa)

| Переменная | Описание | Обязательная |
|-----------|----------|:---:|
| `YOOKASSA_SHOP_ID` | ID магазина YooKassa | ✅ |
| `YOOKASSA_SECRET_KEY` | Secret key YooKassa API | ✅ |
| `YOOKASSA_WEBHOOK_SECRET` | Секрет для верификации webhook'ов | ✅ |

### Безопасность / Мониторинг

| Переменная | Описание | Обязательная |
|-----------|----------|:---:|
| `INTERNAL_API_SECRET` | Секрет для внутренних API (портрет) | ✅ |
| `SENTRY_DSN` | Sentry DSN (серверный) | ❌ |
| `SENTRY_AUTH_TOKEN` | Sentry token для source map upload | ❌ |
| `OPENAI_API_KEY` | OpenAI API key для транскрипции (`gpt-4o-mini-transcribe`). Используется голосовым вводом основного чата. | ❌ |

### Мини-проект voice (mini/voice)

Отдельный Telegram-бот для голосовых заметок. Только в `mini/voice/`. Транскрипция идёт через общий `GOOGLE_GEMINI_API_KEY`.

| Переменная | Описание | Обязательная |
|-----------|----------|:---:|
| `VOICE_BOT_TOKEN` | Bot Token нового бота (не auth-бота) от @BotFather. | ❌ (нужна если используется Telegram-канал) |
| `VOICE_BOT_WEBHOOK_SECRET` | Случайный hex 32+ байт. Telegram передаёт в header `X-Telegram-Bot-Api-Secret-Token`. | ❌ |
| `VOICE_OWNER_TG_CHAT_ID` | Числовой chat_id владельца. Бот игнорирует voice от других. | ❌ |
| `VOICE_TRANSCRIBE_MODEL` | Модель Gemini для транскрипции. Default: `gemini-2.5-flash`. | ❌ |

## Системные (автоматические)

| Переменная | Описание |
|-----------|----------|
| `NODE_ENV` | `development` / `production` (автоматически) |
| `NEXT_RUNTIME` | `nodejs` / `edge` (автоматически) |
| `CI` | `true` в CI-окружении |

## Quick Start

```bash
# Скопируй шаблон (если есть)
cp .env.local.example .env.local

# Минимум для запуска dev-сервера:
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GOOGLE_GEMINI_API_KEY=AIza...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=knizhny_sparringbot
TELEGRAM_CLIENT_SECRET=123456789:ABC...
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)

# Для OAuth (можно пропустить, используй /api/auth/dev-login):
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
YANDEX_CLIENT_ID=ce4f585bbcd846d9bc025c28a60ebe6e
YANDEX_CLIENT_SECRET=...

# Для платежей (можно пропустить если не тестируешь оплату):
YOOKASSA_SHOP_ID=...
YOOKASSA_SECRET_KEY=...
YOOKASSA_WEBHOOK_SECRET=...
```
