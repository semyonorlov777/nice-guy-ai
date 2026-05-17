-- P2: MEDIUM-severity batch from supabase audit 2026-05-17
-- Applied as migration p2_update_with_check_dedupe_programs_indexes
-- See docs/audits/2026-05-supabase-audit.md
--
-- 1. Explicit WITH CHECK on UPDATE policies (4 tables).
--    Postgres uses USING as WITH CHECK by default, so there is no immediate
--    vulnerability — but explicit WITH CHECK protects against future edits
--    that loosen USING. Recommended by Supabase RLS best practices.
-- 2. Merge two duplicate SELECT policies on public.programs (anon + authenticated)
--    into a single policy for role 'public'.
-- 3. Drop unused redundant index idx_profiles_google_id — it duplicates the
--    automatic btree index behind UNIQUE constraint profiles_google_id_key.
-- 4. Add partial index idx_test_sessions_cleanup that was declared in
--    scripts/test-sessions-migration.sql:18 but never landed in DB.

-- 1. UPDATE policies
ALTER POLICY "Users update own chats"
  ON public.chats
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY "Users can update own portrait"
  ON public.portraits
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY "Users update own profile"
  ON public.profiles
  WITH CHECK (id = (SELECT auth.uid()));

ALTER POLICY "Users can update own subscriptions"
  ON public.subscriptions
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 2. Merge duplicate programs read policies
DROP POLICY IF EXISTS "Anyone can read programs" ON public.programs;
DROP POLICY IF EXISTS "Authenticated users can read programs" ON public.programs;
CREATE POLICY "Programs are public"
  ON public.programs
  FOR SELECT
  TO public
  USING (true);

-- 3. Drop redundant unused index
DROP INDEX IF EXISTS public.idx_profiles_google_id;

-- 4. Add missing partial cleanup index for test_sessions
CREATE INDEX IF NOT EXISTS idx_test_sessions_cleanup
  ON public.test_sessions(created_at)
  WHERE status = 'in_progress';
