# Weekly Security Report — Nice Guy AI

**Дата:** 2026-03-20 (обновлено 2026-03-20)
**Версия Next.js:** 16.2.0
**Supabase:** PostgreSQL 17.6.1, eu-central-1, ACTIVE_HEALTHY
**Статус: OK** (все P0/P1 исправлены)

---

## npm audit

| Severity | Package | Issue | Fix | Статус |
|----------|---------|-------|-----|--------|
| **CRITICAL** | `form-data` (→ `request` → `yookassa`) | Unsafe random function for boundary | No fix (yookassa dependency) | ⏳ Backlog |
| **CRITICAL** | `request` (transitive via yookassa) | Depends on vulnerable form-data, qs, tough-cookie | No fix available | ⏳ Backlog |
| ~~**HIGH**~~ | ~~`flatted` ≤3.4.1~~ | ~~Unbounded recursion DoS + Prototype Pollution~~ | ~~`npm audit fix`~~ | ✅ Исправлено |
| ~~MODERATE~~ | ~~`next` 16.0.0-16.1.6~~ | ~~HTTP request smuggling, image cache, buffer DoS, CSRF~~ | ~~Upgrade to 16.2.0~~ | ✅ Исправлено |
| MODERATE | `qs` <6.14.1 | arrayLimit bypass → memory DoS | No fix (yookassa chain) | ⏳ Backlog |
| MODERATE | `tough-cookie` <4.1.3 | Prototype Pollution | No fix (yookassa chain) | ⏳ Backlog |

**Итого после исправлений:** 5 vulnerabilities (3 moderate, 2 critical) — все из цепочки yookassa SDK

**Оставшаяся рекомендация:**
- `yookassa` — основной источник всех оставшихся уязвимостей. Зависит от устаревшего `request`. Рассмотреть замену на прямые HTTP-запросы к YooKassa API.

---

## Security Headers

**Статус: OK**

`next.config.ts` содержит:
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `X-Frame-Options: DENY`
- ✅ `Referrer-Policy: strict-origin-when-cross-origin`
- ✅ `Permissions-Policy: camera=(), microphone=(self), geolocation=()`
- ✅ `X-DNS-Prefetch-Control: on`
- ✅ `Content-Security-Policy` — **добавлен** (защита от XSS) — `1287d9c`

---

## Secrets

**Статус: OK**

- ✅ Все секреты доступны только через `process.env.*` на сервере
- ✅ `.env*` в `.gitignore`
- ✅ `.env` файлы никогда не коммитились
- ✅ `createServiceClient()` — нет новых файлов за неделю

---

## Token Deduction

- ✅ `app/api/chat/route.ts` — `rpc("deduct_tokens")` (атомарно)
- ✅ `app/api/payments/webhook/route.ts` — `rpc("add_tokens")` (атомарно)
- ✅ `app/api/transcribe/route.ts` — **ИСПРАВЛЕНО** → `rpc("deduct_tokens")` (было: прямой UPDATE)
- ✅ `app/api/auth/dev-login/route.ts` — прямой update, только dev-mode

---

## Webhook

- ✅ **ИСПРАВЛЕНО**: Auth теперь обязательна — если `YOOKASSA_WEBHOOK_SECRET` не задан, возвращает 500
- ✅ **ИСПРАВЛЕНО**: При ошибке `add_tokens` RPC возвращает 500 (было: 200 silent failure)
- ✅ **ИСПРАВЛЕНО**: Убран не-атомарный fallback (select+update при ошибке RPC)
- ✅ **ИСПРАВЛЕНО**: Catch-all ошибки возвращают 500 вместо 200
- ✅ Верификация через `yookassa.getPayment()` — дополнительная проверка
- ✅ Идемпотентность: проверка `yookassa_status` перед начислением

---

## API Routes — таблица (23 routes)

