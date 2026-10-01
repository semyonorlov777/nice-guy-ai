import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { requireProgramFeature } from "@/lib/queries/program";
import "@/components/voice-practice/voice-practice.css";

export const dynamic = "force-dynamic";

// «Моя практика»: прошедшие учебные консультации со ссылками на разбор.
export default async function VoicePracticePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { id: programId } = await requireProgramFeature(supabase, slug, "voice");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?redirect=/program/${slug}/voice`);

  const { data: sessions } = await supabase
    .from("voice_sessions")
    .select("id, status, seconds_used, created_at, client_id, program_mode_id")
    .eq("user_id", user.id)
    .eq("program_id", programId)
    .order("created_at", { ascending: false })
    .limit(50);
  const list = sessions ?? [];

  const db = createServiceClient();
  const [{ data: clients }, { data: modes }] = await Promise.all([
    db.from("voice_clients").select("id, display_name").eq("program_id", programId),
    db.from("program_modes").select("id, mode_templates!inner(name)").eq("program_id", programId),
  ]);
  const clientName = new Map((clients ?? []).map((c) => [c.id, c.display_name as string]));
  const modeName = new Map((modes ?? []).map((m) => [m.id, (m.mode_templates as unknown as { name: string }).name]));
  const done = list.filter((s) => s.status === "ended" && s.seconds_used >= 60);
  const minutes = Math.round(done.reduce((n, s) => n + s.seconds_used, 0) / 60);
  const fmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

  return (
    <div className="vp-screen">
      <p className="vp-kicker">Моя практика</p>
      <h1 className="vp-title">Учебные консультации</h1>
      <div className="vp-card">
        <div className="vp-row"><span>Проведено консультаций</span><b>{done.length}</b></div>
        <div className="vp-row"><span>Минут практики</span><b>{minutes}</b></div>
      </div>
      {list.length === 0 ? (
        <div className="vp-card vp-hint">Здесь появятся ваши консультации и разборы. Начните с главной страницы практикума.</div>
      ) : (
        list.map((s) => (
          <Link key={s.id} href={`/program/${slug}/voice/session/${s.id}`} className="vp-card vp-client" style={{ textDecoration: "none" }}>
            <span>
              <b>{modeName.get(s.program_mode_id) ?? "Консультация"} · {s.client_id ? clientName.get(s.client_id) ?? "" : ""}</b>
              <span>
                {fmt.format(new Date(s.created_at))} · {Math.max(1, Math.round(s.seconds_used / 60))} мин
                {s.status !== "ended" ? " · не завершена" : ""}
              </span>
            </span>
          </Link>
        ))
      )}
      <Link className="vp-btn" href={`/program/${slug}/hub`}>
        На главную практикума
      </Link>
    </div>
  );
}
