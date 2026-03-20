import { streamText } from "ai";
import { google } from "@/lib/ai";
import { createServiceClient } from "@/lib/supabase-server";
import { getConfig } from "@/lib/config";
import { createRateLimit } from "@/lib/rate-limit";

const checkRateLimit = createRateLimit();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // 2. Parse body — useChat отправляет { messages: UIMessage[], session_id, program_slug }
  const body = await request.json();
  const { messages: clientMessages, session_id, program_slug } = body;

  if (!session_id || !UUID_RE.test(session_id)) {
    return Response.json({ error: "Невалидный session_id" }, { status: 400 });
  }
  if (!program_slug) {
    return Response.json({ error: "Не указан program_slug" }, { status: 400 });
  }
  if (!Array.isArray(clientMessages) || clientMessages.length === 0) {
    return Response.json(
      { error: "Пустой массив сообщений" },
      { status: 400 }
    );
  }

  // 3. Convert UIMessage → simple format для валидации
  const messages = clientMessages.map(
    (msg: {
      role: string;
      parts?: Array<{ type: string; text: string }>;
      content?: string;
    }) => ({
      role: msg.role as "user" | "assistant",
      content:
        msg.parts
          ?.filter((p) => p.type === "text")
          ?.map((p) => p.text)
          ?.join("") ||
        msg.content ||
        "",
    })
  );

  // Validate messages
  for (const msg of messages) {
    if (msg.role !== "user" && msg.role !== "assistant") {
      return Response.json(
        { error: "Невалидная роль сообщения" },
        { status: 400 }
      );
    }
    if (typeof msg.content !== "string" || msg.content.length > 5000) {
      return Response.json(
        { error: "Сообщение слишком длинное (макс 5000 символов)" },
        { status: 400 }
      );
    }
  }

  // 4. Message limit (проверка ДО streamText)
  const userMessageCount = messages.filter(
    (m: { role: string }) => m.role === "user"
  ).length;
  const maxMessages = await getConfig<number>(
    "anonymous_chat_max_messages",
    10
  );
  if (userMessageCount > maxMessages) {
    return Response.json(
      { requiresAuth: true, reason: "message_limit" },
      { status: 429 }
    );
  }

  // 5. Token limit (проверка ДО streamText)
  const estimatedTokens =
    messages.map((m: { content: string }) => m.content).join("").length * 1.3;
  const tokenLimit = await getConfig<number>(
    "anonymous_chat_token_limit",
    100000
  );
  if (estimatedTokens > tokenLimit) {
    return Response.json(
      { requiresAuth: true, reason: "token_limit" },
      { status: 429 }
    );
  }

  // 6. Load program
  const supabase = createServiceClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, system_prompt, anonymous_system_prompt")
    .eq("slug", program_slug)
    .single();

  if (!program) {
    return Response.json({ error: "Программа не найдена" }, { status: 404 });
  }

  // 7. System prompt
  const systemPrompt =
    program.anonymous_system_prompt ||
    program.system_prompt +
      "\n\nЭто ознакомительный чат. Отвечай тепло, давай мини-инсайты, но не углубляйся слишком сильно.";

  // 8. Prepare messages for AI SDK
  // Фильтруем leading assistant messages (Gemini требует начинать с user)
  const firstUserIdx = messages.findIndex(
    (m: { role: string }) => m.role === "user"
  );
  const filteredMessages =
    firstUserIdx >= 0 ? messages.slice(firstUserIdx) : messages;

  // 9. Stream
  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt,
    messages: filteredMessages,
  });

  return result.toUIMessageStreamResponse();
}
