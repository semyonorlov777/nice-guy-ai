import { createClient } from "@/lib/supabase-server";
import { ChatWindow } from "@/components/ChatWindow";
import { toUIMessages } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function ExistingExerciseSessionPage({
  params,
}: {
  params: Promise<{ slug: string; number: string; chatId: string }>;
}) {
  const { slug, number, chatId } = await params;
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

  // Загружаем упражнение
  const { data: exercise } = await supabase
    .from("exercises")
    .select("id, number, title, description, config, welcome_message")
    .eq("program_id", program.id)
    .eq("number", parseInt(number))
    .single();
  if (!exercise) redirect(`/program/${slug}/exercises`);

  // Загружаем чат (RLS проверяет ownership)
  const { data: chat } = await supabase
    .from("chats")
    .select("id, exercise_id, chat_type")
    .eq("id", chatId)
    .eq("user_id", user.id)
    .single();

  if (!chat) redirect(`/program/${slug}/exercise/${number}`);

  const config = (exercise.config || {}) as {
    welcome_message?: string;
    quick_replies?: string[];
  };

  // User initial
  const { data: userData } = await supabase
    .from("profiles")
    .select("name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const userInitial =
    userData?.name?.[0]?.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "?";

  const avatarUrl = userData?.avatar_url || null;

  // Total exercises count
  const { count } = await supabase
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

  // Прошлые сессии для этого упражнения (кроме текущей)
  const { data: allSessions } = await supabase
    .from("chats")
    .select("id, title, last_message_at")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .eq("exercise_id", exercise.id)
    .in("status", ["active", "completed"])
    .neq("id", chatId)
    .order("last_message_at", { ascending: false });

  // Превью для прошлых сессий
  const sessionIds = (allSessions || []).map((s) => s.id);
  const previews = new Map<string, string>();
  if (sessionIds.length > 0) {
    const { data: lastMsgs } = await supabase
      .from("messages")
      .select("chat_id, content")
      .in("chat_id", sessionIds)
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

  const previousSessions = (allSessions || []).map((s) => ({
    id: s.id,
    title: s.title || "Сессия",
    preview: previews.get(s.id) || "",
    lastMessageAt: s.last_message_at,
  }));

  return (
    <ChatWindow
      key={chatId}
      initialMessages={toUIMessages(initialMessages)}
      chatId={chat.id}
      programId={program.id}
      exerciseId={exercise.id}
      userInitial={userInitial}
      avatarUrl={avatarUrl}
      welcomeMessage={exercise.welcome_message || config.welcome_message}
    >
      <div className="exercise-intro">
        <div className="exercise-intro-label">
          Упражнение {exercise.number} из {count || 0}
        </div>
        <div className="exercise-intro-title">{exercise.title}</div>
        <div className="exercise-intro-desc">{exercise.description}</div>
      </div>
      {previousSessions.length > 0 && (
        <PreviousSessionsBlock
          sessions={previousSessions}
          slug={slug}
          exerciseNumber={exercise.number}
        />
      )}
    </ChatWindow>
  );
}

// Inline server component для прошлых сессий (без client JS)
import Link from "next/link";
import { formatRelativeTime } from "@/lib/time";

function PreviousSessionsBlock({
  sessions,
  slug,
  exerciseNumber,
}: {
  sessions: { id: string; title: string; preview: string; lastMessageAt: string }[];
  slug: string;
  exerciseNumber: number;
}) {
  return (
    <div className="prev-chats-section">
      <div className="prev-chats-label">Прошлые сессии</div>
      {sessions.map((s) => (
        <Link
          key={s.id}
          href={`/program/${slug}/exercise/${exerciseNumber}/${s.id}`}
          className="prev-chat-item"
        >
          <div className="prev-chat-icon">{"💬"}</div>
          <div className="prev-chat-info">
            <div className="prev-chat-title">{s.title}</div>
            <div className="prev-chat-meta">
              <span className="prev-chat-preview">{s.preview}</span>
              <span className="prev-chat-time">
                {formatRelativeTime(s.lastMessageAt)}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
