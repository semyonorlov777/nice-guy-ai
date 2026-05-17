-- P0.3: lock down append_test_answer(uuid, jsonb, integer)
-- Applied as migration 2026-05-17 secure_append_test_answer_3arg
-- See docs/audits/2026-05-supabase-audit.md
--
-- Problem 1: function had a mutable search_path (advisor 0011) because the
--   add_expected_question_to_append_test_answer migration created this
--   overload without SET search_path.
-- Problem 2: EXECUTE was granted to anon and authenticated, no owner-check
--   inside the body (chats.user_id was not validated against auth.uid()).
--
-- Why plain REVOKE is safe here (no owner-check needed):
--   All callers in the codebase go through createServiceClient() (service_role):
--     app/api/test/answer/route.ts:202           — 3-arg form (p_expected_question)
--     app/api/test/_handlers/typed-answer.ts     — 4 calls, all 2-arg (P0.4)
--     app/api/test/_handlers/final-answer.ts:85  — 2-arg (P0.4)
--     app/api/test/_handlers/authenticated.ts:155 — 2-arg (P0.4)
--   service_role bypasses REVOKE, so user-facing test flow keeps working.
--
-- Linter advisors closed:
--   0011 function_search_path_mutable / append_test_answer
--   0028 anon_security_definer_function_executable / append_test_answer (uuid, jsonb, integer)
--   0029 authenticated_security_definer_function_executable / append_test_answer (uuid, jsonb, integer)

ALTER FUNCTION public.append_test_answer(uuid, jsonb, integer) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.append_test_answer(uuid, jsonb, integer) FROM anon, authenticated, PUBLIC;
