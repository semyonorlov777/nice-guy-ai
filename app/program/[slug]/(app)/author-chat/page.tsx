import { createClient } from "@/lib/supabase-server";
import { ChatWindow } from "@/components/ChatWindow";
import { toUIMessages } from "@/lib/utils";

export default async function AuthorChatPage({
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
    .select("id, title, author_chat_welcome, author_chat_system_prompt")
    .eq("slug", slug)
    .single();

  if (!user || !program) return null;

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

  return (
    <ChatWindow
      key="author-chat"
      initialMessages={toUIMessages([])}
      chatId={null}
      programId={program.id}
      chatType="author"
      userInitial={userInitial}
      welcomeMessage={program.author_chat_welcome}
    >
      <div className="welcome-card">
        <div className="welcome-emoji">{"\u270D\uFE0F"}</div>
        <div className="welcome-title">Роберт Гловер</div>
        <div className="welcome-sub">Автор книги</div>
        <div className="welcome-desc">
          Задай вопрос автору книги — он ответит, опираясь на свой 30-летний
          опыт работы с мужчинами.
        </div>
      </div>
    </ChatWindow>
  );
}
