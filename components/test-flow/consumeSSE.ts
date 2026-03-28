import type { SSEResult } from "./types";

/**
 * Parses an SSE response stream from /api/test.
 * Pure async function — no React hooks.
 */
export async function consumeSSE(response: Response): Promise<SSEResult> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Нет потока ответа");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let requiresAuth = false;
  let testComplete = false;
  let gotResultId: string | null = null;
  let answerConfirmed = false;
  let nextQuestion: number | null = null;
  let confirmedScore: number | null = null;
  let answerRejected = false;
  let gotChatId: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith("data: ")) continue;

      try {
        const data = JSON.parse(trimmedLine.slice(6));

        if (data.type === "delta") {
          fullText += data.content;
        } else if (data.type === "requires_auth") {
          requiresAuth = true;
        } else if (data.type === "test_complete") {
          testComplete = true;
          gotResultId = data.result_id;
        } else if (data.type === "answer_confirmed") {
          answerConfirmed = true;
          nextQuestion = data.next_question;
          confirmedScore = data.score;
        } else if (data.type === "calculating") {
          testComplete = true;
        } else if (data.type === "answer_rejected") {
          answerRejected = true;
        } else if (data.type === "chat_id") {
          gotChatId = data.chat_id;
        } else if (data.type === "error") {
          console.error("[TestCardFlow] SSE error:", data.message);
        }
      } catch {
        // skip malformed JSON
      }
    }
  }

  return {
    fullText,
    requiresAuth,
    testComplete,
    resultId: gotResultId,
    answerConfirmed,
    nextQuestion,
    confirmedScore,
    answerRejected,
    chatId: gotChatId,
  };
}
