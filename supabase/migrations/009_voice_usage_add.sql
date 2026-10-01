-- Расход токенов голосовой сессии прибавляется, а не перезаписывается:
-- при переподключении старое и новое соединения пишут независимо.
CREATE OR REPLACE FUNCTION voice_session_add_usage(p_session_id uuid, p_prompt int, p_response int)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE voice_sessions
     SET usage = jsonb_build_object(
       'prompt_tokens', COALESCE((usage->>'prompt_tokens')::int, 0) + GREATEST(p_prompt, 0),
       'response_tokens', COALESCE((usage->>'response_tokens')::int, 0) + GREATEST(p_response, 0))
   WHERE id = p_session_id;
$$;
REVOKE ALL ON FUNCTION voice_session_add_usage(uuid, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION voice_session_add_usage(uuid, int, int) TO service_role;
