-- Атомарное добавление ответа в test_state чата
-- Решает race condition при быстрых ответах (fire-and-forget перезатирал данные)
-- Выполнить в Supabase SQL Editor

CREATE OR REPLACE FUNCTION append_test_answer(
  p_chat_id uuid,
  p_answer jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_state jsonb;
BEGIN
  -- Блокируем строку на время обновления (FOR UPDATE)
  SELECT test_state INTO v_state
  FROM chats WHERE id = p_chat_id FOR UPDATE;

  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Chat % has no test_state', p_chat_id;
  END IF;

  -- Добавляем ответ в массив answers
  v_state := jsonb_set(
    v_state,
    '{answers}',
    COALESCE(v_state->'answers', '[]'::jsonb) || jsonb_build_array(p_answer)
  );

  -- Инкрементируем current_question
  v_state := jsonb_set(
    v_state,
    '{current_question}',
    to_jsonb(COALESCE((v_state->>'current_question')::int, 0) + 1)
  );

  -- Обновляем запись
  UPDATE chats SET test_state = v_state WHERE id = p_chat_id;

  RETURN v_state;
END;
$$;
