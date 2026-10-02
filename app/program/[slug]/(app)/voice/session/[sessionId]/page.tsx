import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import "@/components/voice-practice/voice-practice.css";
import { DebriefPanel } from "@/components/voice-practice/DebriefPanel";
import { ConfidencePost } from "@/components/voice-practice/ConfidencePost";
import { practiceDay } from "@/lib/voice-practice/day";
import { clientName, reflectionFromTurns, type DebriefScriptState, type DebriefTurn } from "@/lib/voice-practice/debrief-voice";

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
    .select("id, program_id, status, seconds_used, reconnects, usage, engine_model, kind, drill_moment_id, program_mode_id, parent_session_id, client_id, voice_turns(seq, role, text), voice_debriefs(usage, model)")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!s) notFound();
  // Голосовой разбор встречи — часть итога самой встречи.
  if (s.kind === "debrief" && s.parent_session_id) redirect(`/program/${slug}/voice/session/${s.parent_session_id}`);
  const turns = ((s.voice_turns ?? []) as { seq: number; role: string; text: string }[]).sort((a, b) => a.seq - b.seq);
  const minutes = Math.max(1, Math.round((s.seconds_used ?? 0) / 60));
  const [{ data: pm }, { data: voiceDebrief }, { data: client }] = await Promise.all([
    supabase.from("program_modes").select("config, mode_templates!inner(route_suffix)").eq("id", s.program_mode_id).maybeSingle(),
    // Голосовой разбор этой встречи («как в тройке»), если был.
    supabase
      .from("voice_sessions")
      .select("id, status, script_state, voice_turns(seq, role, text, segment)")
      .eq("parent_session_id", s.id)
      .eq("kind", "debrief")
      .neq("status", "failed")
      .maybeSingle(),
    s.client_id ? supabase.from("voice_clients").select("display_name").eq("id", s.client_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const cName = clientName((client?.display_name as string | undefined) ?? "Клиент").name;
  const vdTurns = ((voiceDebrief?.voice_turns ?? []) as DebriefTurn[]).sort((a, b) => a.seq - b.seq);
  const reflection = voiceDebrief ? reflectionFromTurns(vdTurns, voiceDebrief.script_state as DebriefScriptState | null) : null;
  const voiceDebriefOn = (pm?.config as { voice?: { voice_debrief?: boolean } } | null)?.voice?.voice_debrief === true;
  const canVoiceDebrief = voiceDebriefOn && s.kind === "full" && s.status === "ended" && (!voiceDebrief || ["created", "active", "paused", "reconnecting"].includes(voiceDebrief.status));
  // Уверенность «после» — не чаще раза в день (граница — Москва).
  const { data: postToday } = await supabase
    .from("voice_self_reports")
    .select("id")
    .eq("user_id", user.id)
    .eq("program_id", s.program_id)
    .eq("kind", "confidence_post")
    .eq("day", practiceDay())
    .maybeSingle();
  const routeSuffix = (pm?.mode_templates as unknown as { route_suffix: string } | undefined)?.route_suffix;
  const againHref = routeSuffix
    ? `/program/${slug}${routeSuffix}${s.kind === "drill" && s.drill_moment_id ? `?moment=${s.drill_moment_id}` : ""}`
    : null;

  return (
    <div className="vp-screen">
      <p className="vp-kicker">Учебная консультация · {minutes} мин</p>
      <h1 className="vp-title">{s.kind === "drill" ? "Попытка завершена" : "Консультация завершена"}</h1>
      {reflection?.self || reflection?.feel ? (
        <div className="vp-card">
          <p className="vp-kicker">Вы о себе</p>
          <p className="vp-lead" style={{ margin: 0 }}>«{reflection.self ?? reflection.feel}»</p>
        </div>
      ) : null}
      {canVoiceDebrief && (
        <Link className="vp-btn" href={`/program/${slug}/voice/debrief/${sessionId}`} style={{ marginBottom: 16 }}>
          {voiceDebrief ? "Продолжить разбор голосом" : "Разобрать голосом"}
        </Link>
      )}
      <DebriefPanel sessionId={sessionId} />
      {reflection?.takeaway ? (
        <div className="vp-card">
          <p className="vp-kicker">Ваш вывод</p>
          <p className="vp-lead" style={{ margin: 0 }}>«{reflection.takeaway}»</p>
        </div>
      ) : null}
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
      {vdTurns.length > 0 && (
        <details className="vp-card" style={{ marginTop: 12 }}>
          <summary className="vp-kicker" style={{ cursor: "pointer", margin: 0 }}>Расшифровка разбора голосом</summary>
          <ol className="vp-transcript" style={{ marginTop: 10 }}>
            {vdTurns.map((t) => (
              <li key={t.seq}>
                <b>{t.role === "student" ? "Вы" : t.role === "client" ? `${cName} вне роли` : "Наблюдатель"}</b>
                {t.text}
              </li>
            ))}
          </ol>
        </details>
      )}
      <TechUsage
        seconds={s.seconds_used ?? 0}
        reconnects={s.reconnects ?? 0}
        model={s.engine_model}
        usage={s.usage as { prompt_tokens?: number; response_tokens?: number } | null}
        debrief={s.voice_debriefs as unknown as { usage?: Record<string, number> | null; model?: string | null } | null}
      />
      {!postToday && <ConfidencePost programSlug={slug} sessionId={sessionId} />}
      <Link className="vp-btn vp-btn-quiet" href={`/program/${slug}/hub`} style={{ marginTop: 20 }}>
        На главную практикума
      </Link>
    </div>
  );
}

// Для этапа тестов: сколько стоила консультация. Свёрнуто по умолчанию.
// Цена звука Gemini Live по прайсу: вход $3, выход $12 за 1 млн токенов
// (Google заново тарифицирует весь контекст на каждой реплике — это уже в числах).
function TechUsage(props: {
  seconds: number;
  reconnects: number;
  model: string | null;
  usage: { prompt_tokens?: number; response_tokens?: number } | null;
  debrief: { usage?: Record<string, number> | null; model?: string | null } | null;
}) {
  const inT = Number(props.usage?.prompt_tokens ?? 0);
  const outT = Number(props.usage?.response_tokens ?? 0);
  const liveUsd = (inT * 3 + outT * 12) / 1e6;
  const perMin = props.seconds > 0 ? (liveUsd / props.seconds) * 60 : 0;
  const d = props.debrief?.usage ?? null;
  const dIn = Number(d?.promptTokenCount ?? 0);
  const dOut = Number(d?.candidatesTokenCount ?? 0) + Number(d?.thoughtsTokenCount ?? 0);
  const n = (x: number) => x.toLocaleString("ru-RU");
  return (
    <details className="vp-card" style={{ marginTop: 12 }}>
      <summary className="vp-kicker" style={{ cursor: "pointer", margin: 0 }}>Для тестов: расход</summary>
      <div style={{ marginTop: 10 }}>
        <div className="vp-row"><span>Голос ({props.model ?? "—"})</span><b>${liveUsd.toFixed(3)}</b></div>
        <div className="vp-row"><span>За минуту</span><b>${perMin.toFixed(3)}</b></div>
        <div className="vp-row"><span>Токены голоса: вход / выход</span><b>{n(inT)} / {n(outT)}</b></div>
        <div className="vp-row"><span>Длительность · переподключений</span><b>{Math.round(props.seconds / 60 * 10) / 10} мин · {props.reconnects}</b></div>
        <div className="vp-row"><span>Разбор ({props.debrief?.model ?? "—"}): вход / выход</span><b>{n(dIn)} / {n(dOut)}</b></div>
      </div>
    </details>
  );
}
