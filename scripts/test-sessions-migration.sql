-- Таблица для анонимных тестовых сессий (до авторизации)
CREATE TABLE IF NOT EXISTS test_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       text UNIQUE NOT NULL,
  test_slug        text NOT NULL DEFAULT 'issp',
  status           text DEFAULT 'in_progress',
  current_question integer DEFAULT 0,
  answers          jsonb DEFAULT '[]',
  messages         jsonb DEFAULT '[]',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- БЕЗ RLS — анонимные данные, доступ по session_id через service client

-- Индексы
CREATE INDEX IF NOT EXISTS idx_test_sessions_session_id ON test_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_cleanup ON test_sessions(created_at) WHERE status = 'in_progress';

-- Комментарий для будущего: cron удаляет WHERE created_at < now() - interval '24 hours' AND status = 'in_progress'
