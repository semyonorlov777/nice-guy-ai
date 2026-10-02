import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { requireProgramFeature } from "@/lib/queries/program";
import { getSelfReports, type SelfReportRow } from "@/lib/queries/voice";
import { CONFIDENCE_ITEMS, CONFIDENCE_KEYS } from "@/lib/voice-practice/self-report";
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

  const db = createServiceClient();
  const [{ data: clients }, { data: modes }, reports] = await Promise.all([
    db.from("voice_clients").select("id, display_name").eq("program_id", programId),
    db.from("program_modes").select("id, mode_templates!inner(name, key)").eq("program_id", programId),
    getSelfReports(supabase, user.id, programId),
  ]);
  const clientName = new Map((clients ?? []).map((c) => [c.id, c.display_name as string]));
  const modeName = new Map((modes ?? []).map((m) => [m.id, (m.mode_templates as unknown as { name: string }).name]));
  // Попытки разминки «Первые слова» — не консультации: у них нет разбора, итог показывает сама разминка.
  const warmupIds = new Set(
    (modes ?? []).filter((m) => (m.mode_templates as unknown as { key: string }).key === "voice_warmup").map((m) => m.id),
  );
  const list = (sessions ?? []).filter((s) => !warmupIds.has(s.program_mode_id));
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
      <ConfidenceBlock reports={reports} />
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

// Уверенность: первая отметка «до» → последняя отметка после неё.
function ConfidenceBlock({ reports }: { reports: SelfReportRow[] }) {
  const marks = reports.filter((r) => r.kind === "confidence_pre" || r.kind === "confidence_post");
  const was = marks.find((r) => r.kind === "confidence_pre") ?? marks[0];
  if (!was) return null;
  const later = marks.filter((r) => r !== was && r.created_at > was.created_at);
  const now = later.at(-1) ?? null;
  const day = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
  const fmtDay = (d: string) => day.format(new Date(`${d}T00:00:00Z`));
  const val = (r: SelfReportRow, k: string) => (typeof r.answers[k] === "number" ? (r.answers[k] as number) : null);
  return (
    <>
      <p className="vp-kicker" style={{ marginTop: 20 }}>Уверенность: было → сейчас</p>
      <div className="vp-card">
        {CONFIDENCE_ITEMS.map((text, i) => {
          const k = CONFIDENCE_KEYS[i];
          return (
            <div key={k} className="vp-conf-row">
              <p>{text}</p>
              <b>
                {val(was, k) ?? "—"} → {now ? val(now, k) ?? "—" : "…"}
              </b>
            </div>
          );
        })}
        <p className="vp-small" style={{ textAlign: "left" }}>
          {fmtDay(was.day)}{now ? (now.day === was.day ? "" : ` → ${fmtDay(now.day)}`) : " → отметите после консультации"}. Это ваше ощущение, а не оценка навыка.
        </p>
      </div>
    </>
  );
}
