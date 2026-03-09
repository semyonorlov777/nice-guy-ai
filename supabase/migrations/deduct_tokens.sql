-- Атомарное списание токенов с проверкой баланса.
-- Возвращает TRUE если токены списаны, FALSE если баланс недостаточен.
-- Используется из chat/route.ts через supabase.rpc('deduct_tokens', {...})
CREATE OR REPLACE FUNCTION deduct_tokens(p_user_id UUID, p_amount INT)
RETURNS BOOLEAN AS $$
DECLARE rows_affected INT;
BEGIN
  UPDATE profiles
  SET balance_tokens = balance_tokens - p_amount
  WHERE id = p_user_id AND balance_tokens >= p_amount;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
