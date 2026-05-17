import { createClient } from "@/lib/supabase-server";
import { ChatWindow } from "@/components/ChatWindow";
import { toUIMessages } from "@/lib/utils";
import { getUserProfileForChat } from "@/lib/queries/user-profile";

interface ToolChatPageProps {
  slug: string;
  chatType: string;
}

export async function ToolChatPage({ slug, chatType }: ToolChatPageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [programRes, modeRes, userProfile] = await Promise.all([
    supabase
      .from("programs")
      .select("id, title, landing_data")
      .eq("slug", slug)
      .single(),
    supabase
      .from("program_modes")
      .select(
        "welcome_message, welcome_ai_message, welcome_replies, config, mode_templates!inner(chat_type), programs!inner(slug)",
      )
      .eq("programs.slug", slug)
      .eq("mode_templates.chat_type", chatType)
      .maybeSingle(),
    getUserProfileForChat(supabase, user),
  ]);

  const program = programRes.data;
  const modeData = modeRes.data;

  if (!program) return null;

  const landingData = program.landing_data as { book?: { cover_url?: string } } | null;
  const coverUrl = landingData?.book?.cover_url || "";

  const modeConfig = (modeData?.config || {}) as { quick_replies?: string[] };
  const welcomeMsg = modeData?.welcome_ai_message || modeData?.welcome_message || undefined;
  const welcomeReplies = Array.isArray(modeData?.welcome_replies)
    ? (modeData.welcome_replies as { text: string; type?: "normal" | "exit" }[])
    : [];
  const quickRepliesArr = welcomeReplies.length > 0 ? welcomeReplies : modeConfig.quick_replies;
  const { userInitial, avatarUrl, balanceTokens } = userProfile;

  return (
    <ChatWindow
      key={chatType}
      initialMessages={toUIMessages([])}
      chatId={null}
      programId={program.id}
      chatType={chatType}
      userInitial={userInitial}
      avatarUrl={avatarUrl}
      coverUrl={coverUrl}
      balance={balanceTokens}
      slug={slug}
      currentModeKey={chatType}
      programTitle={program.title}
      welcomeMessage={welcomeMsg}
      quickReplies={quickRepliesArr}
    />
  );
}
