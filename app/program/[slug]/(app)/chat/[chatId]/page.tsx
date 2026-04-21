import { createClient } from "@/lib/supabase-server";
import { ChatWindow } from "@/components/ChatWindow";
import { toUIMessages } from "@/lib/utils";
import { redirect } from "next/navigation";
import { getUserProfileForChat } from "@/lib/queries/user-profile";
import { getChatMessages } from "@/lib/queries/messages";

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
    .select("id, title, config, free_chat_welcome, author_chat_welcome, landing_data")
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
  const landingData = program.landing_data as { book?: { cover_url?: string } } | null;
  const coverUrl = landingData?.book?.cover_url || "";

  // User initial
  const { userInitial, avatarUrl, balanceTokens } = await getUserProfileForChat(supabase, user);

  // Количество упражнений
  const { count: exerciseCount } = await supabase
    .from("exercises")
    .select("id", { count: "exact", head: true })
    .eq("program_id", program.id);

  // Сообщения чата
  const initialMessages = await getChatMessages(supabase, chat.id);

  // Резолв welcome-сообщения по типу чата:
  //   exercise → exercises.welcome_message
  //   author   → programs.author_chat_welcome
  //   tool-mode (notes_*, ng_*, ta_*, ll_*, hypno_* и т.п.) →
  //              program_modes.welcome_message || welcome_ai_message
  //   free / test / unknown → programs.free_chat_welcome
  // Tool-mode lookup — через JOIN program_modes ↔ mode_templates по key.
  let welcomeMessage: string | undefined;
  const chatType = chat.chat_type;

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
  } else if (chatType === "author") {
    welcomeMessage = program.author_chat_welcome || program.free_chat_welcome || config.welcome_message;
  } else if (chatType && chatType !== "free" && chatType !== "test") {
    // Tool-mode — ищем mode-specific welcome через mode_templates.key
    const { data: mode } = await supabase
      .from("program_modes")
      .select("welcome_message, welcome_ai_message, mode_templates!inner(key)")
      .eq("program_id", program.id)
      .eq("mode_templates.key", chatType)
      .maybeSingle();
    welcomeMessage =
      mode?.welcome_message ||
      mode?.welcome_ai_message ||
      program.free_chat_welcome ||
      config.welcome_message;
  } else {
    welcomeMessage = program.free_chat_welcome || config.welcome_message;
  }

  return (
    <ChatWindow
      key={chatId}
      initialMessages={toUIMessages(initialMessages)}
      chatId={chat.id}
      programId={program.id}
      exerciseId={chat.exercise_id || undefined}
      chatType={chat.chat_type === "test" ? "free" : (chat.chat_type ?? "free")}
      userInitial={userInitial}
      avatarUrl={avatarUrl}
      welcomeMessage={welcomeMessage}
      programTitle={program.title}
      coverUrl={coverUrl}
      balance={balanceTokens}
      slug={slug}
      currentModeKey={
        chat.chat_type === "author"
          ? "author_chat"
          : chat.exercise_id
            ? "exercises"
            : chat.chat_type && chat.chat_type !== "free" && chat.chat_type !== "test"
              ? chat.chat_type
              : "free_chat"
      }
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
