import { createClient } from "@/lib/supabase-server";
import { ChatWindow } from "@/components/ChatWindow";
import { toUIMessages } from "@/lib/utils";
import { PreviousSessions } from "@/components/PreviousSessions";
import { redirect } from "next/navigation";
import { getUserProfileForChat } from "@/lib/queries/user-profile";
import { getChatPreviews } from "@/lib/queries/chat-previews";
import { requireProgramFeature } from "@/lib/queries/program";

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

  // Load program + check exercises feature
  const program = await requireProgramFeature(supabase, slug, "exercises");

  // Параллельно: exercise + userProfile + exerciseCount.
  // allSessions нуждается в exercise.id — но мы знаем number, поэтому можем
  // запросить в параллель: даже если exercise не найдётся, allSessions
  // вернёт пусто (фильтр по неизвестному exercise_id). Дешевле, чем
  // дополнительный roundtrip.
  const [exerciseRes, userProfile, exerciseCountRes] = await Promise.all([
    supabase
      .from("exercises")
      .select("id, number, title, description, chapter, config, welcome_message")
      .eq("program_id", program.id)
      .eq("number", parseInt(number))
      .single(),
    getUserProfileForChat(supabase, user),
    supabase
      .from("exercises")
      .select("id", { count: "exact", head: true })
      .eq("program_id", program.id),
  ]);

  const exercise = exerciseRes.data;
  if (!exercise) redirect(`/program/${slug}/exercises`);

  const config = (exercise.config || {}) as {
    welcome_message?: string;
    quick_replies?: string[];
  };

  const { userInitial, avatarUrl } = userProfile;
  const count = exerciseCountRes.count;

  // Сессии для этого упражнения (требуется exercise.id).
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
  const previews = await getChatPreviews(supabase, sessionIds);

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
      avatarUrl={avatarUrl}
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
