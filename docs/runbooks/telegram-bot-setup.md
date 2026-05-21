# Настройка Telegram-бота для входа на платформу

В 2026 Telegram закрыли **оба** старых способа браузерного входа:
- **Legacy widget** (`telegram.org/js/telegram-widget.js`) — `oauth.telegram.org/auth?bot_id=...` теперь отдаёт голое слово `deprecated`.
- **OIDC SDK** (`oauth.telegram.org/js/telegram-login.js`) — там тот же бекенд, тоже отвалился.

Сейчас вход устроен через **прямое взаимодействие пользователя с ботом**: сайт генерирует одноразовый код, юзер открывает `t.me/<bot>?start=<code>` и нажимает Start, бот ловит это в webhook, сайт polls сервер на готовность сессии. Это стандартный паттерн, который Telegram **не закроет** — на нём держится вся экосистема ботов.

## 0. Архитектура (что в коде)

```
сайт                                Telegram                                наш сервер
  │                                                                              │
  │  POST /api/auth/telegram/start ─────────────────────────────────────────────►│
  │                                                                              │
  │◄─────── {code, botUrl: t.me/<bot>?start=<code>} ─────────────────────────────│
  │                                                                              │
  │  window.open(botUrl) → юзер видит чат с ботом, жмёт START                    │
  │                              │                                               │
  │                              ▼                                               │
  │                              Telegram шлёт update боту                       │
  │                                                                              │
  │                                                  POST /api/telegram/webhook ─►│
  │                                                  (заголовок X-Telegram-Bot-Api-Secret-Token)
  │                                                                              │
  │                                                  ◄─── confirmLoginCode ────  │
  │                                                       (status=confirmed,
  │                                                        сохраняем telegram_id,
  │                                                        name, username)
  │                                                                              │
  │  GET /api/auth/telegram/poll?code=... (каждые 2с) ──────────────────────────►│
  │                                                                              │
  │◄─── {status: 'confirmed', access_token, refresh_token} ──────────────────────│
  │                                                                              │
  │  supabase.auth.setSession({access, refresh}) → залогинены                    │
```

**Файлы:**
- [components/AuthSheet.tsx](../../components/AuthSheet.tsx) — кнопка + polling
- [lib/telegram-login.ts](../../lib/telegram-login.ts) — создание/подтверждение кодов, Bot API helpers
- [app/api/auth/telegram/start/route.ts](../../app/api/auth/telegram/start/route.ts) — генерит код, возвращает botUrl
- [app/api/telegram/webhook/route.ts](../../app/api/telegram/webhook/route.ts) — Telegram → нам, обрабатывает `/start CODE`
- [app/api/auth/telegram/poll/route.ts](../../app/api/auth/telegram/poll/route.ts) — сайт → нам, возвращает сессию когда готово

**Таблица БД:** `telegram_login_codes` (RLS enabled, no policies — доступ только через service role).

## 1. Создать бота в BotFather

Только при первой настройке или ребрендинге.

1. Открой `@BotFather` в Telegram.
2. `/newbot` → имя (display name, например `Книжный Спарринг`) → username (должен оканчиваться на `bot`, например `knizhny_sparringbot`).
3. BotFather пришлёт **bot token** формата `<bot_id>:<HEX-строка>`. Сохрани его.

**НЕ нужно** настраивать `/setdomain`, `/setapi`, `/setjoingroups` и прочее — мы используем Bot API через webhook, ничего из этого не требуется.

## 2. Env-переменные

### Локально (`.env.local`)

```
TELEGRAM_CLIENT_SECRET=8819430479:AAH-FCOrtn7dPCzKF3bI_yMQyigToi-ZXLQ
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=knizhny_sparringbot
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)   # или node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`TELEGRAM_WEBHOOK_SECRET` — случайный 64-символьный hex. Telegram передаст его обратно в каждом webhook-вызове в header `X-Telegram-Bot-Api-Secret-Token`, мы сверяем — это защита от поддельных запросов.

### На Vercel (Settings → Environment Variables)

Те же три переменные нужно прописать для Production / Preview / Development. После добавления — Redeploy без use existing build cache.

## 3. Зарегистрировать webhook у Telegram

После того как сайт задеплоен с endpoint'ом `POST /api/telegram/webhook`, нужно сказать Telegram'у куда слать обновления.

Это **один curl**:

```bash
TOKEN="8819430479:AAH-..."
SECRET="$(grep TELEGRAM_WEBHOOK_SECRET .env.local | cut -d'=' -f2 | tr -d '"')"
URL="https://nice-guy-ai.vercel.app/api/telegram/webhook"

