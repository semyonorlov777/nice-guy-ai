import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { ChatWindow } from "@/components/ChatWindow";
import { toUIMessages } from "@/lib/utils";
import { getUserProfileForChat } from "@/lib/queries/user-profile";
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
    .select("id, title, description, config, free_chat_welcome, landing_data")
    .eq("slug", slug)
    .single();

  if (!user || !program) return null;

  const config = (program.config || {}) as ProgramConfig;
  const landingData = program.landing_data as { book?: { cover_url?: string } } | null;
  const coverUrl = landingData?.book?.cover_url || "";

  const { userInitial, avatarUrl, balanceTokens } = await getUserProfileForChat(supabase, user);

  const { count: exerciseCount } = await supabase
    .from("exercises")
    .select("id", { count: "exact", head: true })
    .eq("program_id", program.id);

  // Find active free chat for ChatWindow (desktop welcome state)
  let loadedMessages: { role: string; content: string }[] = [];
  let activeChatId: string | null = null;

  const { data: activeChat } = await supabase
    .from("chats")
    .select("id, chat_type")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .is("exercise_id", null)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeChat && (activeChat.chat_type === "free" || !activeChat.chat_type)) {
    const msgs = await getChatMessages(supabase, activeChat.id);
    const hasUserMessages = msgs.some((m) => m.role === "user");

    if (!hasUserMessages) {
      activeChatId = activeChat.id;
      loadedMessages = msgs;
    }
  }

  // Desktop: show ChatWindow in welcome state
  // Mobile users should use /chats for list, /chat/new for new chats
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
      slug={slug}
      currentModeKey="free_chat"
    >
      <div className="welcome-card">
        <div className="welcome-book">
          {coverUrl && <img src={coverUrl} alt="" />}
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
    </ChatWindow>
  );
}
