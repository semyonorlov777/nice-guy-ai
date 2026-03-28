export type CardPhase =
  | "loading"
  | "welcome"
  | "question"
  | "block_transition"
  | "auth_wall"
  | "migrating"
  | "history"
  | "analyzing"
  | "complete";

export type StatusMessage = "analyzing" | "recorded" | "slow" | "fallback" | "fallback_timeout" | null;

export const TEXT_TIMEOUT_SLOW_MS = 5000;
export const TEXT_TIMEOUT_ABORT_MS = 8000;

export interface SSEResult {
  fullText: string;
  requiresAuth: boolean;
  testComplete: boolean;
  resultId: string | null;
  answerConfirmed: boolean;
  nextQuestion: number | null;
  confirmedScore: number | null;
  answerRejected: boolean;
  chatId: string | null;
}

export interface DebugLogEntry {
  question: number;
  sentScore: number;
  serverConfirmed: boolean;
  serverQuestion: number | null;
  timestamp: number;
}
