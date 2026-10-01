import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import "@/components/voice-practice/voice-practice.css";

export const dynamic = "force-dynamic";

// Итог консультации. Подробный разбор появится здесь следующим шагом;
// пока — расшифровка разговора, чтобы было что перечитать.
export default async function VoiceSessionPage({ params }: { params: Promise<{ slug: string; sessionId: string }> }) {
  const { slug, sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?redirect=/program/${slug}/voice/session/${sessionId}`);

  const { data: s } = await supabase
    .from("voice_sessions")
    .select("id, status, seconds_used, voice_turns(seq, role, text)")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!s) notFound();
  const turns = ((s.voice_turns ?? []) as { seq: number; role: string; text: string }[]).sort((a, b) => a.seq - b.seq);
  const minutes = Math.max(1, Math.round((s.seconds_used ?? 0) / 60));

  return (
    <div className="vp-screen">
      <p className="vp-kicker">Учебная консультация · {minutes} мин</p>
      <h1 className="vp-title">Консультация завершена</h1>
      <p className="vp-lead">Разбор по критериям курса появится здесь. Ниже — расшифровка разговора.</p>
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
      <Link className="vp-btn" href={`/program/${slug}/hub`}>
        На главную практикума
      </Link>
    </div>
  );
}
