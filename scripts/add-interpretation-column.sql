-- Добавляет колонки для интерпретации и статуса обработки результатов ИССП
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS interpretation jsonb;
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS status text DEFAULT 'processing';
