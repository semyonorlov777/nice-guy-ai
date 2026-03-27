export interface WelcomeReply {
  text: string;
  type: "normal" | "exit";
}

/**
 * Normalizes welcome_replies from DB (can be string[] or WelcomeReply[]) to WelcomeReply[].
 */
export function normalizeWelcomeReplies(raw: unknown): WelcomeReply[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return { text: item, type: "normal" as const };
      if (item && typeof item === "object" && "text" in item)
        return item as WelcomeReply;
      return null;
    })
    .filter((r): r is WelcomeReply => r !== null);
}

export interface WelcomeConfig {
  modeLabel: string;
  title: string;
  subtitle: string;
  aiMessage: string;
  replies: WelcomeReply[];
  chatType?: string;
  systemContext?: string;
}
