# Настройка Telegram-бота для входа на платформу

Telegram Login Widget (`telegram.org/js/telegram-widget.js`) **молча отказывается рендериться**, если домен сайта не привязан к боту через `@BotFather → /setdomain`. Если на проде/превью кнопка «Войти через Telegram» висит «Telegram загружается...» и нет ни одной записи `POST /api/auth/telegram/verify` в логах — почти всегда дело именно в этом.

Эта инструкция — что нужно сделать в BotFather и Vercel, чтобы Telegram-вход заработал.

## 0. Что у нас сейчас в коде

- Используется **legacy widget** (НЕ Telegram OIDC SDK). Он отдаёт `id, first_name, last_name, username, photo_url, auth_date, hash`. Источник: [components/AuthSheet.tsx](../../components/AuthSheet.tsx).
- HMAC верификация подписи: [lib/telegram-auth.ts](../../lib/telegram-auth.ts).
- Сохранение имени и фото в `profiles.name` / `profiles.avatar_url`: [lib/oauth-common.ts](../../lib/oauth-common.ts).
- Username бота — через env `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (дефолт `skillstrainerai_bot`).
- Bot token — через env `TELEGRAM_CLIENT_SECRET`.

## 1. Привязать домен в BotFather

1. Открой `@BotFather` в Telegram.
2. `/mybots` → выбери нужного бота (по умолчанию у нас `@skillstrainerai_bot`).
3. **Bot Settings → Domain → Edit** (или команда `/setdomain`).
4. Введи прод-домен **БЕЗ протокола и слэшей**:
   ```
   nice-guy-ai.vercel.app
   ```
5. Если нужны превью-деплои Vercel — добавь их по одному той же командой (Telegram хранит только один домен на бота; для нескольких — заведи второго бота для preview-окружения).
6. Для локальной разработки — Telegram не принимает `localhost`. Варианты:
   - Использовать ngrok-домен и временно поставить его через `/setdomain`.
   - Тестировать Telegram-вход только на превью / проде.
   - Для остальной работы — `GET /api/auth/dev-login` (создаёт `dev_test@niceguy.local`).

## 2. Проверить bot token на Vercel

1. В BotFather: `/mybots` → бот → **API Token** → скопируй токен (формат `123456789:AAH...HEX-строка`).
2. Vercel → Project `nice-guy-ai` → **Settings → Environment Variables**.
3. Проверь `TELEGRAM_CLIENT_SECRET` для Production: значение должно совпадать в точности (включая `BOT_ID:` префикс).
4. Если меняли — `Redeploy` последнего успешного деплоя.

## 3. Если меняешь бота

Например, отдельный бот для preview или новый production-бот после ребрендинга:

1. В BotFather создай нового бота (`/newbot`), запомни username и token.
2. У нового бота: `/setdomain nice-guy-ai.vercel.app`.
3. На Vercel обнови ОБЕ переменные:
   - `TELEGRAM_CLIENT_SECRET` = новый token.
   - `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` = новый username (без `@`).
4. `Redeploy`.

Менять `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` можно через Vercel UI без коммита — `components/AuthSheet.tsx` читает её на клиенте (`NEXT_PUBLIC_` всегда подставляется во время билда; Vercel автоматически делает rebuild при изменении такой переменной).

## 4. Чек-проверка после настройки

После всех шагов:

1. Открой https://nice-guy-ai.vercel.app/auth в **incognito**.
2. На месте Telegram должна появиться синяя кнопка «Войти как <твоё имя>» (iframe от Telegram). Если через 6 секунд её нет — появится плашка «Telegram-кнопка не загрузилась» (см. fallback в `AuthSheet.tsx`).
3. Клик → подтверждение в Telegram → редирект в кабинет программы.
4. Проверь сохранение в БД (Supabase SQL editor или MCP):
   ```sql
   SELECT id, name, avatar_url, telegram_id, telegram_username, created_at
   FROM profiles
   WHERE telegram_id IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 5;
   ```
   У свежей записи должны быть заполнены `name` и `avatar_url`.

## 5. Диагностика: «Кнопка не появляется»

Если виджет всё ещё не рендерится:

- Открой DevTools → **Network**: запрашивается ли `https://telegram.org/js/telegram-widget.js?22`? Статус 200?
- **Console**: есть ли ошибки `Bot domain invalid`, CSP-блокировок, CORS?
- **Sentry** (тег `telegram_widget_timeout`) — должна появляться запись с `botUsername`.
- Проверь шаг 1: домен в BotFather точно тот, на котором открываешь сайт. Vercel preview-домен (например, `nice-guy-ai-git-feature-branch.vercel.app`) НЕ совпадает с production и под него нужен отдельный бот.

## 6. Диагностика: «Кнопка кликается, но вход не проходит»

В `Sentry` (или серверных логах `[auth/telegram/verify]`) ищи `tags.reason`:

| `reason` | Что значит | Что делать |
|---|---|---|
| `malformed` | Виджет прислал неполный payload (нет `id` / `auth_date` / `hash`) | Скорее баг на стороне Telegram — повторить попытку. Если воспроизводится — issue. |
| `hash_mismatch` | HMAC не сошёлся: `TELEGRAM_CLIENT_SECRET` не от того бота, что подписал payload | Сверь токен на Vercel с тем, что в BotFather. После смены — Redeploy. |
| `expired` | `auth_date` старше 24 часов | Пользователь открыл вкладку и долго не входил. Просто открыть `/auth` заново. |
| `session_failed` | HMAC ок, но Supabase не дал сессию | Проверь `SUPABASE_SERVICE_ROLE_KEY` (он создаёт пользователя через admin API). |
| `unknown` | Что-то иное (БД, сеть) | Смотри `extra.error` в Sentry. |
