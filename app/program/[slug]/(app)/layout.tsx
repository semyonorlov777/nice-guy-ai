import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { Sidebar } from "@/components/Sidebar";
import { MobileTabs } from "@/components/MobileTabs";
import { ChatListProvider } from "@/contexts/ChatListContext";
import { ModesProvider } from "@/contexts/ModesContext";
import { getChatPreviews } from "@/lib/queries/chat-previews";
import { getExerciseNumberMap } from "@/lib/queries/exercise-map";
import { getProgramModes } from "@/lib/queries/modes";
import type { ProgramFeatures } from "@/types/program";

export default async function ProgramLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthed = !!user;

  // Загрузка данных только для авторизованных
  let sidebarProps: {
    slug: string;
    programId: string;
    user: { name: string; username: string | null; avatarUrl: string | null } | null;
    features: ProgramFeatures | null;
    initialChats: { id: string; title: string; chatType: string; exerciseNumber: number | null; preview: string; lastMessageAt: string }[];
    exerciseCount: number;
  } | null = null;
  let mobileTabsProps: {
    slug: string;
    features: ProgramFeatures | null;
  } | null = null;
  let loadedModes: import("@/types/modes").ProgramModeWithTemplate[] = [];

  if (isAuthed) {
    const { data: program } = await supabase
      .from("programs")
      .select("id, slug, title, features")
      .eq("slug", slug)
      .single();

    if (!program) redirect("/");

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, telegram_username, avatar_url")
      .eq("id", user.id)
      .single();

    const userInfo = profile
      ? {
          name: profile.name || "",
          username: profile.telegram_username || null,
          avatarUrl: profile.avatar_url || null,
        }
      : null;

    // Количество упражнений для badge
    const { count: exerciseCount } = await supabase
      .from("exercises")
      .select("id", { count: "exact", head: true })
      .eq("program_id", program.id);

    // Серверная загрузка списка чатов для sidebar
    const { data: chatsData } = await supabase
      .from("chats")
      .select("id, title, chat_type, exercise_id, status, last_message_at")
      .eq("user_id", user.id)
      .eq("program_id", program.id)
      .in("status", ["active", "completed"])
      .order("last_message_at", { ascending: false })
      .limit(30);

    // Превью: последнее assistant-сообщение для каждого чата
    const chatIds = (chatsData || []).map((c) => c.id);
    const previews = await getChatPreviews(supabase, chatIds);

    // Номера упражнений для exercise-чатов
    const exerciseIds = [
      ...new Set(
        (chatsData || [])
          .filter((c) => c.exercise_id)
          .map((c) => c.exercise_id as string)
      ),
    ];
    const exerciseMap = await getExerciseNumberMap(supabase, exerciseIds);

    const initialChats = (chatsData || []).map((c) => ({
      id: c.id,
      title: c.title || "Новый чат",
      chatType: c.chat_type,
      exerciseNumber: c.exercise_id
        ? exerciseMap.get(c.exercise_id) || null
        : null,
      preview: previews.get(c.id) || "",
      lastMessageAt: c.last_message_at,
    }));

    sidebarProps = {
      slug,
      programId: program.id,
      user: userInfo,
      features: program.features as ProgramFeatures | null,
      initialChats,
      exerciseCount: exerciseCount || 0,
    };
    mobileTabsProps = {
      slug,
      features: program.features as ProgramFeatures | null,
    };

    loadedModes = await getProgramModes(supabase, program.id);
  }

  // ВСЕГДА одинаковая структура DOM: div > main > children
  // Sidebar и MobileTabs — условные siblings, но main с children не меняет позицию в дереве
  return (
    <ChatListProvider>
      <ModesProvider modes={loadedModes}>
        <div className={isAuthed ? "app-shell" : "app-shell no-tabs"}>
          {sidebarProps && (
            <Sidebar
              slug={sidebarProps.slug}
              programId={sidebarProps.programId}
              user={sidebarProps.user}
              features={sidebarProps.features}
              initialChats={sidebarProps.initialChats}
              exerciseCount={sidebarProps.exerciseCount}
            />
          )}
          <main className="app-main">
            {children}
          </main>
          {mobileTabsProps && (
            <MobileTabs
              slug={mobileTabsProps.slug}
              features={mobileTabsProps.features}
            />
          )}
        </div>
      </ModesProvider>
    </ChatListProvider>
  );
}
