import { createClient } from "@/lib/supabase-server";
import { ChatWindow } from "@/components/ChatWindow";
import { toUIMessages } from "@/lib/utils";
import { MobileChatList } from "@/components/MobileChatList";

interface ProgramConfig {
  welcome_message?: string;
  quick_replies?: string[];
}

export default async function ChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: program } = await supabase
    .from("programs")
    .select("id, title, description, config, free_chat_welcome")
    .eq("slug", slug)
    .single();

  if (!user || !program) return null;

  const config = (program.config || {}) as ProgramConfig;

  // User initial for avatar
  const { data: userData } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  const userInitial =
    userData?.name?.[0]?.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "?";

  // Count exercises for this program
  const { count: exerciseCount } = await supabase
    .from("exercises")
    .select("id", { count: "exact", head: true })
    .eq("program_id", program.id);

  // Прошлые чаты для мобильного списка
  const { data: recentChats } = await supabase
    .from("chats")
    .select("id, title, chat_type, exercise_id, last_message_at")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .in("status", ["active", "completed"])
    .order("last_message_at", { ascending: false })
    .limit(10);

  // Превью для прошлых чатов
  const chatIds = (recentChats || []).map((c) => c.id);
  const previews = new Map<string, string>();
  if (chatIds.length > 0) {
    const { data: lastMsgs } = await supabase
      .from("messages")
      .select("chat_id, content")
      .in("chat_id", chatIds)
      .eq("role", "assistant")
      .order("created_at", { ascending: false });
    if (lastMsgs) {
      for (const msg of lastMsgs) {
        if (!previews.has(msg.chat_id)) {
          previews.set(msg.chat_id, msg.content.slice(0, 80));
        }
      }
    }
  }

  // Номера упражнений
  const exerciseIds = [
    ...new Set(
      (recentChats || [])
        .filter((c) => c.exercise_id)
        .map((c) => c.exercise_id as string)
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

  const pastChats = (recentChats || []).map((c) => ({
    id: c.id,
    title: c.title || "Новый чат",
    chatType: c.chat_type,
    exerciseNumber: c.exercise_id
      ? exerciseMap.get(c.exercise_id) || null
      : null,
    preview: previews.get(c.id) || "",
    lastMessageAt: c.last_message_at,
  }));

  // Новый чат: chatId=null, пустые сообщения
  return (
    <ChatWindow
      key="new-chat"
      initialMessages={toUIMessages([])}
      chatId={null}
      programId={program.id}
      userInitial={userInitial}
      welcomeMessage={program.free_chat_welcome || config.welcome_message}
      quickReplies={config.quick_replies}
    >
      <div className="welcome-card">
        <div className="welcome-emoji">{"📖"}</div>
        <div className="welcome-title">{program.title}</div>
        {(exerciseCount || 0) > 0 && (
          <div className="welcome-sub">{exerciseCount} упражнений</div>
        )}
        <div className="welcome-desc">
          {(exerciseCount || 0) > 0
            ? "AI-ассистент проведёт тебя через каждое упражнение и поможет разобраться в себе."
            : "Свободный чат с AI-ассистентом по теме книги. Задавай вопросы и обсуждай идеи."}
        </div>
      </div>
      {pastChats.length > 0 && (
        <MobileChatList chats={pastChats} slug={slug} />
      )}
    </ChatWindow>
  );
}
