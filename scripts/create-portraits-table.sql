-- Create portraits table (run in Supabase SQL Editor)
-- Skip if table already exists

CREATE TABLE IF NOT EXISTS portraits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  program_id  uuid REFERENCES programs(id) ON DELETE CASCADE NOT NULL,
  content     jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_portraits_user_program
  ON portraits(user_id, program_id);

ALTER TABLE portraits ENABLE ROW LEVEL SECURITY;

-- Policies (use CREATE ... IF NOT EXISTS pattern via DO block)
-- (SELECT auth.uid()) обёртка вместо голого auth.uid() — initPlan-форма,
-- кешируется на запрос; см. Supabase RLS perf best practices.
-- UPDATE policy явно указывает WITH CHECK, не полагаясь на дефолт USING-as-CHECK.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portraits' AND policyname = 'Users can read own portrait') THEN
    CREATE POLICY "Users can read own portrait"
      ON portraits FOR SELECT USING (user_id = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portraits' AND policyname = 'Users can update own portrait') THEN
    CREATE POLICY "Users can update own portrait"
      ON portraits FOR UPDATE
      USING (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portraits' AND policyname = 'Users can insert own portrait') THEN
    CREATE POLICY "Users can insert own portrait"
      ON portraits FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;
