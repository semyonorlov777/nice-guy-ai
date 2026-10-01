-- Закрываем самостоятельную правку profiles пользователями.
-- Было: политика "Users update own profile" + табличное право UPDATE у anon/authenticated
-- → вошедший пользователь через REST мог выставить себе balance_tokens, subscription_* и т.п.
-- Клиент (браузер) в profiles не пишет вообще: все записи — с сервера через service role
-- (oauth-common, webhook YooKassa, отмена подписки, отвязка карты, dev-login)
-- или через SECURITY DEFINER функции (deduct_tokens, add_tokens, handle_new_user).
-- Поэтому оставляем пользователям только чтение своей строки.

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.profiles FROM anon, authenticated;

-- deduct_tokens доступна authenticated (списание из /api/chat от имени пользователя).
-- Отрицательная сумма превращала списание в начисление — запрещаем.
CREATE OR REPLACE FUNCTION public.deduct_tokens(p_user_id uuid, p_amount integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rows_affected INT;
BEGIN
  IF NOT (
    (SELECT auth.uid()) = p_user_id
    OR (SELECT auth.role()) = 'service_role'
  ) THEN
    RAISE EXCEPTION 'deduct_tokens: caller % cannot deduct from %',
      COALESCE((SELECT auth.uid())::text, 'anon'), p_user_id
      USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'deduct_tokens: amount must be >= 0, got %', p_amount
      USING ERRCODE = '22023';
  END IF;

  UPDATE profiles
  SET balance_tokens = balance_tokens - p_amount
  WHERE id = p_user_id AND balance_tokens >= p_amount;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$function$;
