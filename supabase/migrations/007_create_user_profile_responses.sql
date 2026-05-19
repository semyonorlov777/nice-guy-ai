-- Таблица хранит ответы пользователя на анкету User-level персонализации.
-- Один профиль на пользователя, переиспользуется во всех книгах платформы.
-- Используется PersonalizationService (Этап 2.2) для инъекции контекста в system_prompt тренажёров.
--
-- question_id для пилота на nice-guy (Гловер):
--   - context_intent  -- что привело к этой книге
--   - problem         -- что в жизни/работе сейчас не так
--   - implication     -- что произойдёт через 6-12 мес если не менять
--   - need_payoff     -- как поймёшь, что программа сработала
-- Конкретные тексты вопросов хранятся не здесь, а в коде/конфиге анкеты (отдельной задачей).

CREATE TABLE public.user_profile_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  answer_text text NOT NULL,
  version int NOT NULL DEFAULT 1,
  source text NOT NULL CHECK (source IN ('anketa', 'soft_onboarding', 'manual_edit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

CREATE INDEX user_profile_responses_user_id_idx
  ON public.user_profile_responses(user_id);

CREATE UNIQUE INDEX user_profile_responses_user_question_version_idx
  ON public.user_profile_responses(user_id, question_id, version);

ALTER TABLE public.user_profile_responses ENABLE ROW LEVEL SECURITY;

-- RLS: каждый пользователь читает/пишет/редактирует/удаляет только свои строки.
-- Паттерн (SELECT auth.uid()) -- initPlan-оптимизация, конвенция проекта
-- (см. scripts/create-portraits-table.sql, scripts/add-rls-subscriptions-test-sessions.sql).

CREATE POLICY "Users can read own profile responses"
  ON public.user_profile_responses FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own profile responses"
  ON public.user_profile_responses FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own profile responses"
  ON public.user_profile_responses FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own profile responses"
  ON public.user_profile_responses FOR DELETE
  USING (user_id = (SELECT auth.uid()));

COMMENT ON TABLE public.user_profile_responses IS
  'User-level anketa responses (one profile per user, reused across all books). Feeds PersonalizationService -> system_prompt injection. v1: raw answers only; derived_summary/current_position deferred to v2.';
COMMENT ON COLUMN public.user_profile_responses.source IS
  'How the answer was captured: anketa (standalone form), soft_onboarding (extracted from chat), manual_edit (user-edited in cabinet).';
COMMENT ON COLUMN public.user_profile_responses.version IS
  'Monotonic version per (user_id, question_id) -- каждый новый ответ создаёт новую строку с version+1, старые сохраняются для аудита/GDPR.';
COMMENT ON COLUMN public.user_profile_responses.confirmed_at IS
  'Заполняется при confirmation flow (R4 плана): пользователь подтвердил данные на входе в новую книгу.';
