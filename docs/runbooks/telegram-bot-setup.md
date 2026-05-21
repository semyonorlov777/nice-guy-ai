# Настройка Telegram-бота для входа на платформу

В 2026 Telegram **закрыли legacy widget** (`telegram.org/js/telegram-widget.js`) — запрос на `oauth.telegram.org/auth?bot_id=...` теперь отдаёт голое слово `deprecated` вместо страницы авторизации. Используем Telegram OpenID Connect (OIDC) через SDK `oauth.telegram.org/js/telegram-login.js`. Это путь, который сам Telegram сейчас рекомендует.

## 0. Что у нас сейчас в коде

- **Telegram OIDC SDK** загружается через Next.js `<Script>` из `https://oauth.telegram.org/js/telegram-login.js?3` — [components/AuthSheet.tsx](../../components/AuthSheet.tsx). Клик по кнопке вызывает `window.Telegram.Login.auth({ client_id, ... }, callback)`, открывается popup на oauth.telegram.org, после подтверждения callback возвращает `id_token` (JWT).
- **Серверная JWKS-верификация** через `jose`: [lib/telegram-auth.ts](../../lib/telegram-auth.ts) проверяет подпись JWT по `https://oauth.telegram.org/.well-known/jwks.json`, валидирует `issuer` и `audience` (= `NEXT_PUBLIC_TELEGRAM_BOT_ID`), извлекает `sub`, `name`, `preferred_username`, `picture` из payload.
- **Создание/обновление пользователя** в `profiles`: [lib/oauth-common.ts](../../lib/oauth-common.ts) через `findOrCreateOAuthUser` (fake email `tg_{id}@niceguy.local`, пароль = HMAC от telegram_id с `TELEGRAM_CLIENT_SECRET`).
- **Bot ID** на клиенте: env `NEXT_PUBLIC_TELEGRAM_BOT_ID` (например `8544302305`).
- **Bot token** на сервере: env `TELEGRAM_CLIENT_SECRET` (формат `BOT_ID:HEX-строка`) — нужен только для HMAC-пароля Supabase, не для OIDC.

## 1. Привязать домен в BotFather

Telegram проверяет что `origin` страницы (= домен сайта) совпадает с настроенным в боте. Если нет — popup не открывается / закрывается без вернувшегося id_token.

1. Открой `@BotFather` в Telegram.
2. `/mybots` → выбери нужного бота (по умолчанию `@skillstrainerai_bot`).
3. **Bot Settings → Domain → Edit** (или команда `/setdomain`).
4. Введи прод-домен **БЕЗ протокола и слэшей**:
   ```
   nice-guy-ai.vercel.app
   ```
5. Для preview-деплоев Vercel — один бот = один домен. Для отдельного preview-окружения заведи второго бота.
6. Локальная разработка — Telegram не принимает `localhost`. Варианты: ngrok-домен + временный `/setdomain`, тест на проде/превью, или dev-логин `GET /api/auth/dev-login`.

## 2. Bot ID и токен на Vercel

1. В BotFather: `/mybots` → бот → **API Token** → скопируй (формат `BOT_ID:HEX-строка`).
2. Bot ID — это числовая часть до `:` (например, в `8544302305:AAGGGmqs...` это `8544302305`).
3. Vercel → Project `nice-guy-ai` → **Settings → Environment Variables**:
   - `NEXT_PUBLIC_TELEGRAM_BOT_ID` = bot ID (только цифры).
   - `TELEGRAM_CLIENT_SECRET` = полный токен `BOT_ID:HEX-строка` (используется для HMAC-пароля Supabase).
4. Если меняли — `Redeploy` последнего успешного деплоя без use existing build cache.

## 3. Если меняешь бота

1. В BotFather создай нового бота (`/newbot`), запомни bot ID и token.
2. У нового бота: `/setdomain nice-guy-ai.vercel.app`.
3. На Vercel обнови:
   - `NEXT_PUBLIC_TELEGRAM_BOT_ID` = новый bot ID.
   - `TELEGRAM_CLIENT_SECRET` = новый токен.
4. `Redeploy`.

## 4. Чек-проверка после настройки

1. Открой https://nice-guy-ai.vercel.app/auth в **incognito**.
2. Кнопка «Войти через Telegram» должна быть **активна** (синяя, того же размера что и Яндекс/Google) через 1–2 секунды после загрузки страницы. Если стоит «Telegram загружается...» — SDK ещё не загрузился, подожди.
3. Клик → открывается popup на `oauth.telegram.org` → юзер подтверждает в Telegram → popup закрывается → редирект в кабинет.
4. Проверь сохранение в БД:
   ```sql
   SELECT id, name, avatar_url, telegram_id, telegram_username, created_at
   FROM profiles
   WHERE telegram_id IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 5;
   ```

**Важно про имя и фото.** Telegram OIDC возвращает `name` и `picture` в id_token **не всегда** — зависит от настроек приватности пользователя и от того, взаимодействовал ли он раньше с ботом. Если у нового юзера `name` и `avatar_url` пустые — это норма для OIDC. План: обогащать профиль через webhook бота, когда юзер первый раз шлёт `/start`.

## 5. Диагностика: «Кнопка не активна»

- DevTools → **Network**: запрашивается ли `https://oauth.telegram.org/js/telegram-login.js?3`? Статус 200?
- **Console**: ошибки CSP (`Refused to load the script ... violates the following Content Security Policy directive`)? Проверь `script-src` в [next.config.ts](../../next.config.ts) — должен содержать `oauth.telegram.org`.
- Проверь что `NEXT_PUBLIC_TELEGRAM_BOT_ID` задан на Vercel и попадает в клиентский билд (открой DevTools → Sources → найди bundle, проверь что строка `client_id: ...` содержит твой bot ID).

## 6. Диагностика: «Кнопка кликается, popup открывается, но вход не проходит»

В `Sentry` или серверных логах `[auth/telegram/verify]` ищи `tags.reason`:

| `reason` | Что значит | Что делать |
|---|---|---|
| `missing_token` | Popup закрылся без id_token (юзер отменил, или Telegram отказал) | Норма, не баг. Если воспроизводится у разных юзеров — проверь шаг 1. |
| `invalid_token` | JWT не прошёл проверку через JWKS (подпись/issuer/audience не сошлись) | `NEXT_PUBLIC_TELEGRAM_BOT_ID` на Vercel не совпадает с реальным bot ID. Сверь, обнови, redeploy. |
| `session_failed` | JWT ок, но Supabase не дал сессию | Проверь `SUPABASE_SERVICE_ROLE_KEY` (он создаёт пользователя через admin API). |
| `unknown` | Что-то иное (БД, сеть) | Смотри `extra.error` в Sentry. |
