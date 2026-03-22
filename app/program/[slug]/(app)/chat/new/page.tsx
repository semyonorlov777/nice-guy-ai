import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getWelcomeConfig } from "@/lib/welcome-config";
import { NewChatScreen } from "@/components/chat/NewChatScreen";

export default async function NewChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: program } = await supabase
    .from("programs")
    .select("id, title, landing_data")
    .eq("slug", slug)
    .single();

  if (!program) redirect("/");

  const landingData = program.landing_data as { book?: { cover_url?: string } } | null;
  const coverUrl = landingData?.book?.cover_url || null;

  const welcome = getWelcomeConfig({
    topic: query.topic,
    tool: query.tool,
  });

  return (
    <NewChatScreen
      slug={slug}
      programId={program.id}
      coverUrl={coverUrl}
      welcome={welcome}
      topic={query.topic}
      tool={query.tool}
    />
  );
}
