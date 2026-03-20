import type { SupabaseClient } from "@supabase/supabase-js";

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
