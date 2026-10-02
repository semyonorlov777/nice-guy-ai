-- Голосовой разбор после учебной консультации («как в учебной тройке»).
-- Разбор — отдельная сессия kind='debrief', привязанная к встрече (parent_session_id):
-- свой учёт секунд и переподключений, дневные минуты не тратит.
-- Этап разговора хранится в уже существующей колонке voice_turns.segment
-- (1 — студент о себе с наблюдателем, 2 — клиент вне роли, 3 — наблюдатель),
-- состояние сценария между соединениями — в script_state.

ALTER TABLE voice_sessions DROP CONSTRAINT voice_sessions_kind_check;
ALTER TABLE voice_sessions ADD CONSTRAINT voice_sessions_kind_check
  CHECK (kind IN ('full', 'drill', 'warmup', 'debrief'));

ALTER TABLE voice_sessions ADD COLUMN parent_session_id uuid REFERENCES voice_sessions(id) ON DELETE CASCADE;
ALTER TABLE voice_sessions ADD COLUMN script_state jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX voice_sessions_parent ON voice_sessions (parent_session_id);
-- Один разбор на встречу; сорвавшийся (failed) можно начать заново.
CREATE UNIQUE INDEX voice_sessions_one_debrief_per_parent
  ON voice_sessions (parent_session_id) WHERE kind = 'debrief' AND status <> 'failed';

-- Третий голос разбора — наблюдатель.
ALTER TABLE voice_turns DROP CONSTRAINT voice_turns_role_check;
ALTER TABLE voice_turns ADD CONSTRAINT voice_turns_role_check
  CHECK (role IN ('student', 'client', 'observer'));