curl -s "https://api.telegram.org/bot${TOKEN}/setWebhook?url=${URL}&secret_token=${SECRET}&allowed_updates=%5B%22message%22%5D"
```

Параметры:
- `url` — наш endpoint
- `secret_token` — тот же что в env (Telegram будет слать его в header)
- `allowed_updates=["message"]` — только сообщения; экономия трафика и фильтрация

Ответ должен быть `{"ok":true,"result":true,"description":"Webhook was set"}`.

Проверь что зарегистрировался:
```bash
curl -s "https://api.telegram.org/bot${TOKEN}/getWebhookInfo"
```

Должен быть `url` совпадающий с нашим, `has_custom_certificate: false`, `pending_update_count: 0`.

## 4. Чек-проверка

1. Открой `https://nice-guy-ai.vercel.app/auth` в инкогнито.
2. Жми **«Войти через Telegram»** — открывается чат с ботом в Telegram.
3. Жми **START** у бота.
4. Бот отвечает «Привет, <твоё имя>! Ты залогинен. Возвращайся на сайт».
5. Возвращаешься на вкладку сайта — она пускает в кабинет (через 0–2 секунды).
6. В профиле должно быть твоё имя из Telegram.

Проверь сохранение в БД:
```sql
SELECT id, name, telegram_id, telegram_username, created_at
FROM profiles
WHERE telegram_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

## 5. Диагностика: «Жму кнопку, ничего не открывается»

- Браузер заблокировал popup — посмотри уведомление в адресной строке, разреши popups для домена.
- Под кнопкой должен быть текст с ссылкой `t.me/...` — можно открыть вручную.

## 6. Диагностика: «У бота нажал Start, но сайт не пускает»

В Sentry или Vercel logs ищи:

| Что в логах | Что значит | Что делать |
|---|---|---|
| `[telegram/webhook] invalid secret` | Telegram не присылает `X-Telegram-Bot-Api-Secret-Token` или он не совпадает | Проверь что в `setWebhook` передавал тот же secret_token что в env `TELEGRAM_WEBHOOK_SECRET`. Перезарегистрируй webhook. |
| Webhook не приходит вообще (тишина) | Telegram не знает наш URL или url не отвечает | `getWebhookInfo` → проверь `url`, `last_error_message`. Возможно ssl-сертификат недействителен / 404 на endpoint. |
| `confirmLoginCode` вернул false | Код истёк (старше 10 минут) или уже использован | Открой /auth заново. |
| Сайт polls, но получает status=pending бесконечно | Webhook не дошёл (см. выше) или код не совпадает | Сверь `?code=` в poll с `start=` в боте. |

## 7. Смена бота

1. Создай нового бота через `/newbot` в BotFather.
2. Обнови env: `TELEGRAM_CLIENT_SECRET` (новый токен), `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (новый username).
3. `TELEGRAM_WEBHOOK_SECRET` можно оставить или перегенерить.
4. На Vercel — Redeploy.
5. После деплоя — `setWebhook` для нового бота (шаг 3 выше с новым токеном).

Старые юзеры в `profiles` не пострадают — у них `telegram_id` хранится, и при следующем входе через нового бота они автоматически найдутся по этому полю (бот меняется, telegram_id юзера — нет).

## 8. Уведомления через бота

После того как юзер прошёл вход — у нас в `profiles.telegram_id` лежит его chat_id (для приватных чатов с ботом `chat_id === telegram_id`). Слать уведомление = один HTTP-запрос:

```typescript
import { sendBotMessage } from "@/lib/telegram-login";
await sendBotMessage(profile.telegram_id, "Текст уведомления, поддерживает <b>HTML</b>.");
```

Юзер получит сообщение от бота — без отдельной настройки.
