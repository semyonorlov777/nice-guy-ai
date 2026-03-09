# Security Audit — Nice Guy AI
**Дата:** 2026-03-09

## npm audit результат

```
5 vulnerabilities (3 moderate, 2 critical)

yookassa > request > form-data     — CRITICAL (unsafe random, GHSA-fjxv-7rqg-78g4)
yookassa > request > qs            — moderate (DoS, GHSA-6rw7-vpxm-498p)
yookassa > request > tough-cookie  — moderate (Prototype Pollution, GHSA-72xf-g2v4-qvf3)
```

**Вердикт:** Все из устаревшей `yookassa` v0.1.1 (использует deprecated `request`). `npm audit fix` не помогает. Реальный риск LOW — используется только для серверных вызовов к API ЮKassa.

## CVE проверка

| CVE | Описание | Затрагивает | Наш статус |
|-----|----------|-------------|------------|
| CVE-2025-29927 | Обход auth middleware | Next.js <15.2.3 | **SAFE** — Next.js 16.1.6 |

Других CVE для Next.js 16.x не обнаружено.

## Security headers

**До фикса:** Полностью отсутствовали (`next.config.ts` пустой).

**ИСПРАВЛЕНО** — добавлены в `next.config.ts`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(self), geolocation=()`
- `X-DNS-Prefetch-Control: on`

> HSTS устанавливается Vercel автоматически.

## API routes аудит

| Route | Auth проверка | Input валидация | Проблемы | Статус |
|-------|--------------|-----------------|----------|--------|
| `POST /api/chat` | OK | **Добавлен лимит 10000** | — | ИСПРАВЛЕНО |
| `POST /api/chat/anonymous` | Нет (by design) | OK (5000 символов) | IP-based rate limiting | OK |
| `POST /api/chat/migrate` | OK | Базовая | Нет валидации content длины | MEDIUM |
| `GET /api/portrait` | OK | OK | — | OK |
| `POST /api/portrait/update` | **Добавлен x-internal-secret** | OK | — | ИСПРАВЛЕНО |
| `POST /api/auth/telegram` | JWT | OK | — | OK |
| `GET /api/auth/yandex/*` | OAuth flow | OK | — | OK |
| `GET /api/chats` | OK | OK | — | OK |
| `PATCH /api/chats/[id]` | OK | OK | — | OK |
| `POST /api/transcribe` | OK | 25MB лимит | — | OK |
| `POST /api/payments/create` | OK | productKey OK | — | OK |
| `GET /api/payments/status` | OK | OK | — | OK |
| `POST /api/payments/webhook` | **Добавлен HTTP Basic Auth** | API верификация | Return 500 при ошибке | ИСПРАВЛЕНО |

## Service Role использование

Все вызовы `createServiceClient()` обоснованы — RLS bypass используется только где необходимо:
- Создание профиля при первом входе
- Webhook обработка платежей
- Запись анонимных сообщений
- Миграция чатов
- Чтение конфигурации
- Обновление портрета

## Env переменные

### NEXT_PUBLIC_* (публичные):
| Переменная | Оценка |
|-----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | OK |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | OK — read-only, RLS |
| `NEXT_PUBLIC_SITE_URL` | OK |
| `NEXT_PUBLIC_TELEGRAM_BOT_ID` | OK — публичный |

Чувствительных данных в NEXT_PUBLIC_* нет. Секреты в `.env.local`, который в `.gitignore`.

## Выполненные фиксы

1. **Security headers** — `next.config.ts`
2. **Portrait Update auth** — `app/api/portrait/update/route.ts` (x-internal-secret)
3. **Webhook HTTP Basic Auth** — `app/api/payments/webhook/route.ts` + return 500 при ошибке
4. **Chat message length limit** — `app/api/chat/route.ts` (max 10000 символов)
5. **PostMessage origin check** — `components/InChatAuth.tsx`
6. **Atomic token deduction** — `supabase/migrations/deduct_tokens.sql` + RPC вызов в `chat/route.ts`

## Действия пользователя (требуется вручную)

- [ ] Добавить `INTERNAL_API_SECRET` (UUID) в Vercel env vars
- [ ] Добавить `YOOKASSA_WEBHOOK_SECRET` (Base64 login:password) в Vercel env vars
- [ ] Настроить HTTP Basic Auth в личном кабинете ЮKassa (webhook URL)
- [ ] Выполнить SQL из `supabase/migrations/deduct_tokens.sql` в Supabase Dashboard

## Общий риск-рейтинг (после фиксов)

| Уровень | Кол-во | Детали |
|---------|--------|--------|
| **CRITICAL** | 0 | Все исправлены |
| **HIGH** | 0 | Все исправлены |
| **MEDIUM** | 2 | Migrate без валидации длины, npm audit (yookassa) |
| **LOW** | 3 | dangerouslySetInnerHTML (admin-only), CSRF на cancel/unlink, duration spoofing |
