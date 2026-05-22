-- mini/voice/migrations/001_init.sql
-- Применено через MCP supabase apply_migration "voice_recreate_in_public".
-- Этот файл — копия для воспроизводимости при подъёме чистой БД.
--
-- Архитектурное замечание: изначально таблицы создавались в schema voice,
-- но Supabase не пускает ALTER DATABASE pgrst.db_schemas под нашими правами,
-- поэтому таблицы живут в public с префиксом voice_*. Изоляция остаётся
-- по имени; service role обходит RLS.

CREATE TABLE public.voice_chats (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL DEFAULT 'Без названия',
  kind        text NOT NULL DEFAULT 'manual',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voice_chats_kind_check CHECK (kind IN ('manual', 'inbox'))
);

CREATE TABLE public.voice_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id             uuid NOT NULL REFERENCES public.voice_chats(id) ON DELETE CASCADE,
  source              text NOT NULL,
  text                text NOT NULL,
  audio_duration_sec  integer,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voice_messages_source_check CHECK (source IN ('web', 'telegram'))
);

CREATE INDEX voice_messages_chat_idx ON public.voice_messages(chat_id, created_at DESC);
CREATE INDEX voice_chats_updated_idx ON public.voice_chats(updated_at DESC);
CREATE UNIQUE INDEX voice_chats_one_inbox ON public.voice_chats(kind) WHERE kind = 'inbox';

ALTER TABLE public.voice_chats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_messages ENABLE ROW LEVEL SECURITY;
-- Политик нет намеренно — single-user мини, всё ходит через service role.
