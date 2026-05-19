-- 007_create_user_profile_responses.sql
--
-- User-level анкета: один профиль на пользователя, переиспользуется во всех
-- книгах. Питает PersonalizationService → инжекция в system_prompt чатов.
--
-- ВАЖНО: миграция уже применена в production (через Supabase MCP, версия
-- 20260519185855 — `create_user_profile_responses`). Этот файл — DDL-снапшот
-- для воспроизводимости в новых dev-окружениях и CI. Использует IF NOT EXISTS
-- везде, где возможно, чтобы повторный прогон не падал.

-- =============================================================================
-- Таблица
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_profile_responses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id   text        NOT NULL,
  answer_text   text        NOT NULL,
  version       integer     NOT NULL DEFAULT 1,
  source        text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  confirmed_at  timestamptz NULL,
  CONSTRAINT user_profile_responses_source_check
    CHECK (source IN ('anketa', 'soft_onboarding', 'manual_edit'))
);

COMMENT ON TABLE public.user_profile_responses IS
  'User-level anketa responses (one profile per user, reused across all books). Feeds PersonalizationService -> system_prompt injection. v1: raw answers only; derived_summary/current_position deferred to v2.';

COMMENT ON COLUMN public.user_profile_responses.version IS
  'Monotonic version per (user_id, question_id) -- каждый новый ответ создаёт новую строку с version+1, старые сохраняются для аудита/GDPR.';

COMMENT ON COLUMN public.user_profile_responses.source IS
  'How the answer was captured: anketa (standalone form), soft_onboarding (extracted from chat), manual_edit (user-edited in cabinet).';

COMMENT ON COLUMN public.user_profile_responses.confirmed_at IS
  'Заполняется при confirmation flow (R4 плана): пользователь подтвердил данные на входе в новую книгу.';

-- =============================================================================
-- Индексы
-- =============================================================================

-- Быстрый lookup всех ответов одного пользователя.
CREATE INDEX IF NOT EXISTS user_profile_responses_user_id_idx
  ON public.user_profile_responses (user_id);

-- Гарантирует, что для одной пары (user_id, question_id) одна версия = одна
-- строка. Позволяет append-only обновления без дублей.
CREATE UNIQUE INDEX IF NOT EXISTS user_profile_responses_user_question_version_idx
  ON public.user_profile_responses (user_id, question_id, version);

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.user_profile_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile responses" ON public.user_profile_responses;
CREATE POLICY "Users can read own profile responses"
  ON public.user_profile_responses
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile responses" ON public.user_profile_responses;
CREATE POLICY "Users can insert own profile responses"
  ON public.user_profile_responses
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile responses" ON public.user_profile_responses;
CREATE POLICY "Users can update own profile responses"
  ON public.user_profile_responses
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own profile responses" ON public.user_profile_responses;
CREATE POLICY "Users can delete own profile responses"
  ON public.user_profile_responses
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));
