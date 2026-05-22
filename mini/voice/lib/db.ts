import { createClient } from "@supabase/supabase-js";

// Service-role клиент для таблиц voice_chats / voice_messages.
// Используется только на сервере (api/*) — никогда не импортируется в клиентский код.
//
// Таблицы живут в public.voice_* (а не в schema voice), потому что отдельная schema
// требует ALTER DATABASE pgrst.db_schemas — а на Supabase под нашими правами это
// не сработало. Изоляция от основного приложения — через префикс voice_* в именах
// (никаких пересечений с core-таблицами основного приложения нет).
//
// Анонимного доступа нет: RLS включена, политик нет. Все запросы идут через service
// role и обходят RLS.

export const TABLES = {
  chats: "voice_chats",
  messages: "voice_messages",
} as const;

export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
