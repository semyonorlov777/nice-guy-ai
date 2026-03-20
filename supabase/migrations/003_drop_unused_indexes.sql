-- Удалить неиспользуемые/дублирующие индексы
-- idx_orders_user: orders доступны только через service_role, FK join покрыт
-- idx_orders_yookassa: webhook ищет по yookassa_payment_id редко (1-2 раза за платёж)
-- idx_orders_idempotency: дублирует unique constraint orders_idempotency_key_key
-- idx_test_sessions_cleanup: partial index для cleanup, не используется
DROP INDEX IF EXISTS idx_orders_user;
DROP INDEX IF EXISTS idx_orders_yookassa;
DROP INDEX IF EXISTS idx_orders_idempotency;
DROP INDEX IF EXISTS idx_test_sessions_cleanup;
