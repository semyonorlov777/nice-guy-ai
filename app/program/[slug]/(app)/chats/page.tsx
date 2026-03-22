import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { ChatListPage } from "@/components/chat/ChatListPage";
import { getChatPreviews } from "@/lib/queries/chat-previews";
import { getExerciseNumberMap } from "@/lib/queries/exercise-map";

export default async function ChatsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: program } = await supabase
    .from("programs")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!program) redirect("/");

  const { data: chatsData } = await supabase
    .from("chats")
    .select("id, title, chat_type, exercise_id, last_message_at")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .in("status", ["active", "completed"])
    .order("last_message_at", { ascending: false })
    .limit(50);

  const chatIds = (chatsData || []).map((c) => c.id);
  const previews = await getChatPreviews(supabase, chatIds);

  const exerciseIds = [
    ...new Set(
      (chatsData || [])
        .filter((c) => c.exercise_id)
        .map((c) => c.exercise_id as string)
    ),
  ];
  const exerciseMap = await getExerciseNumberMap(supabase, exerciseIds);

  const chatList = (chatsData || []).map((c) => ({
    id: c.id,
    title: c.title || "Новый чат",
    chatType: c.chat_type,
    exerciseNumber: c.exercise_id
      ? exerciseMap.get(c.exercise_id) || null
      : null,
    preview: previews.get(c.id) || "",
    lastMessageAt: c.last_message_at,
  }));

  return (
    <ChatListPage
      slug={slug}
      programId={program.id}
      initialChats={chatList}
    />
  );
}
