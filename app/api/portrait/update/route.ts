import { createServiceClient } from "@/lib/supabase-server";
import { analyzeForPortrait } from "@/lib/gemini-portrait";
import { PORTRAIT_ANALYST_PROMPT } from "@/lib/prompts/portrait-analyst";

export async function POST(request: Request) {
  try {
    const { chat_id, trigger } = await request.json();

    if (!chat_id) {
      return Response.json({ error: "chat_id обязателен" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 1. Load chat
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("id, user_id, program_id, exercise_id")
      .eq("id", chat_id)
      .single();

    if (chatError || !chat) {
      return Response.json({ error: "Чат не найден" }, { status: 404 });
    }

    // 2. Load messages
    const { data: messages, error: msgError } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("chat_id", chat_id)
      .order("created_at", { ascending: true });

    if (msgError || !messages || messages.length === 0) {
      return Response.json({ error: "Нет сообщений для анализа" }, { status: 400 });
    }

    // 3. Load current portrait
    const { data: portrait } = await supabase
      .from("portraits")
      .select("content")
      .eq("user_id", chat.user_id)
      .eq("program_id", chat.program_id)
      .maybeSingle();

    const currentPortrait = portrait?.content || {};

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
    const responseText = await analyzeForPortrait(PORTRAIT_ANALYST_PROMPT, userMessage);

    // 8. Parse JSON
    let updatedPortrait;
    try {
      const cleanJson = responseText
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      updatedPortrait = JSON.parse(cleanJson);
    } catch {
      console.error("[portrait/update] JSON parse error:", responseText.substring(0, 500));
      return Response.json(
        { error: "AI вернул невалидный JSON", raw: responseText.substring(0, 200) },
        { status: 500 }
      );
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
      console.error("[portrait/update] Upsert error:", upsertError);
      return Response.json({ error: "Не удалось сохранить портрет" }, { status: 500 });
    }

    // 10. Success
    return Response.json({
      success: true,
      trigger,
      portrait: updatedPortrait,
    });
  } catch (error) {
    console.error("[portrait/update] Error:", error);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
