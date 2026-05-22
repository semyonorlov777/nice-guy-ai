import { db, TABLES } from "@mini/voice/lib/db";
import type { Chat, ChatWithLastMessage, Message, MessageSource } from "@mini/voice/lib/types";

export async function listChats(): Promise<ChatWithLastMessage[]> {
  const supabase = db();
  const { data: chats, error } = await supabase
    .from(TABLES.chats)
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  if (!chats || chats.length === 0) return [];

  const ids = chats.map((c) => c.id);
  const { data: messages, error: msgErr } = await supabase
    .from(TABLES.messages)
    .select("chat_id, text, created_at")
    .in("chat_id", ids)
    .order("created_at", { ascending: false });
  if (msgErr) throw msgErr;

  const lastByChat = new Map<string, { text: string; at: string }>();
  const countByChat = new Map<string, number>();
  for (const m of messages ?? []) {
    countByChat.set(m.chat_id, (countByChat.get(m.chat_id) ?? 0) + 1);
    if (!lastByChat.has(m.chat_id)) {
      lastByChat.set(m.chat_id, { text: m.text, at: m.created_at });
    }
  }

  return chats.map((c) => ({
    ...(c as Chat),
    last_message_text: lastByChat.get(c.id)?.text ?? null,
    last_message_at: lastByChat.get(c.id)?.at ?? null,
    message_count: countByChat.get(c.id) ?? 0,
  }));
}

export async function getChat(id: string): Promise<Chat | null> {
  const supabase = db();
  const { data, error } = await supabase.from(TABLES.chats).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Chat | null) ?? null;
}

export async function createChat(title?: string): Promise<Chat> {
  const supabase = db();
  const finalTitle =
    title?.trim() ||
    `Заметка ${new Date().toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`;
  const { data, error } = await supabase
    .from(TABLES.chats)
    .insert({ title: finalTitle, kind: "manual" })
    .select("*")
    .single();
  if (error) throw error;
  return data as Chat;
}

// Лениво создаёт уникальный inbox-чат (one per system). Защищено уникальным индексом.
export async function getOrCreateInbox(): Promise<Chat> {
  const supabase = db();
  const { data: existing, error: selErr } = await supabase
    .from(TABLES.chats)
    .select("*")
    .eq("kind", "inbox")
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing as Chat;

  const { data, error } = await supabase
    .from(TABLES.chats)
    .insert({ title: "Telegram Inbox", kind: "inbox" })
    .select("*")
    .single();
  if (error) {
    // Race: кто-то успел вставить параллельно — перечитываем.
    const { data: again } = await supabase
      .from(TABLES.chats)
      .select("*")
      .eq("kind", "inbox")
      .maybeSingle();
    if (again) return again as Chat;
    throw error;
  }
  return data as Chat;
}

export async function listMessages(chatId: string): Promise<Message[]> {
  const supabase = db();
  const { data, error } = await supabase
    .from(TABLES.messages)
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as Message[]) ?? [];
}

export async function addMessage(input: {
  chat_id: string;
  source: MessageSource;
  text: string;
  audio_duration_sec?: number | null;
}): Promise<Message> {
  const supabase = db();
  const { data, error } = await supabase
    .from(TABLES.messages)
    .insert({
      chat_id: input.chat_id,
      source: input.source,
      text: input.text,
      audio_duration_sec: input.audio_duration_sec ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  // Bump updated_at чата чтобы сортировка списка работала.
  await supabase
    .from(TABLES.chats)
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.chat_id);

  return data as Message;
}

export async function deleteChat(id: string): Promise<void> {
  const supabase = db();
  const { error } = await supabase.from(TABLES.chats).delete().eq("id", id);
  if (error) throw error;
}

export async function renameChat(id: string, title: string): Promise<void> {
  const supabase = db();
  const { error } = await supabase.from(TABLES.chats).update({ title }).eq("id", id);
  if (error) throw error;
}
