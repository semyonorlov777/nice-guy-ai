import { createServiceClient } from "@/lib/supabase-server";
import { streamChat } from "@/lib/gemini";
import { getConfig } from "@/lib/config";
import type { Content } from "@google/generative-ai";

// In-memory rate limit: 30 requests/minute per IP
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 30;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);

  if (!entry || entry.resetAt < now) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  // 1. Rate limit
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: "Слишком много запросов. Попробуйте позже." },
      { status: 429 }
    );
  }

  // 2. Parse & validate body
  let body: { session_id: string; messages: ChatMessage[]; program_slug: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Невалидный JSON" }, { status: 400 });
  }

  const { session_id, messages, program_slug } = body;

  if (!session_id || !UUID_RE.test(session_id)) {
    return Response.json({ error: "Невалидный session_id" }, { status: 400 });
  }
  if (!program_slug) {
    return Response.json({ error: "Не указан program_slug" }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Пустой массив сообщений" }, { status: 400 });
  }

  // Validate each message
  for (const msg of messages) {
    if (msg.role !== "user" && msg.role !== "assistant") {
      return Response.json({ error: "Невалидная роль сообщения" }, { status: 400 });
    }
    if (typeof msg.content !== "string" || msg.content.length > 5000) {
      return Response.json(
        { error: "Сообщение слишком длинное (макс 5000 символов)" },
        { status: 400 }
      );
    }
  }

  // 3. Message limit
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const maxMessages = await getConfig<number>("anonymous_chat_max_messages", 10);

  if (userMessageCount > maxMessages) {
    return Response.json(
      { requiresAuth: true, reason: "message_limit" },
      { status: 429 }
    );
  }

  // 4. Token limit (rough estimate)
  const estimatedTokens = messages.map((m) => m.content).join("").length * 1.3;
  const tokenLimit = await getConfig<number>("anonymous_chat_token_limit", 100000);

  if (estimatedTokens > tokenLimit) {
    return Response.json(
      { requiresAuth: true, reason: "token_limit" },
      { status: 429 }
    );
  }

  // 5. Load program
  const supabase = createServiceClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, system_prompt, anonymous_system_prompt")
    .eq("slug", program_slug)
    .single();

  if (!program) {
    return Response.json({ error: "Программа не найдена" }, { status: 404 });
  }

  // 6. Build system prompt
  const systemPrompt = program.anonymous_system_prompt ||
    (program.system_prompt + "\n\nЭто ознакомительный чат. Отвечай тепло, давай мини-инсайты, но не углубляйся слишком сильно.");

  // 7. Convert to Gemini format
  // Last message is the user's current message — separate it from history
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== "user") {
    return Response.json({ error: "Последнее сообщение должно быть от пользователя" }, { status: 400 });
  }

  const historyMessages = messages.slice(0, -1);
  const allHistory = historyMessages.map((msg) => ({
    role: (msg.role === "assistant" ? "model" : "user") as "model" | "user",
    parts: [{ text: msg.content }],
  }));

  // Filter out leading "model" messages (welcome messages) — Gemini requires history to start with "user"
  const firstUserIdx = allHistory.findIndex((m) => m.role === "user");
  const history: Content[] = firstUserIdx >= 0 ? allHistory.slice(firstUserIdx) : [];

  // 8. Stream response from Gemini
  let result;
  try {
    result = await streamChat(systemPrompt, history, lastMessage.content);
  } catch (error) {
    console.error("[anon-chat] Gemini API error:", error);
    return Response.json(
      { error: "Ошибка AI. Попробуйте позже." },
      { status: 502 }
    );
  }

  // 9. SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "delta", content: text })}\n\n`
              )
            );
          }
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done" })}\n\n`
          )
        );
      } catch (error) {
        console.error("[anon-chat] Streaming error:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: "Ошибка при генерации ответа" })}\n\n`
          )
        );
      }

      controller.close();
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
