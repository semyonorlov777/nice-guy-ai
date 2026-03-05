-- ИССП: Миграция базы данных для диагностического теста
-- Выполнить в Supabase SQL Editor

-- 1. Добавляем chat_type в таблицу chats
ALTER TABLE chats ADD COLUMN IF NOT EXISTS chat_type TEXT DEFAULT 'exercise';

-- Обновляем существующие записи
UPDATE chats SET chat_type = 'free' WHERE exercise_id IS NULL;
UPDATE chats SET chat_type = 'exercise' WHERE exercise_id IS NOT NULL;

-- 2. Добавляем test_state для хранения прогресса теста
ALTER TABLE chats ADD COLUMN IF NOT EXISTS test_state JSONB DEFAULT NULL;

-- 3. Добавляем test_system_prompt в programs
ALTER TABLE programs ADD COLUMN IF NOT EXISTS test_system_prompt TEXT;

-- 4. Создаём таблицу test_results
CREATE TABLE IF NOT EXISTS test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL,
  program_id uuid REFERENCES programs(id) NOT NULL,
  chat_id uuid REFERENCES chats(id) NOT NULL,
  total_score integer NOT NULL,
  total_raw integer NOT NULL,
  scores_by_scale jsonb NOT NULL,
  answers jsonb NOT NULL,
  recommended_exercises jsonb,
  top_scales jsonb,
  created_at timestamptz DEFAULT now()
);

-- RLS для test_results
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own test results" ON test_results
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service can insert test results" ON test_results
  FOR INSERT WITH CHECK (true);

-- Индекс для быстрого поиска результатов по пользователю и программе
CREATE INDEX IF NOT EXISTS idx_test_results_user_program
  ON test_results(user_id, program_id, created_at DESC);
