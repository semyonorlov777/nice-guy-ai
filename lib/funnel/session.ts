import { SEED_QUESTIONS } from "./seed-questions";
import {
  SESSION_STORAGE_KEY,
  SESSION_TTL_MS,
  type FunnelSession,
} from "./types";

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createSession(): FunnelSession {
  return {
    sessionId: generateId(),
    startedAt: Date.now(),
    answers: [],
    currentQuestion: SEED_QUESTIONS[0],
    result: null,
    status: "in_progress",
  };
}

export function loadSession(): FunnelSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FunnelSession;
    if (!parsed.sessionId || typeof parsed.startedAt !== "number") return null;
    if (Date.now() - parsed.startedAt > SESSION_TTL_MS) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: FunnelSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function getNextSeedQuestion(answeredCount: number) {
  return SEED_QUESTIONS[answeredCount] ?? null;
}
