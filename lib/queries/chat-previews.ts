import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Загружает превью (последнее assistant-сообщение, обрезанное до 80 символов)
 * для списка chatIds. Возвращает Map<chatId, preview>.
 */
export async function getChatPreviews(
  supabase: SupabaseClient,
  chatIds: string[],
): Promise<Map<string, string>> {
  const previews = new Map<string, string>();
  if (chatIds.length === 0) return previews;

  const { data: lastMessages } = await supabase
    .from("messages")
    .select("chat_id, content")
    .in("chat_id", chatIds)
    .eq("role", "assistant")
    .order("created_at", { ascending: false });

  if (lastMessages) {
    for (const msg of lastMessages) {
      if (!previews.has(msg.chat_id)) {
        previews.set(msg.chat_id, msg.content.slice(0, 80));
      }
    }
  }

  return previews;
}
