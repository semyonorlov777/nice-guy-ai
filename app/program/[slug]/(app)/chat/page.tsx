import { createClient } from "@/lib/supabase-server";
import { ChatWindow } from "@/components/ChatWindow";

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

  // Find existing free chat
  const { data: chat } = await supabase
    .from("chats")
    .select("id")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .is("exercise_id", null)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  // Load messages if chat exists
  let initialMessages: { role: "user" | "assistant"; content: string }[] = [];
  if (chat) {
    const { data: messages } = await supabase
      .from("messages")
      .select("role, content")
      .eq("chat_id", chat.id)
      .order("created_at", { ascending: true });

    initialMessages = (messages || []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  }

  return (
    <ChatWindow
      initialMessages={initialMessages}
      chatId={chat?.id || null}
      programId={program.id}
      userInitial={userInitial}
      welcomeMessage={program.free_chat_welcome || config.welcome_message}
      quickReplies={config.quick_replies}
    >
      <div className="welcome-card">
        <div className="welcome-emoji">{"📖"}</div>
        <div className="welcome-title">{program.title}</div>
        <div className="welcome-sub">{exerciseCount || 0} упражнений</div>
        <div className="welcome-desc">
          AI-ассистент проведёт тебя через каждое упражнение и поможет
          разобраться в себе.
        </div>
      </div>
    </ChatWindow>
  );
}
