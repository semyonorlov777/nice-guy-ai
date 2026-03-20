-- RLS-политики для subscriptions и test_sessions
-- Запускать в Supabase SQL Editor или через apply_migration

-- ============================================================
-- 1. subscriptions — политики по user_id
-- ============================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- SELECT: пользователь видит только свои подписки
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'Users can read own subscriptions') THEN
    CREATE POLICY "Users can read own subscriptions"
      ON subscriptions FOR SELECT USING ((select auth.uid()) = user_id);
  END IF;

  -- INSERT: пользователь может создать подписку только себе
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'Users can insert own subscriptions') THEN
    CREATE POLICY "Users can insert own subscriptions"
      ON subscriptions FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
  END IF;

  -- UPDATE: пользователь может обновить только свою подписку
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'Users can update own subscriptions') THEN
    CREATE POLICY "Users can update own subscriptions"
      ON subscriptions FOR UPDATE USING ((select auth.uid()) = user_id);
  END IF;

  -- DELETE: НЕ добавляем — удаление только через service_role
END $$;

-- ============================================================
-- 2. test_sessions — политики НЕ добавлены намеренно
-- ============================================================
-- test_sessions: RLS включён, политики НЕ добавлены намеренно.
-- Таблица не имеет user_id — данные анонимные, доступ только через service_role.
-- Отсутствие политик при включённом RLS = полная блокировка для anon/authenticated ролей.
