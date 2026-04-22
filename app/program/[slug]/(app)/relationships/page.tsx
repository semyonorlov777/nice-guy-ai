import { createClient } from "@/lib/supabase-server";
import { ChatWindow } from "@/components/ChatWindow";
import { toUIMessages } from "@/lib/utils";
import { getUserProfileForChat } from "@/lib/queries/user-profile";

export default async function RelationshipsPage({
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
    .select("id, title, landing_data")
    .eq("slug", slug)
    .single();

  if (!user || !program) return null;

  const landingData = program.landing_data as { book?: { cover_url?: string } } | null;
  const coverUrl = landingData?.book?.cover_url || "";

  const { data: modeData } = await supabase
    .from("program_modes")
    .select("welcome_message, welcome_ai_message, welcome_replies, config, mode_templates!inner(chat_type)")
    .eq("program_id", program.id)
    .eq("mode_templates.chat_type", "ng_relationships")
    .maybeSingle();

  const modeConfig = (modeData?.config || {}) as { quick_replies?: string[] };
  const welcomeMsg = modeData?.welcome_ai_message || modeData?.welcome_message || undefined;
  const welcomeReplies = Array.isArray(modeData?.welcome_replies) ? modeData.welcome_replies as { text: string; type?: "normal" | "exit" }[] : [];
  const quickRepliesArr = welcomeReplies.length > 0
    ? welcomeReplies
    : modeConfig.quick_replies;
  const { userInitial, avatarUrl, balanceTokens } = await getUserProfileForChat(supabase, user);

  return (
    <ChatWindow
      key="ng-relationships"
      initialMessages={toUIMessages([])}
      chatId={null}
      programId={program.id}
      chatType="ng_relationships"
      userInitial={userInitial}
      avatarUrl={avatarUrl}
      coverUrl={coverUrl}
      balance={balanceTokens}
      slug={slug}
      currentModeKey="ng_relationships"
      programTitle={program.title}
      welcomeMessage={welcomeMsg}
      quickReplies={quickRepliesArr}
    />
  );
}