| Route | Auth | Input Validation | Статус |
|-------|------|------------------|--------|
| `/api/chat` | ✅ getUser() | ✅ message ≤10000 | OK |
| `/api/chat/anonymous` | 🔓 public | ✅ UUID, rate limit, ≤5000 | OK |
| `/api/chat/migrate` | ✅ getUser() | ✅ ≤200 msg, content ≤10000 | ✅ Исправлено |
| `/api/chats` | ✅ getUser() | ✅ limit ≤50 | OK |
| `/api/chats/[id]` | ✅ getUser() + owner | ✅ status=archived | OK |
| `/api/portrait` | ✅ getUser() | ✅ program_id | OK |
| `/api/portrait/update` | ✅ INTERNAL_API_SECRET | ✅ chat_id | OK |
| `/api/payments/create` | ✅ getUser() | ✅ productKey | OK |
| `/api/payments/status` | ✅ getUser() + owner | ✅ order_id | OK |
| `/api/payments/webhook` | ✅ **ИСПРАВЛЕНО** — обязательная auth | ✅ event+payment verify | ✅ Исправлено |
| `/api/payments/unlink-card` | ✅ getUser() | ✅ body не используется | OK |
| `/api/payments/cancel-subscription` | ✅ getUser() | ✅ body не используется | OK |
| `/api/transcribe` | ✅ getUser() | ✅ file ≤25MB | ✅ Исправлено (atomic) |
| `/api/test` | Hybrid | ✅ extensive | OK |
| `/api/test/answer` | Hybrid | ✅ score 1-5, UUID | ✅ Исправлено (IDOR) |
| `/api/test/result` | ✅ getUser() | ✅ chat_id | OK |
| `/api/test/results/[id]` | 🔓 public (UUID) | ✅ UUID regex | OK |
| `/api/test/debug` | ✅ **ИСПРАВЛЕНО** — `DEBUG_ENABLED` (серверная) | ✅ index, type, model | ✅ Исправлено |
| `/api/test/migrate` | ✅ getUser() | ✅ UUID, 34+ answers | OK |
| `/api/auth/dev-login` | ✅ NODE_ENV check | — | OK |
| `/api/auth/yandex` | 🔓 OAuth init | ✅ redirect whitelist | ✅ Исправлено |
| `/api/auth/yandex/callback` | OAuth flow | ✅ redirect whitelist | OK |
| `/api/auth/telegram/verify` | JWT verify | ✅ id_token | OK |

---

## Supabase

### RLS Status

| Таблица | RLS | Политик | Статус |
|---------|-----|---------|--------|
| programs | ON | Есть | ✅ OK |
| exercises | ON | Есть | ✅ OK |
| profiles | ON | Есть | ✅ Обновлено `(select auth.uid())` |
| chats | ON | Есть | ✅ Обновлено `(select auth.uid())` |
| messages | ON | Есть | ✅ Обновлено `(select auth.uid())` |
| portraits | ON | Есть | ✅ Обновлено `(select auth.uid())` |
| payments | ON | Есть | ✅ Обновлено `(select auth.uid())` |
| orders | ON | Есть | ✅ Исправлено — "Service role" ограничен до `TO service_role` |
| app_config | ON | Есть | ✅ OK |
| test_results | ON | Есть | ✅ Исправлено — INSERT ограничен до `TO service_role` |
| user_programs | ON | Есть | ✅ Обновлено `(select auth.uid())` |
| subscriptions | ON | 3 (SELECT, INSERT, UPDATE) | ✅ **Добавлены** — `(select auth.uid()) = user_id` |
| test_sessions | ON | 0 (намеренно) | ✅ OK — нет user_id, доступ только через service_role |

### Функции

| Функция | SECURITY DEFINER | SET search_path | Статус |
|---------|-----------------|-----------------|--------|
| `add_tokens` | Да | ✅ `= public` | ✅ Исправлено |
| `deduct_tokens` | Да | ✅ `= public` | ✅ Исправлено |
| `append_test_answer` | Да | ✅ `= public` | ✅ Исправлено |
| `append_anonymous_test_answer` | Да | ✅ `= public` | ✅ Исправлено (+ удалён старый overload с text) |

