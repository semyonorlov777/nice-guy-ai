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

-- RLS включён, но прямой доступ для anon/authenticated запрещён deny-all policy
-- (см. scripts/p1-lockdown-trigger-fns-and-test-sessions.sql). Все легальные
-- обращения идут через:
--   - public.append_anonymous_test_answer (SECURITY DEFINER, owner-bypass) — анонимный путь
--   - createServiceClient() в app/api/test/*  (service_role, bypass RLS) — сервер
ALTER TABLE test_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Direct access blocked"
  ON test_sessions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE test_sessions FROM anon, authenticated;

COMMENT ON TABLE test_sessions IS
  'Anonymous test sessions. Direct access denied for anon and authenticated '
  '(deny-all RLS policy + revoked table privileges). All reads/writes go '
  'through SECURITY DEFINER function append_anonymous_test_answer (anon path) '
  'or service_role (server-side handlers in app/api/test/*).';

-- Индексы
CREATE INDEX IF NOT EXISTS idx_test_sessions_session_id ON test_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_cleanup ON test_sessions(created_at) WHERE status = 'in_progress';

-- Комментарий для будущего: cron удаляет WHERE created_at < now() - interval '24 hours' AND status = 'in_progress'
