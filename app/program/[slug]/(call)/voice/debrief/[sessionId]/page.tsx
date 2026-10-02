import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { VoiceDebriefScreen } from "@/components/voice-practice/VoiceDebriefScreen";
import { clientName, debriefAvailability, findDebrief } from "@/lib/voice-practice/debrief-voice";

export const dynamic = "force-dynamic";

const LIVE = ["created", "active", "paused", "reconnecting"];

// Голосовой разбор встречи (sessionId — встреча). Если разбор голосом недоступен или уже прошёл — запись текстом.
export default async function VoiceDebriefPage({ params }: { params: Promise<{ slug: string; sessionId: string }> }) {
  const { slug, sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?redirect=/program/${slug}/voice/debrief/${sessionId}`);

  const resultHref = `/program/${slug}/voice/session/${sessionId}`;
  const db = createServiceClient();
  const avail = await debriefAvailability(db, sessionId, user.id);
  if (!avail.ok) redirect(avail.reason === "not_ended" ? `/program/${slug}/voice/call/${sessionId}` : resultHref);
  const existing = await findDebrief(db, sessionId);
  if (existing && !LIVE.includes(existing.status)) redirect(resultHref);

  const { data: client } = avail.parent.client_id
    ? await db.from("voice_clients").select("display_name").eq("id", avail.parent.client_id).maybeSingle()
    : { data: null };
  const cn = clientName((client?.display_name as string | undefined) ?? "Клиент");

  return (
    <VoiceDebriefScreen
      programSlug={slug}
      parentId={sessionId}
      client={{ name: cn.name, gen: cn.gen, dat: cn.dat, female: cn.female }}
      resumable={!!existing}
      skipClient={avail.skipClient}
    />
  );
}