### Leaked password protection

**Не применимо** — проект использует Magic Link, Telegram OIDC и Яндекс OAuth. Паролей в базе нет.

---

## Исправления (выполнено)

| # | Приоритет | Проблема | Что сделано | Коммит/миграция |
|---|-----------|----------|-------------|----------------|
| 1 | **P0** | `/api/test/debug` — `NEXT_PUBLIC_` env | Переименовано в `DEBUG_ENABLED` (серверная) + обновлено в Vercel Dashboard | `f58ff65` |
| 2 | **P1** | IDOR в `/api/test/answer` | Добавлен `.eq("user_id", user.id)` | `9975729` |
| 3 | **P1** | Race condition в `/api/transcribe` | Заменён UPDATE на `rpc("deduct_tokens")` | `0a2d1a9` |
| 4 | **P1** | Webhook: условная auth + silent failure | Обязательная auth + return 500 + убран не-атомарный fallback | `0515837` |
| 5 | **P1** | flatted HIGH vulnerability | `npm audit fix` | `c2e71c7` |
| 6 | **P1** | Next.js 16.1.6 → 16.2.0 (4 CVE) | `npm install next@16.2.0` | `81c11f3` |
| 7 | **P2** | Функции без SET search_path | `CREATE OR REPLACE` с `SET search_path = public` | Supabase migration |
| 8 | **P2** | always-true RLS policies | Ограничены до `TO service_role` | Supabase migration |
| 9 | **P2** | `auth.uid()` в 14 RLS-политиках | Заменено на `(select auth.uid())` | Supabase migration |
| 10 | **P2** | subscriptions без RLS-политик | Добавлены SELECT/INSERT/UPDATE | `4852e37` + Supabase migration |
| 11 | **P2** | Старый overload `append_anonymous_test_answer(text)` | Удалён | Supabase migration |
| 12 | **P2** | CSP header отсутствует | Добавлен Content-Security-Policy | `1287d9c` |
| 13 | **P2** | Yandex OAuth redirect не валидируется | Allowlist до OAuth flow | `67e423b` |
| 14 | **P2** | Body validation в payments routes | Подтверждено: body не используется | `f95df26` |
| 15 | **P2** | Нет лимитов в chat/migrate | ≤200 сообщений, content ≤10000 | `2cbbb18` |
| 16 | **P3** | Нет индексов на FK | 7 индексов добавлено | `54de086` + migration |
| 17 | **P3** | Неиспользуемые индексы | 4 индекса удалено | `34205c8` + migration |

---

## Оставшиеся задачи (P2/P3)

### P2 — Ближайший месяц
- [x] Добавить CSP header — `1287d9c`
- [x] Валидировать Yandex OAuth redirect URL до OAuth flow — `67e423b`
- [x] Body validation в `/api/payments/unlink-card` и `cancel-subscription` — OK, body не используется (подтверждено `f95df26`)
- [x] Лимиты на messages массив в `/api/chat/migrate` — макс 200, content ≤10000 — `2cbbb18`

### P3 — Backlog
- [ ] Заменить yookassa SDK на прямые HTTP-запросы (2 critical + 2 moderate)
- [x] Индексы на foreign keys — 7 индексов добавлено — `54de086` + Supabase migration
- [ ] Redis rate limiting (при масштабировании)
- [x] Удалить неиспользуемые индексы (orders, test_sessions) — 4 индекса удалено — `34205c8` + Supabase migration

---

## Изменения за неделю (2026-03-13 — 2026-03-20)

20+ коммитов. Основные:
- AuthSheet v2 — полная переработка авторизации
- Chat v2 — обновление UI
- Anonymous chat migration при логине
- Атомарные anonymous ответы в тесте ISSP
- **Security fixes** — 11 исправлений (P0-P2)

---

*Отчёт сгенерирован автоматически scheduled task `security-check`. Следующий аудит: 2026-03-27.*
