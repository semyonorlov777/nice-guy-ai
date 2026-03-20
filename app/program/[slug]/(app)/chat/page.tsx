import { createClient } from "@/lib/supabase-server";
import { ChatWindow } from "@/components/ChatWindow";
import { toUIMessages } from "@/lib/utils";
import { MobileChatList } from "@/components/MobileChatList";
import { getUserProfileForChat } from "@/lib/queries/user-profile";
import { getChatPreviews } from "@/lib/queries/chat-previews";
import { getExerciseNumberMap } from "@/lib/queries/exercise-map";
import { getChatMessages } from "@/lib/queries/messages";

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
  const { userInitial, avatarUrl, balanceTokens } = await getUserProfileForChat(supabase, user);
  // TODO: cover_url хранится в programs.landing_data.book.cover_url, пока хардкод
  const coverUrl = "https://cdn.litres.ru/pub/c/cover_415/6882766.webp";

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
  const previews = await getChatPreviews(supabase, chatIds);

  // Номера упражнений
  const exerciseIds = [
    ...new Set(
      (recentChats || [])
        .filter((c) => c.exercise_id)
        .map((c) => c.exercise_id as string)
    ),
  ];
  const exerciseMap = await getExerciseNumberMap(supabase, exerciseIds);

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

  // Найти последний active free-чат пользователя (мог быть создан через migrate)
  let loadedMessages: { role: string; content: string }[] = [];
  let activeChatId: string | null = null;

  const { data: activeChat } = await supabase
    .from("chats")
    .select("id")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .is("exercise_id", null)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeChat) {
    // Загрузить сообщения существующего чата
    const msgs = await getChatMessages(supabase, activeChat.id);

    if (msgs.length > 0) {
      activeChatId = activeChat.id;
      loadedMessages = msgs;
    }
  }

  return (
    <ChatWindow
      key={activeChatId || "new-chat"}
      initialMessages={toUIMessages(loadedMessages)}
      chatId={activeChatId}
      programId={program.id}
      userInitial={userInitial}
      avatarUrl={avatarUrl}
      welcomeMessage={program.free_chat_welcome || config.welcome_message}
      quickReplies={config.quick_replies}
      programTitle={program.title}
      coverUrl={coverUrl}
      balance={balanceTokens}
    >
      <div className="welcome-card">
        <div className="welcome-book">
          <img src="https://cdn.litres.ru/pub/c/cover_415/6882766.webp" alt="" />
        </div>
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
