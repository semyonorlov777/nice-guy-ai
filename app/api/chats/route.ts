import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Не авторизован" }, { status: 401 });
  }

  const url = new URL(request.url);
  const programId = url.searchParams.get("programId");
  const exerciseId = url.searchParams.get("exerciseId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 50);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  if (!programId) {
    return Response.json({ error: "programId обязателен" }, { status: 400 });
  }

  let query = supabase
    .from("chats")
    .select("id, title, chat_type, exercise_id, status, last_message_at")
    .eq("user_id", user.id)
    .eq("program_id", programId)
    .in("status", ["active", "completed"])
    .order("last_message_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (exerciseId) {
    query = query.eq("exercise_id", exerciseId);
  }

  const { data: chats, error } = await query;

  if (error) {
    console.error("[chats] List error:", error);
    return Response.json({ error: "Ошибка загрузки чатов" }, { status: 500 });
  }

  if (!chats || chats.length === 0) {
    return Response.json({ chats: [] });
  }

  // Превью: последнее assistant-сообщение для каждого чата
  const chatIds = chats.map((c) => c.id);
  const previews = new Map<string, string>();

  const { data: lastMessages } = await supabase
    .from("messages")
    .select("chat_id, content")
    .in("chat_id", chatIds)
    .eq("role", "assistant")
    .order("created_at", { ascending: false });

  if (lastMessages) {
    for (const msg of lastMessages) {
      if (!previews.has(msg.chat_id)) {
        previews.set(msg.chat_id, msg.content.slice(0, 80));
      }
    }
  }

  // Номера упражнений для exercise-чатов
  const exerciseIds = [
    ...new Set(
      chats.filter((c) => c.exercise_id).map((c) => c.exercise_id as string)
    ),
  ];
  const exerciseMap = new Map<string, number>();

  if (exerciseIds.length > 0) {
    const { data: exercises } = await supabase
      .from("exercises")
      .select("id, number")
      .in("id", exerciseIds);

    if (exercises) {
      for (const ex of exercises) {
        exerciseMap.set(ex.id, ex.number);
      }
    }
  }

  const result = chats.map((chat) => ({
    id: chat.id,
    title: chat.title || "Новый чат",
    chatType: chat.chat_type,
    exerciseId: chat.exercise_id,
    exerciseNumber: chat.exercise_id
      ? exerciseMap.get(chat.exercise_id) || null
      : null,
    status: chat.status,
    preview: previews.get(chat.id) || "",
    lastMessageAt: chat.last_message_at,
  }));

  return Response.json({ chats: result });
}
