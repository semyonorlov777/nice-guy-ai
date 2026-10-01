-- Голосовой практикум учебных консультаций (программа mipp-praktikum).
-- Тексты персонажей и рамок режимов живут в закрытых таблицах voice_modes/voice_clients
-- (RLS без политик — читает только service role) и в git не попадают.
-- Таблицы voice_* ссылаются только на auth.users / programs / program_modes —
-- чтобы целиком переехать в зону с базой в РФ.

-- 1. Тип взаимодействия режима
ALTER TABLE mode_templates ADD COLUMN IF NOT EXISTS interaction text NOT NULL DEFAULT 'text'
  CHECK (interaction IN ('text', 'test', 'voice'));
UPDATE mode_templates SET interaction = 'test' WHERE is_chat_based = false AND route_suffix LIKE '/test%';

-- 2. Доступ к практикуму выдаётся вручную (только тестовые аккаунты на этапе прототипа).
-- Отдельная таблица, а не колонка profiles: profiles студент может обновлять сам.
CREATE TABLE voice_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  note text,
  granted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX voice_access_program ON voice_access (program_id);
ALTER TABLE voice_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voice_access owner read" ON voice_access
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- 3. Рамка режима (секрет)
CREATE TABLE voice_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_mode_id uuid NOT NULL UNIQUE REFERENCES program_modes(id) ON DELETE CASCADE,
  frame_prompt text NOT NULL,
  precall_text text,
  client_slugs text[] NOT NULL DEFAULT '{}',
  max_seconds int NOT NULL DEFAULT 600,
  engine text,
  debrief_rubric jsonb,
  drill_moments jsonb NOT NULL DEFAULT '[]'::jsonb,
  retry_enabled boolean NOT NULL DEFAULT false,
  is_heavy boolean NOT NULL DEFAULT false,
  is_crisis boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE voice_modes ENABLE ROW LEVEL SECURITY;

-- 4. Учебные клиенты (секрет: prompt, config, hidden_layer)
CREATE TABLE voice_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  slug text NOT NULL,
  display_name text NOT NULL,
  level text NOT NULL CHECK (level IN ('A', 'B', 'V', 'G')),
  voice_name text NOT NULL,
  summary_public text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt text NOT NULL,
  hidden_layer jsonb NOT NULL DEFAULT '[]'::jsonb,
  version int NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, slug)
);
ALTER TABLE voice_clients ENABLE ROW LEVEL SECURITY;

-- 5. Сессии
CREATE TABLE voice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  program_mode_id uuid NOT NULL REFERENCES program_modes(id) ON DELETE CASCADE,
  client_id uuid REFERENCES voice_clients(id) ON DELETE SET NULL,
  client_version int,
  kind text NOT NULL DEFAULT 'full' CHECK (kind IN ('full', 'drill', 'warmup')),
  drill_moment_id text,
  attempt int NOT NULL DEFAULT 1,
  engine text NOT NULL DEFAULT 'gemini',
  engine_model text,
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'active', 'paused', 'reconnecting', 'ended', 'failed')),
  end_reason text,
  seconds_limit int NOT NULL,
  seconds_used int NOT NULL DEFAULT 0,
  usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  ticket_hash text,
  ticket_expires_at timestamptz,
  conn_id text,
  reconnects int NOT NULL DEFAULT 0,
  difficulty_rating smallint CHECK (difficulty_rating BETWEEN 0 AND 10),
  reaction text,
  integrity_flags text[] NOT NULL DEFAULT '{}',
  counts_toward_quota boolean NOT NULL DEFAULT true,
  started_at timestamptz,
  paused_at timestamptz,
  ended_at timestamptz,
  last_heartbeat_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '90 days',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX voice_sessions_one_live_per_user
  ON voice_sessions (user_id) WHERE status IN ('created', 'active', 'paused', 'reconnecting');
