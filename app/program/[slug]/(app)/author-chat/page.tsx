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
    .select("id, title, author_chat_welcome, author_chat_system_prompt, landing_data")
    .eq("slug", slug)
    .single();

  if (!program) return null;

  const landingData = program.landing_data as {
    book?: { cover_url?: string };
    author?: { name?: string; photo_url?: string | null; credentials?: string; quote?: string };
  } | null;
  const coverUrl = landingData?.book?.cover_url || "";
  const authorName = landingData?.author?.name || program.title;
  const authorCredentials = landingData?.author?.credentials || "";

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
          {coverUrl && <img src={coverUrl} alt="" />}
        </div>
        <div className="welcome-title">{authorName}</div>
        <div className="welcome-sub">Автор книги</div>
        {authorCredentials && (
          <div className="welcome-desc">{authorCredentials}</div>
        )}
      </div>
    </ChatWindow>
  );
}
