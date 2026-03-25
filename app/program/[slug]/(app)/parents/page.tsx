import { createClient } from "@/lib/supabase-server";
import { ChatWindow } from "@/components/ChatWindow";
import { toUIMessages } from "@/lib/utils";
import { getUserProfileForChat } from "@/lib/queries/user-profile";

export default async function ParentsPage({
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
    .select("id, landing_data")
    .eq("slug", slug)
    .single();

  if (!user || !program) return null;

  const landingData = program.landing_data as { book?: { cover_url?: string } } | null;
  const coverUrl = landingData?.book?.cover_url || "";

  const { userInitial, avatarUrl, balanceTokens } = await getUserProfileForChat(supabase, user);

  return (
    <ChatWindow
      key="ng-parents"
      initialMessages={toUIMessages([])}
      chatId={null}
      programId={program.id}
      chatType="ng_parents"
      userInitial={userInitial}
      avatarUrl={avatarUrl}
      coverUrl={coverUrl}
      balance={balanceTokens}
      slug={slug}
      currentModeKey="ng_parents"
    />
  );
}
