# Supabase Audit — 2026-05-17

> Полный read-only аудит продовой базы (`https://irtbvsarljtjwlzbviky.supabase.co`) и локальных SQL-скриптов в `scripts/`. Цель — найти security/performance проблемы и drift между файлами и фактическим состоянием БД. Все исправления применены сразу же отдельными PR.

## TL;DR

| | До аудита | После аудита |
|--|-----------|--------------|
| Security advisors | 17 | **4** (все три — by-design, плюс один требует toggle в Dashboard) |
| Performance advisors | 8 INFO | **8 INFO** (LOW — unindexed FK на пустых/маленьких таблицах, оставлены) |
| Drift между `scripts/` и БД | 4 файла | **0** |
| RPC, доступные анонимам без owner-check | 4 (`add_tokens`, `deduct_tokens`, оба `append_test_answer`, плюс `handle_new_user`/`rls_auto_enable` без причины) | **0** для анонимов; для authenticated — единственная `deduct_tokens`, защищена owner-check внутри тела |
| UPDATE-политики без явного WITH CHECK | 4 | 0 |

Все правки в БД — через MCP `apply_migration`, зеркала — в `scripts/*.sql`. Каждый фикс отдельным PR, мерджем в main в течение часа.

## Источники данных

- MCP `get_advisors` (security + performance)
- MCP `list_tables`, `list_migrations`, `list_extensions`, `list_branches`
- MCP `execute_sql` → `pg_policies`, `pg_proc`, `pg_class`, `pg_indexes`, `pg_trigger`, `pg_stat_user_tables`
- `grep` по `app/`, `lib/` для каждой функции/таблицы перед фиксом
- Локальное чтение `scripts/*.sql`

Скиллы: `supabase`, `supabase-postgres-best-practices`.

## Что было сделано

