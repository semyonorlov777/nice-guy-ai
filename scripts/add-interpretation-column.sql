-- Добавляет колонку для структурированной интерпретации результатов ИССП
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS interpretation jsonb;
