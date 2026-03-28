import { createClient } from "@/lib/supabase-server";
import { requireAuth, apiError } from "@/lib/api-helpers";
import { getChatPreviews } from "@/lib/queries/chat-previews";
import { getExerciseNumberMap } from "@/lib/queries/exercise-map";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { user, response } = await requireAuth(supabase);
  if (response) return response;

  const url = new URL(request.url);
  const programId = url.searchParams.get("programId");
  const exerciseId = url.searchParams.get("exerciseId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 50);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  if (!programId) {
    return apiError("programId обязателен", 400);
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
    return apiError("Ошибка загрузки чатов", 500);
  }

  if (!chats || chats.length === 0) {
    return Response.json({ chats: [] });
  }

  // Фильтрация пустых чатов (без user-сообщений) из списка
  const chatIds = chats.map((c) => c.id);
  const { data: userMsgRows } = await supabase
    .from("messages")
    .select("chat_id")
    .in("chat_id", chatIds)
    .eq("role", "user");
  const chatsWithUserMsgs = new Set(userMsgRows?.map((m) => m.chat_id));
  const filteredChats = chats.filter((c) => chatsWithUserMsgs.has(c.id));

  if (filteredChats.length === 0) {
    return Response.json({ chats: [] });
  }

  const filteredIds = filteredChats.map((c) => c.id);

  // Превью: последнее assistant-сообщение для каждого чата
  const previews = await getChatPreviews(supabase, filteredIds);

  // Номера упражнений для exercise-чатов
  const exerciseIds = [
    ...new Set(
      filteredChats.filter((c) => c.exercise_id).map((c) => c.exercise_id as string)
    ),
  ];
  const exerciseMap = await getExerciseNumberMap(supabase, exerciseIds);

  const result = filteredChats.map((chat) => ({
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
