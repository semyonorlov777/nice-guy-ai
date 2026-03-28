import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostgrestError } from "@supabase/postgrest-js";

/**
 * Загружает сообщения чата в хронологическом порядке.
 * Возвращает массив { role, content }.
 */
export async function getChatMessages(
  supabase: SupabaseClient,
  chatId: string,
): Promise<{ role: string; content: string }[]> {
  const { data: messages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  return (messages || []).map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

export interface InsertMessageParams {
  chatId: string;
  role: "user" | "assistant";
  content: string;
  tokensUsed?: number;
}

/**
 * Вставляет одно сообщение в чат.
 */
export async function insertMessage(
  supabase: SupabaseClient,
  params: InsertMessageParams,
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.from("messages").insert({
    chat_id: params.chatId,
    role: params.role,
    content: params.content,
    tokens_used: params.tokensUsed ?? 0,
  });
  return { error };
}

/**
 * Вставляет несколько сообщений в чат за один запрос.
 */
export async function insertMessages(
  supabase: SupabaseClient,
  messages: InsertMessageParams[],
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.from("messages").insert(
    messages.map((m) => ({
      chat_id: m.chatId,
      role: m.role,
      content: m.content,
      tokens_used: m.tokensUsed ?? 0,
    })),
  );
  return { error };
}
