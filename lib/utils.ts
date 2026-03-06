import type { UIMessage } from "ai";

/**
 * Конвертирует массив { role, content } из БД в UIMessage[] для useChat initialMessages.
 */
export function toUIMessages(
  messages: { role: string; content: string }[]
): UIMessage[] {
  return messages.map((msg, i) => ({
    id: `db-${i}`,
    role: msg.role as "user" | "assistant",
    parts: [{ type: "text" as const, text: msg.content }],
  }));
}
