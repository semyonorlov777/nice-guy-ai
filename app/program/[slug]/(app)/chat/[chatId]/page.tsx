import { createClient } from "@/lib/supabase-server";
import { ChatWindow } from "@/components/ChatWindow";
import { toUIMessages } from "@/lib/utils";
import { redirect } from "next/navigation";

interface ProgramConfig {
  welcome_message?: string;
  quick_replies?: string[];
}

export default async function ExistingChatPage({
  params,
}: {
  params: Promise<{ slug: string; chatId: string }>;
}) {
  const { slug, chatId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: program } = await supabase
    .from("programs")
    .select("id, title, config, free_chat_welcome")
    .eq("slug", slug)
    .single();
  if (!program) redirect("/");

  // Загружаем чат (RLS проверяет ownership)
  const { data: chat } = await supabase
    .from("chats")
    .select("id, exercise_id, chat_type, status")
    .eq("id", chatId)
    .eq("user_id", user.id)
    .single();

  if (!chat) redirect(`/program/${slug}/chat`);

  const config = (program.config || {}) as ProgramConfig;

  // User initial
  const { data: userData } = await supabase
    .from("profiles")
    .select("name, avatar_url, balance_tokens")
    .eq("id", user.id)
    .maybeSingle();

  const userInitial =
    userData?.name?.[0]?.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "?";

  const avatarUrl = userData?.avatar_url || null;
  const balanceTokens = userData?.balance_tokens ?? 0;
  const coverUrl = "https://cdn.litres.ru/pub/c/cover_415/6882766.webp";

  // Количество упражнений
  const { count: exerciseCount } = await supabase
    .from("exercises")
    .select("id", { count: "exact", head: true })
    .eq("program_id", program.id);

  // Сообщения чата
  const { data: messages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("chat_id", chat.id)
    .order("created_at", { ascending: true });

  const initialMessages = (messages || []).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Если это exercise-чат, подгружаем welcome
  let welcomeMessage = program.free_chat_welcome || config.welcome_message;
  if (chat.exercise_id) {
    const { data: exercise } = await supabase
      .from("exercises")
      .select("welcome_message, config")
      .eq("id", chat.exercise_id)
      .single();
    if (exercise) {
      const exConfig = (exercise.config || {}) as ProgramConfig;
      welcomeMessage = exercise.welcome_message || exConfig.welcome_message;
    }
  }

  return (
    <ChatWindow
      key={chatId}
      initialMessages={toUIMessages(initialMessages)}
      chatId={chat.id}
      programId={program.id}
      exerciseId={chat.exercise_id || undefined}
      chatType={chat.chat_type === "test" ? "free" : (chat.chat_type as "free" | "exercise")}
      userInitial={userInitial}
      avatarUrl={avatarUrl}
      welcomeMessage={welcomeMessage}
      programTitle={program.title}
      coverUrl={coverUrl}
      balance={balanceTokens}
    >
      <div className="welcome-card">
        <div className="welcome-book">
          <img src={coverUrl} alt="" />
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
