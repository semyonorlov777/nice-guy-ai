import { createClient } from "@/lib/supabase-server";
import { ChatWindow } from "@/components/ChatWindow";
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
    .select("id, number, title, description, chapter, config")
    .eq("program_id", program.id)
    .eq("number", parseInt(number))
    .single();
  if (!exercise) redirect(`/program/${slug}/exercises`);

  const config = (exercise.config || {}) as { welcome_message?: string; quick_replies?: string[] };

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

  // Find existing chat for this exercise
  const { data: chat } = await supabase
    .from("chats")
    .select("id")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .eq("exercise_id", exercise.id)
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
      exerciseId={exercise.id}
      userInitial={userInitial}
      welcomeMessage={config.welcome_message}
      quickReplies={config.quick_replies}
    >
      <div className="exercise-intro">
        <div className="exercise-intro-label">
          Упражнение {exercise.number} из {count || 46}
        </div>
        <div className="exercise-intro-title">{exercise.title}</div>
        <div className="exercise-intro-desc">{exercise.description}</div>
      </div>
    </ChatWindow>
  );
}
