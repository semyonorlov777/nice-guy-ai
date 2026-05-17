import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Загружает превью (последнее assistant-сообщение, обрезанное до 80 символов)
 * для списка chatIds. Возвращает Map<chatId, preview>.
 *
 * Обёрнут в React.cache для дедупликации в рамках одного RSC-запроса
 * (часто вызывается и из layout.tsx, и из chats/page.tsx).
 */
export const getChatPreviews = cache(async (
  supabase: SupabaseClient,
  chatIds: string[],
): Promise<Map<string, string>> => {
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
});
