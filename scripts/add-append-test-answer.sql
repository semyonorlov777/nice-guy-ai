-- Атомарное добавление ответа в test_state чата (2-arg overload, legacy).
-- Решает race condition при быстрых ответах (fire-and-forget перезатирал данные).
-- В проде вызывается только через serviceClient из:
--   app/api/test/_handlers/typed-answer.ts  — 4 раза
--   app/api/test/_handlers/final-answer.ts
--   app/api/test/_handlers/authenticated.ts
-- Поэтому EXECUTE для anon/authenticated не нужен — REVOKE'нут после аудита.
--
-- Для нового кода предпочитайте 3-arg overload (см. migration
-- add_expected_question_to_append_test_answer) — он умеет desync-check.
--
-- Зеркало миграций: secure-append-test-answer-2arg.sql (см. рядом).

CREATE OR REPLACE FUNCTION append_test_answer(
  p_chat_id uuid,
  p_answer jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state jsonb;
BEGIN
  SELECT test_state INTO v_state
  FROM chats WHERE id = p_chat_id FOR UPDATE;

  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Chat % has no test_state', p_chat_id;
  END IF;

  v_state := jsonb_set(
    v_state,
    '{answers}',
    COALESCE(v_state->'answers', '[]'::jsonb) || jsonb_build_array(p_answer)
  );

  v_state := jsonb_set(
    v_state,
    '{current_question}',
    to_jsonb(COALESCE((v_state->>'current_question')::int, 0) + 1)
  );

  UPDATE chats SET test_state = v_state WHERE id = p_chat_id;

  RETURN v_state;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.append_test_answer(uuid, jsonb) FROM anon, authenticated, PUBLIC;
