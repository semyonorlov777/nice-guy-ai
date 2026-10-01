import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import "@/components/voice-practice/voice-practice.css";
import { DebriefPanel } from "@/components/voice-practice/DebriefPanel";

export const dynamic = "force-dynamic";

// Итог консультации: разбор по критериям курса и расшифровка разговора.
export default async function VoiceSessionPage({ params }: { params: Promise<{ slug: string; sessionId: string }> }) {
  const { slug, sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?redirect=/program/${slug}/voice/session/${sessionId}`);

  const { data: s } = await supabase
    .from("voice_sessions")
    .select("id, status, seconds_used, kind, drill_moment_id, program_mode_id, voice_turns(seq, role, text)")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!s) notFound();
  const turns = ((s.voice_turns ?? []) as { seq: number; role: string; text: string }[]).sort((a, b) => a.seq - b.seq);
  const minutes = Math.max(1, Math.round((s.seconds_used ?? 0) / 60));
  const { data: pm } = await supabase
    .from("program_modes")
    .select("mode_templates!inner(route_suffix)")
    .eq("id", s.program_mode_id)
    .maybeSingle();
  const routeSuffix = (pm?.mode_templates as unknown as { route_suffix: string } | undefined)?.route_suffix;
  const againHref = routeSuffix
    ? `/program/${slug}${routeSuffix}${s.kind === "drill" && s.drill_moment_id ? `?moment=${s.drill_moment_id}` : ""}`
    : null;

  return (
    <div className="vp-screen">
      <p className="vp-kicker">Учебная консультация · {minutes} мин</p>
      <h1 className="vp-title">{s.kind === "drill" ? "Попытка завершена" : "Консультация завершена"}</h1>
      <DebriefPanel sessionId={sessionId} />
      {againHref && (
        <Link className="vp-btn" href={againHref} style={{ marginBottom: 20 }}>
          {s.kind === "drill" ? "Ещё раз этот момент" : "Ещё раз с этим клиентом"}
        </Link>
      )}
      <p className="vp-kicker" style={{ marginTop: 20 }}>Расшифровка</p>
      <div className="vp-card">
        {turns.length === 0 ? (
          <p className="vp-hint">Разговор был слишком коротким — расшифровки нет.</p>
        ) : (
          <ol className="vp-transcript">
            {turns.map((t) => (
              <li key={t.seq}>
                <b>{t.role === "student" ? "Вы" : "Клиент"}</b>
                {t.text}
              </li>
            ))}
          </ol>
        )}
      </div>
      <Link className="vp-btn vp-btn-quiet" href={`/program/${slug}/hub`}>
        На главную практикума
      </Link>
    </div>
  );
}
