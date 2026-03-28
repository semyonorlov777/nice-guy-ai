import * as Sentry from "@sentry/nextjs";
import type { streamText } from "ai";

export function createSSEResponse(
  handler: (send: (data: object) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        await handler(send);
      } catch (err) {
        Sentry.captureException(err, {
          tags: { route: "api/test", phase: "sse-handler" },
        });
        console.error("[test] SSE handler error:", err);
        send({ type: "error", message: "Ошибка генерации ответа" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function streamToSSE(
  result: ReturnType<typeof streamText>,
  send: (data: object) => void,
): Promise<string> {
  let fullText = "";
  for await (const chunk of result.textStream) {
    fullText += chunk;
    send({ type: "delta", content: chunk });
  }
  return fullText;
}
