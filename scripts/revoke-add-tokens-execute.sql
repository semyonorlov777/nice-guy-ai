-- P0.1: lock down add_tokens RPC
-- Applied as migration 2026-05-17 revoke_add_tokens_execute_from_public
-- See docs/audits/2026-05-supabase-audit.md
--
-- Why: SECURITY DEFINER function public.add_tokens(uuid, integer) had EXECUTE
-- granted to anon and authenticated. There is no auth.uid() = p_user_id check
-- inside the body, so any unauthenticated caller could top up any user's
-- balance via /rest/v1/rpc/add_tokens.
--
-- Single in-code caller: app/api/payments/webhook/route.ts uses
-- createServiceClient() (service_role), protected by HTTP Basic Auth via
-- YOOKASSA_WEBHOOK_SECRET. service_role keeps EXECUTE — webhook keeps working.
--
-- Linter advisors closed by this fix:
--   0028 anon_security_definer_function_executable / add_tokens
--   0029 authenticated_security_definer_function_executable / add_tokens

REVOKE EXECUTE ON FUNCTION public.add_tokens(uuid, integer) FROM anon, authenticated, PUBLIC;
