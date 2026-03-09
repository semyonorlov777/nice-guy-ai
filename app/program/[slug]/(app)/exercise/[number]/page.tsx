import { createClient } from "@/lib/supabase-server";
import { ChatWindow } from "@/components/ChatWindow";
import { toUIMessages } from "@/lib/utils";
import { PreviousSessions } from "@/components/PreviousSessions";
import { redirect } from "next/navigation";

export default async function ExercisePage({
  params,
}: {
  params: Promise<{ slug: string; number: string }>;
}) {
  const { slug, number } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  // Load program
  const { data: program } = await supabase
    .from("programs")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!program) redirect("/");

  // Load exercise
  const { data: exercise } = await supabase
    .from("exercises")
    .select("id, number, title, description, chapter, config, welcome_message")
    .eq("program_id", program.id)
    .eq("number", parseInt(number))
    .single();
  if (!exercise) redirect(`/program/${slug}/exercises`);

  const config = (exercise.config || {}) as {
    welcome_message?: string;
    quick_replies?: string[];
  };

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

  // Total exercises count
  const { count } = await supabase
    .from("exercises")
    .select("id", { count: "exact", head: true })
    .eq("program_id", program.id);

  // Все сессии для этого упражнения (сортировка по последнему сообщению)
  const { data: allSessions } = await supabase
    .from("chats")
    .select("id, title, last_message_at")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .eq("exercise_id", exercise.id)
    .in("status", ["active", "completed"])
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
      key="new-exercise"
      initialMessages={toUIMessages([])}
      chatId={null}
      programId={program.id}
      exerciseId={exercise.id}
      userInitial={userInitial}
      welcomeMessage={exercise.welcome_message || config.welcome_message}
      quickReplies={config.quick_replies}
    >
      <div className="exercise-intro">
        <div className="exercise-intro-label">
          Упражнение {exercise.number} из {count || 0}
        </div>
        <div className="exercise-intro-title">{exercise.title}</div>
        <div className="exercise-intro-desc">{exercise.description}</div>
      </div>
      {previousSessions.length > 0 && (
        <PreviousSessions
          sessions={previousSessions}
          slug={slug}
          exerciseNumber={exercise.number}
        />
      )}
    </ChatWindow>
  );
}
