// Протокол браузер ⇄ сервер голосовой сессии (WebSocket /api/practice/ws).
// Двоичные кадры: от браузера — PCM16 моно 16 кГц, к браузеру — PCM16 моно 24 кГц.

export type ClientMessage =
  | { t: "auth"; ticket: string }
  | { t: "end" }
  | { t: "pause" }
  | { t: "mic"; muted: boolean };

export type EndReason =
  | "student"
  | "time_limit"
  | "relay_lost_client"
  | "engine_error"
  | "integrity";

export type ServerMessage =
  | { t: "ready"; sessionId: string; secondsLeft: number; resumed: boolean }
  | { t: "state"; speaking: "client" | "student" | "idle"; secondsLeft: number; warn?: boolean }
  | { t: "interrupted" }
  /**
   * Звук студента дошёл до сервера (раз в секунду, пока он идёт): всего байт за это
   * соединение и сколько из них — речь, а не тишина. По нему браузер видит, что его слышно.
   */
  | { t: "heard"; bytes: number; speechMs: number }
  | { t: "rotate" }
  | { t: "client_silent" }
  /** «Трудный момент»: ответ засчитан, можно продолжать разговор или идти к разбору. */
  | { t: "attempt_done" }
  | { t: "ended"; reason: EndReason }
  | { t: "error"; code: ErrorCode; message: string };

export type ErrorCode =
  | "auth_timeout"
  | "ticket_invalid"
  | "superseded"
  | "engine_unavailable"
  | "session_not_found";

export const PCM_IN_RATE = 16000;
export const PCM_OUT_RATE = 24000;
