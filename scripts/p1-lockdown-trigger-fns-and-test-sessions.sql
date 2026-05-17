-- P1: lockdown оставшихся SECURITY DEFINER функций + test_sessions
-- Applied as migration 2026-05-17 p1_lockdown_trigger_functions_and_test_sessions
-- See docs/audits/2026-05-supabase-audit.md
--
-- 1) handle_new_user — trigger function on auth.users (auth.on_auth_user_created).
--    Никогда не должна вызываться через /rest/v1/rpc/handle_new_user.
-- 2) rls_auto_enable — event trigger function. Та же история.
-- 3) test_sessions — таблица анонимных тест-сессий. Файл миграции изначально
--    декларировал "БЕЗ RLS", но реально RLS был включён без политик (drift).
--    Чтобы сделать lockdown явным и закрыть advisor 0008:
--      - добавляем deny-all RLS policy для anon/authenticated
--      - снимаем table-level privileges с anon/authenticated
--    Все легальные обращения идут через:
--      - public.append_anonymous_test_answer (SECURITY DEFINER, owner-bypass)
--      - createServiceClient() из app/api/test/*  (service_role, bypass RLS)
--    Эти пути не задеты denies.
--
-- Linter advisors closed:
--   0028 anon_security_definer_function_executable / handle_new_user
--   0029 authenticated_security_definer_function_executable / handle_new_user
--   0028 anon_security_definer_function_executable / rls_auto_enable
--   0029 authenticated_security_definer_function_executable / rls_auto_enable
--   0008 rls_enabled_no_policy / public.test_sessions

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, PUBLIC;

CREATE POLICY "Direct access blocked"
  ON public.test_sessions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE public.test_sessions FROM anon, authenticated;

COMMENT ON TABLE public.test_sessions IS
  'Anonymous test sessions. Direct access denied for anon and authenticated '
  '(deny-all RLS policy + revoked table privileges). All reads/writes go '
  'through SECURITY DEFINER function append_anonymous_test_answer (anon path) '
  'or service_role (server-side handlers in app/api/test/*).';
