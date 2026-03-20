import { createClient } from "@/lib/supabase-server";
import { ChatWindow } from "@/components/ChatWindow";
import { toUIMessages } from "@/lib/utils";
import { getUserProfileForChat } from "@/lib/queries/user-profile";
import { requireProgramFeature } from "@/lib/queries/program";

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

  if (!user) return null;

  // Проверяем что фича author_chat включена для этой программы
  await requireProgramFeature(supabase, slug, "author_chat");

  const { data: program } = await supabase
    .from("programs")
    .select("id, title, author_chat_welcome, author_chat_system_prompt")
    .eq("slug", slug)
    .single();

  if (!program) return null;

  // User initial for avatar
  const { userInitial, avatarUrl } = await getUserProfileForChat(supabase, user);

  return (
    <ChatWindow
      key="author-chat"
      initialMessages={toUIMessages([])}
      chatId={null}
      programId={program.id}
      chatType="author"
      userInitial={userInitial}
      avatarUrl={avatarUrl}
      welcomeMessage={program.author_chat_welcome}
    >
      <div className="welcome-card">
        <div className="welcome-book">
          <img src="https://cdn.litres.ru/pub/c/cover_415/6882766.webp" alt="" />
        </div>
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
