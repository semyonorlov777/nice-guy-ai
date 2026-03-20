-- Индексы на foreign keys для ускорения JOIN и CASCADE операций
CREATE INDEX IF NOT EXISTS idx_chats_exercise_id ON chats(exercise_id);
CREATE INDEX IF NOT EXISTS idx_chats_program_id ON chats(program_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_portraits_program_id ON portraits(program_id);
CREATE INDEX IF NOT EXISTS idx_test_results_chat_id ON test_results(chat_id);
CREATE INDEX IF NOT EXISTS idx_test_results_program_id ON test_results(program_id);
