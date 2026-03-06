import { createClient } from "@/lib/supabase-server";
import { ChatWindow } from "@/components/ChatWindow";
import { toUIMessages } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function TestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: program } = await supabase
    .from("programs")
    .select("id, title")
    .eq("slug", slug)
    .single();

  if (!program) redirect("/");

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

  // Find existing active test chat
  const { data: chat } = await supabase
    .from("chats")
    .select("id, test_state")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .eq("chat_type", "test")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  // Load messages if chat exists
  let initialMessages: { role: string; content: string }[] = [];
  if (chat) {
    const { data: messages } = await supabase
      .from("messages")
      .select("role, content")
      .eq("chat_id", chat.id)
      .order("created_at", { ascending: true });

    initialMessages = (messages || []).map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  // Check for latest completed test result
  const { data: lastResult } = await supabase
    .from("test_results")
    .select("total_score, created_at")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <ChatWindow
      initialMessages={toUIMessages(initialMessages)}
      chatId={chat?.id || null}
      programId={program.id}
      chatType="test"
      userInitial={userInitial}
      quickReplies={["Готов, начнём", "Расскажи подробнее о тесте"]}
    >
      <div className="welcome-card">
        {lastResult && (
          <div className="test-last-result">
            Последний результат: ИССП {lastResult.total_score}/100 от{" "}
            {new Date(lastResult.created_at).toLocaleDateString("ru-RU")}
          </div>
        )}
        <div className="welcome-emoji">{"📊"}</div>
        <div className="welcome-title">Тест ИССП</div>
        <div className="welcome-sub">35 вопросов · ~15 минут</div>
        <div className="welcome-desc">
          Определи свой уровень по 7 шкалам синдрома славного парня. Отвечай
          числом от 1 до 5 или своими словами.
        </div>
      </div>
    </ChatWindow>
  );
}
