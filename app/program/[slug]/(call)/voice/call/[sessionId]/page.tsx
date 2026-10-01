import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { CallScreen } from "@/components/voice-practice/CallScreen";

export const dynamic = "force-dynamic";

export default async function VoiceCallPage({ params }: { params: Promise<{ slug: string; sessionId: string }> }) {
  const { slug, sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?redirect=/program/${slug}/voice/call/${sessionId}`);

  const { data: s } = await supabase
    .from("voice_sessions")
    .select("id, status, client_id, started_at")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!s) notFound();
  if (s.status === "ended" || s.status === "failed") redirect(`/program/${slug}/voice/session/${sessionId}`);

  const { data: client } = s.client_id
    ? await createServiceClient().from("voice_clients").select("display_name").eq("id", s.client_id).maybeSingle()
    : { data: null };

  return (
    <CallScreen
      programSlug={slug}
      sessionId={sessionId}
      clientName={client?.display_name ?? "Учебный клиент"}
      resumable={!!s.started_at}
    />
  );
}
