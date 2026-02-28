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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portraits' AND policyname = 'Users can read own portrait') THEN
    CREATE POLICY "Users can read own portrait"
      ON portraits FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portraits' AND policyname = 'Users can update own portrait') THEN
    CREATE POLICY "Users can update own portrait"
      ON portraits FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portraits' AND policyname = 'Users can insert own portrait') THEN
    CREATE POLICY "Users can insert own portrait"
      ON portraits FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
