-- Атомарный append ответа для анонимных test_sessions
-- Аналог append_test_answer (для chats), но для test_sessions
-- Использует FOR UPDATE для предотвращения race conditions

CREATE OR REPLACE FUNCTION append_anonymous_test_answer(
  p_session_id text,
  p_answer jsonb,
  p_expected_question integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row test_sessions%ROWTYPE;
  v_answers jsonb;
  v_messages jsonb;
BEGIN
  -- Lock row to prevent concurrent updates
  SELECT * INTO v_row
  FROM test_sessions
  WHERE session_id = p_session_id
  FOR UPDATE;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;

  IF v_row.status <> 'in_progress' THEN
    RAISE EXCEPTION 'session_not_active';
  END IF;

  -- Desync check: client question must match server
  IF v_row.current_question <> p_expected_question THEN
    RETURN jsonb_build_object(
      'error', 'question_mismatch',
      'server_question', v_row.current_question,
      'answers_count', jsonb_array_length(COALESCE(v_row.answers, '[]'::jsonb))
    );
  END IF;

  -- Append answer
  v_answers := COALESCE(v_row.answers, '[]'::jsonb) || jsonb_build_array(p_answer);

  -- Append user message
  v_messages := COALESCE(v_row.messages, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('role', 'user', 'content', (p_answer->>'rawAnswer')::text)
  );

  -- Atomic update
  UPDATE test_sessions SET
    current_question = p_expected_question + 1,
    answers = v_answers,
    messages = v_messages,
    updated_at = now()
  WHERE session_id = p_session_id;

  RETURN jsonb_build_object(
    'current_question', p_expected_question + 1,
    'answers_count', jsonb_array_length(v_answers)
  );
END;
$$;