| # | Severity | Проблема | PR | Что в БД |
|---|----------|----------|----|----------|
| P0.1 | CRITICAL | `add_tokens` SD-функция доступна `anon`/`authenticated` без owner-check — любой мог пополнить чужой баланс. Единственный caller — webhook YooKassa через service_role. | [#40](https://github.com/semyonorlov777/nice-guy-ai/pull/40) | `REVOKE EXECUTE ... FROM anon, authenticated, PUBLIC` |
| P0.2 | CRITICAL | `deduct_tokens` SD-функция доступна `anon`/`authenticated` без owner-check. `chat/route.ts` зовёт её через user-context, поэтому прямой REVOKE сломал бы прод. | [#41](https://github.com/semyonorlov777/nice-guy-ai/pull/41) | Owner-check внутри тела (`auth.uid() = p_user_id OR auth.role() = 'service_role'`) + `REVOKE FROM anon, PUBLIC` |
| P0.3 | CRITICAL | `append_test_answer(uuid, jsonb, integer)` — без `SET search_path`, без owner-check, EXECUTE для anon/authenticated. Все callers через service_role. | [#42](https://github.com/semyonorlov777/nice-guy-ai/pull/42) | `ALTER FUNCTION ... SET search_path = public` + `REVOKE EXECUTE ... FROM anon, authenticated, PUBLIC` |
| P0.4 | CRITICAL | Legacy 2-arg `append_test_answer(uuid, jsonb)` — то же. Изначально планировался DROP, но grep показал 6 in-code вызовов с этой сигнатурой; PostgREST резолвит overload'ы по точным именам, DROP сломал бы прод. | [#43](https://github.com/semyonorlov777/nice-guy-ai/pull/43) | `REVOKE EXECUTE ... FROM anon, authenticated, PUBLIC` (search_path уже был выставлен) |
| P1 | HIGH | `handle_new_user` (trigger) и `rls_auto_enable` (event trigger) expose'нуты через REST RPC без причины. | [#44](https://github.com/semyonorlov777/nice-guy-ai/pull/44) | `REVOKE EXECUTE FROM anon, authenticated, PUBLIC` для обеих |
| P1 | HIGH | `test_sessions` — RLS включён без политик (drift с заявленным в файле «БЕЗ RLS»). | [#44](https://github.com/semyonorlov777/nice-guy-ai/pull/44) | Deny-all policy `FOR ALL TO anon, authenticated USING(false) WITH CHECK(false)` + `REVOKE ALL ON TABLE FROM anon, authenticated` + `COMMENT ON TABLE` |
| P2 | MEDIUM | 4 UPDATE-политики без явного `WITH CHECK` (`chats`, `portraits`, `profiles`, `subscriptions`). | [#45](https://github.com/semyonorlov777/nice-guy-ai/pull/45) | `ALTER POLICY ... WITH CHECK (...)` для каждой |
| P2 | MEDIUM | `programs` — две дублирующие SELECT-политики (anon + authenticated, обе `USING(true)`). | [#45](https://github.com/semyonorlov777/nice-guy-ai/pull/45) | `DROP` обеих + `CREATE POLICY "Programs are public" FOR SELECT TO public USING (true)` |
| P2 | LOW | `idx_profiles_google_id` — unused, дублирует unique-индекс `profiles_google_id_key`. | [#45](https://github.com/semyonorlov777/nice-guy-ai/pull/45) | `DROP INDEX idx_profiles_google_id` |
| P2 | MEDIUM | `idx_test_sessions_cleanup` (partial) объявлен в `scripts/`, но не приземлился в БД (drift). | [#45](https://github.com/semyonorlov777/nice-guy-ai/pull/45) | `CREATE INDEX ... WHERE status = 'in_progress'` |
| P2 | MEDIUM | Drift в 4 `scripts/*.sql` файлах: `auth.uid()` без `(SELECT …)` обёртки, неверные комментарии, отсутствие SET search_path / REVOKE / WITH CHECK / `TO service_role`. | [#45](https://github.com/semyonorlov777/nice-guy-ai/pull/45) | Только файлы (housekeeping для пересоздания БД) |

## Открытые advisors после всех фиксов

### Security (4)

| advisor | объект | статус | обоснование |
|---------|--------|--------|-------------|
| 0028 anon_security_definer_function_executable | `append_anonymous_test_answer(text, jsonb, integer)` | **by design** | Анонимный путь теста на лендинге обязан быть открыт без авторизации. Защита через секретный `session_id` (UUID) + rate-limit на сервере. |
| 0029 authenticated_security_definer_function_executable | `append_anonymous_test_answer(...)` | **by design** | Та же причина — функция намеренно открыта; роль вызывающего не важна, главное — знание `session_id`. |
| 0029 authenticated_security_definer_function_executable | `deduct_tokens(uuid, integer)` | **by design** | `chat/route.ts:108` вызывает через user-context (на каждое сообщение). EXECUTE для `authenticated` обязательно. Защита перенесена в owner-check внутри функции (P0.2). |
| auth_leaked_password_protection | Auth | **требует ручного toggle** | Включить в Dashboard → Auth → Password Security → «Enable leaked password protection (HIBP)». |

### Performance (8 INFO)

Все INFO-уровня, не блокируют. Решено не закрывать в этом аудите:

| advisor | объект | почему оставлено |
|---------|--------|------------------|
| 0001 unindexed FK | `exercises.program_id_fkey` (46 строк) | Маленькая таблица; DELETE на родителе `programs` — редкость. |
| 0001 | `orders.user_id_fkey` (7 строк) | То же; user-запросы покрываются вторичной логикой. |
| 0001 | `program_modes.mode_template_id_fkey` (102 строки) | Маленькая. |
| 0001 | `subscriptions.user_id_fkey` (0 строк) | Пустая. |
| 0001 | `user_programs.program_id_fkey` (0 строк) | Пустая. |
| 0005 unused index | `idx_payments_user_id` | `payments` — 3 строки; индекс пригодится позже. |
| 0005 | `idx_portraits_program_id` | Покрывается составным `idx_portraits_user_program`; решение оставить под наблюдением до накопления данных. |
| 0005 | `idx_test_sessions_cleanup` | Только что создан в P2; начнёт использоваться когда поставят cron-очистку. |

## Что осталось вне аудита

- **Унификация двух overload'ов `append_test_answer`** в один (с DEFAULT `p_expected_question`). Требует координированной правки 6 in-code мест + БД. Отдельный refactor-task.
- **Cron-очистка `test_sessions`** через `pg_cron` (расширение есть, но не включено). Когда понадобится — отдельная задача; partial-индекс `idx_test_sessions_cleanup` уже создан.

## Verification

Все шаги read-only, безопасно гонять повторно:

```bash
# Через MCP
mcp__supabase__get_advisors security
mcp__supabase__get_advisors performance

# Привилегии на SD-функции
mcp__supabase__execute_sql <<'SQL'
SELECT proname, pg_get_function_identity_arguments(oid),
       has_function_privilege('anon', oid, 'EXECUTE') AS anon,
       has_function_privilege('authenticated', oid, 'EXECUTE') AS auth,
       has_function_privilege('service_role', oid, 'EXECUTE') AS service
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace AND prosecdef = true
ORDER BY proname;
SQL

# UPDATE-политики с WITH CHECK
mcp__supabase__execute_sql <<'SQL'
SELECT tablename, policyname, qual, with_check
FROM pg_policies WHERE schemaname = 'public' AND cmd = 'UPDATE';
SQL
```

Ожидаемое состояние: 4 security advisors (см. таблицу выше), 8 performance INFO, все UPDATE-политики с непустым `with_check`.

## Список изменённых файлов (для архива)

Миграции в БД (через `mcp__supabase__apply_migration`):
- `revoke_add_tokens_execute_from_public`
- `deduct_tokens_owner_check_and_revoke_anon`
- `secure_append_test_answer_3arg`
- `secure_append_test_answer_2arg`
- `p1_lockdown_trigger_functions_and_test_sessions`
- `p2_update_with_check_dedupe_programs_indexes`

Зеркала в `scripts/`:
- `revoke-add-tokens-execute.sql`
- `secure-deduct-tokens.sql`
- `secure-append-test-answer-3arg.sql`
- `secure-append-test-answer-2arg.sql`
- `p1-lockdown-trigger-fns-and-test-sessions.sql`
- `p2-medium-batch.sql`

Drift-обновления в `scripts/`:
- `add-append-test-answer.sql` (SET search_path + REVOKE)
- `create-portraits-table.sql` (initPlan-форма auth.uid + WITH CHECK)
- `issp-migration.sql` (initPlan-форма + TO service_role)
- `test-sessions-migration.sql` (актуальный lockdown вместо «БЕЗ RLS»)
