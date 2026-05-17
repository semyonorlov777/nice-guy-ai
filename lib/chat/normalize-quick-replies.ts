/**
 * Нормализация «ёлочек» из БД к единому формату `{text, type}`.
 *
 * Поля БД могут приходить в двух форматах:
 *  - Новый/каноничный: `[{text, type: "normal" | "exit"}]` — используется в
 *    `program_modes.welcome_replies`, `program_themes.welcome_replies`, а с
 *    2026-05 — в `programs.anonymous_quick_replies` для новых программ.
 *  - Legacy: `["строка1", "строка2"]` — старый формат `anonymous_quick_replies`
 *    оставшихся программ. Runbook не рекомендует, но компонент должен пережить.
 *
 * Правило exit для legacy-строк: последний reply становится `type: "exit"`
 * только если их ≥3 или ровно 1 (см. parse-quick-replies — то же правило).
 *
 * Source of truth — этот файл. Не дублируй логику в компонентах; импортируй.
 */
import type { QuickReply } from "./parse-quick-replies";

export type QuickReplyInput =
  | string
  | { text: string; type?: "normal" | "exit" };

export function normalizeQuickReplies(
  replies: QuickReplyInput[] | undefined | null,
): QuickReply[] {
  if (!replies || replies.length === 0) return [];

  if (typeof replies[0] === "string") {
    return (replies as string[]).map((text, idx, arr) => {
      const isLast = idx === arr.length - 1;
      const shouldBeExit = isLast && (arr.length >= 3 || arr.length === 1);
      return { text, type: shouldBeExit ? "exit" : "normal" };
    });
  }

  return (replies as Array<{ text: string; type?: "normal" | "exit" }>).map(
    (r) => ({ text: r.text, type: r.type ?? "normal" }),
  );
}
