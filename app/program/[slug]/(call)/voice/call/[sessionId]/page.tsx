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
    .select("id, status, client_id, started_at, kind, drill_moment_id, program_mode_id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!s) notFound();
  if (s.status === "ended" || s.status === "failed") redirect(`/program/${slug}/voice/session/${sessionId}`);

  const svc = createServiceClient();
  const [{ data: client }, { data: mode }, { data: pm }] = await Promise.all([
    s.client_id
      ? svc.from("voice_clients").select("display_name, config").eq("id", s.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    s.kind === "drill"
      ? svc.from("voice_modes").select("drill_moments").eq("program_mode_id", s.program_mode_id).maybeSingle()
      : Promise.resolve({ data: null }),
    svc.from("program_modes").select("config").eq("id", s.program_mode_id).maybeSingle(),
  ]);
  const clientStarts = (pm?.config as { voice?: { client_starts?: boolean } } | null)?.voice?.client_starts === true;
  const briefing = (client?.config as { briefing?: string } | null)?.briefing ?? null;
  const moment = ((mode?.drill_moments as { id: string; title: string; context: string }[] | null) ?? []).find(
    (m) => m.id === s.drill_moment_id,
  );

  return (
    <CallScreen
      programSlug={slug}
      sessionId={sessionId}
      clientName={client?.display_name ?? "Учебный клиент"}
      resumable={!!s.started_at}
      drill={moment ? { title: moment.title, context: moment.context } : null}
      lateStart={!moment && clientStarts ? { briefing } : null}
    />
  );
}
