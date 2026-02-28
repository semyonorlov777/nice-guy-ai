import { createServiceClient } from "@/lib/supabase-server";
import { analyzeForPortrait } from "@/lib/gemini-portrait";
import { PORTRAIT_ANALYST_PROMPT } from "@/lib/prompts/portrait-analyst";

/**
 * Core logic — called both from HTTP route and directly from chat/route.ts
 */
export async function updatePortrait(chatId: string, trigger: string): Promise<{ success: boolean; error?: string }> {
  console.log("[PORTRAIT] updatePortrait called, chat:", chatId, "trigger:", trigger);

  const supabase = createServiceClient();

  // 1. Load chat
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id, user_id, program_id, exercise_id")
    .eq("id", chatId)
    .single();

  if (chatError || !chat) {
    console.error("[PORTRAIT] Chat not found:", chatId, chatError);
    return { success: false, error: "Чат не найден" };
  }

  // 2. Load messages
  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (msgError || !messages || messages.length === 0) {
    console.error("[PORTRAIT] No messages for chat:", chatId, msgError);
    return { success: false, error: "Нет сообщений для анализа" };
  }

  console.log("[PORTRAIT] Loaded", messages.length, "messages");

  // 3. Load current portrait
  const { data: portrait } = await supabase
    .from("portraits")
    .select("content")
    .eq("user_id", chat.user_id)
    .eq("program_id", chat.program_id)
    .maybeSingle();

  const currentPortrait = portrait?.content || {};
  console.log("[PORTRAIT] Current portrait exists:", !!portrait);

  // 4. Determine source label
  let sourceLabel = "свободный чат";
  if (chat.exercise_id) {
    const { data: exercise } = await supabase
      .from("exercises")
      .select("number, title")
      .eq("id", chat.exercise_id)
      .single();

    if (exercise) {
      sourceLabel = `Упражнение ${exercise.number}: ${exercise.title}`;
    }
  }

  // 5. Format transcript
  const chatTranscript = messages
    .map((m) => `[${m.role === "user" ? "ПОЛЬЗОВАТЕЛЬ" : "ФАСИЛИТАТОР"}]: ${m.content}`)
    .join("\n\n");

  // 6. Build request for Gemini Pro
  const userMessage = `
ТЕКУЩИЙ ПОРТРЕТ:
${JSON.stringify(currentPortrait, null, 2)}

ИСТОЧНИК: ${sourceLabel}
ТРИГГЕР: ${trigger}
ДАТА: ${new Date().toISOString()}

ПЕРЕПИСКА:
${chatTranscript}

Проанализируй переписку и верни обновлённый портрет в формате JSON.
`;

  // 7. Call Gemini Pro
  console.log("[PORTRAIT] Calling Gemini Pro...");
  let responseText: string;
  try {
    responseText = await analyzeForPortrait(PORTRAIT_ANALYST_PROMPT, userMessage);
    console.log("[PORTRAIT] Gemini Pro response received, length:", responseText.length);
  } catch (err) {
    console.error("[PORTRAIT] Gemini Pro error:", err);
    return { success: false, error: "Gemini Pro API error" };
  }

  // 8. Parse JSON
  let updatedPortrait;
  try {
    const cleanJson = responseText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    updatedPortrait = JSON.parse(cleanJson);
  } catch {
    console.error("[PORTRAIT] JSON parse error:", responseText.substring(0, 500));
    return { success: false, error: "AI вернул невалидный JSON" };
  }

  // 9. Upsert to DB
  const { error: upsertError } = await supabase
    .from("portraits")
    .upsert(
      {
        user_id: chat.user_id,
        program_id: chat.program_id,
        content: updatedPortrait,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,program_id" }
    );

  if (upsertError) {
    console.error("[PORTRAIT] Upsert error:", upsertError);
    return { success: false, error: "Не удалось сохранить портрет" };
  }

  console.log("[PORTRAIT] Saved to DB successfully");
  return { success: true };
}

/**
 * HTTP handler — for manual/external calls
 */
export async function POST(request: Request) {
  try {
    const { chat_id, trigger } = await request.json();

    if (!chat_id) {
      return Response.json({ error: "chat_id обязателен" }, { status: 400 });
    }

    const result = await updatePortrait(chat_id, trigger || "manual");

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[PORTRAIT] HTTP handler error:", error);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
