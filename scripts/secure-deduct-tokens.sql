-- P0.2: secure deduct_tokens RPC
-- Applied as migration 2026-05-17 deduct_tokens_owner_check_and_revoke_anon
-- See docs/audits/2026-05-supabase-audit.md
--
-- Problem: SECURITY DEFINER function public.deduct_tokens(uuid, integer)
-- had EXECUTE granted to anon and authenticated without any owner check —
-- any caller could subtract tokens from any user's balance.
--
-- Why owner-check instead of plain REVOKE:
--   - app/api/chat/route.ts:108 calls deduct_tokens through user-context
--     supabase client (createClient(), JWT role 'authenticated').
--   - REVOKE EXECUTE FROM authenticated would break chat token billing.
--   - Owner-check inside the function lets the legit user-context call
--     continue while blocking everything else.
--
-- Bypass for service_role: app/api/transcribe/route.ts:58 and
-- app/api/payments/webhook/route.ts use createServiceClient(); auth.role()
-- returns 'service_role' in that context, so they pass the check.
--
-- Linter advisors:
--   0028 anon_security_definer_function_executable / deduct_tokens   → closed by REVOKE
--   0029 authenticated_security_definer_function_executable          → kept open intentionally;
--     EXECUTE for 'authenticated' is required, owner-check inside replaces the privilege restriction.

CREATE OR REPLACE FUNCTION public.deduct_tokens(p_user_id uuid, p_amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INT;
BEGIN
  IF NOT (
    (SELECT auth.uid()) = p_user_id
    OR (SELECT auth.role()) = 'service_role'
  ) THEN
    RAISE EXCEPTION 'deduct_tokens: caller % cannot deduct from %',
      COALESCE((SELECT auth.uid())::text, 'anon'), p_user_id
      USING ERRCODE = '42501';
  END IF;

  UPDATE profiles
  SET balance_tokens = balance_tokens - p_amount
  WHERE id = p_user_id AND balance_tokens >= p_amount;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deduct_tokens(uuid, integer) FROM anon, PUBLIC;