CREATE INDEX voice_sessions_user_created ON voice_sessions (user_id, program_id, created_at DESC);
CREATE INDEX voice_sessions_live_heartbeat ON voice_sessions (status, last_heartbeat_at)
  WHERE status IN ('created', 'active', 'paused', 'reconnecting');
CREATE INDEX voice_sessions_ticket ON voice_sessions (ticket_hash) WHERE ticket_hash IS NOT NULL;
CREATE INDEX voice_sessions_expires ON voice_sessions (expires_at);
CREATE INDEX voice_sessions_program_mode ON voice_sessions (program_mode_id);
CREATE INDEX voice_sessions_client ON voice_sessions (client_id);
CREATE INDEX voice_sessions_program ON voice_sessions (program_id);
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voice_sessions owner read" ON voice_sessions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- 6. Реплики (расшифровка), без аудио
CREATE TABLE voice_turns (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
  seq int NOT NULL,
  role text NOT NULL CHECK (role IN ('student', 'client')),
  text text NOT NULL,
  t_start_ms int,
  t_end_ms int,
  segment int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, seq)
);
ALTER TABLE voice_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voice_turns owner read" ON voice_turns
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM voice_sessions s WHERE s.id = session_id AND s.user_id = (SELECT auth.uid())
  ));

-- 7. Разбор
CREATE TABLE voice_debriefs (
  session_id uuid PRIMARY KEY REFERENCES voice_sessions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'ready', 'failed', 'none')),
  started_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  is_fallback boolean NOT NULL DEFAULT false,
  rubric_version text,
  model text,
  result jsonb,
  counters jsonb,
  scores jsonb,
  strength jsonb,
  fix jsonb,
  repeat jsonb,
  summary text,
  hidden_layer_reached boolean,
  integrity_valid boolean,
  curator jsonb,
  usage jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE voice_debriefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voice_debriefs owner read" ON voice_debriefs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM voice_sessions s WHERE s.id = session_id AND s.user_id = (SELECT auth.uid())
  ));

-- 8. Самоотчёты студента: анкета, уверенность, трудность, самочувствие
CREATE TABLE voice_self_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('anketa', 'confidence_pre', 'confidence_post', 'difficulty', 'wellbeing')),
  session_id uuid REFERENCES voice_sessions(id) ON DELETE CASCADE,
  day date NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  sum int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX voice_self_reports_daily
  ON voice_self_reports (user_id, program_id, day, kind) WHERE kind IN ('confidence_pre', 'confidence_post');
CREATE INDEX voice_self_reports_user ON voice_self_reports (user_id, program_id, created_at DESC);
CREATE INDEX voice_self_reports_session ON voice_self_reports (session_id);
CREATE INDEX voice_self_reports_program ON voice_self_reports (program_id);
ALTER TABLE voice_self_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voice_self_reports owner read" ON voice_self_reports
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- 9. Дневной расход секунд (граница дня — Москва)
CREATE VIEW voice_daily_usage WITH (security_invoker = true) AS
  SELECT user_id,
         (started_at AT TIME ZONE 'Europe/Moscow')::date AS day,
         sum(seconds_used)::int AS seconds
  FROM voice_sessions
  WHERE counts_toward_quota AND started_at IS NOT NULL
  GROUP BY user_id, (started_at AT TIME ZONE 'Europe/Moscow')::date;

-- 10. Тик ретранслятора: прибавить секунды, вернуть остаток. Только service role.
CREATE OR REPLACE FUNCTION voice_session_tick(p_session_id uuid, p_seconds int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining int;
BEGIN
  UPDATE voice_sessions
     SET seconds_used = LEAST(seconds_limit, seconds_used + GREATEST(p_seconds, 0)),
         last_heartbeat_at = now()
   WHERE id = p_session_id
  RETURNING seconds_limit - seconds_used INTO v_remaining;
  RETURN COALESCE(v_remaining, 0);
END;
$$;
REVOKE ALL ON FUNCTION voice_session_tick(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION voice_session_tick(uuid, int) TO service_role;
