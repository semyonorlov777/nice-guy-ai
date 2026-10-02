"use client";

// Разбор после консультации — в порядке учебной тройки: пока сервер собирает разбор,
// слово психологу (студент вспоминает сам); потом — как клиенту было с вами; потом взгляд
// наблюдателя: что сработало и что попробовать иначе; в конце — один фокус. Остальное свёрнуто.
// Разборы до 02.10 (без client_voice) показываются в прежнем виде.
import { useEffect, useState } from "react";
import "./voice-practice.css";

interface Fb {
  turn?: string;
  quote?: string;
  why?: string;
  alternative?: string;
  skill?: string;
  client_line?: string;
  effect?: string;
  verified?: boolean;
}
interface Feedback {
  client_voice?: { text?: string } | null;
  worked?: Fb[] | null;
  try?: Fb[] | null;
  stuck_stage?: { name?: string; note?: string } | null;
  focus?: { text?: string; client_line?: string } | null;
}
interface Debrief {
  status: "queued" | "processing" | "ready" | "failed" | "none";
  is_fallback: boolean;
  strength: Fb | null;
  fix: Fb | null;
  repeat: Fb | null;
  summary: string | null;
  counters: { why_count?: number; advice_markers?: number; reassurance_cliches?: number; evaluation_words?: number; talk_share_student?: number | null } | null;
  result: { stages?: { stage: number; name: string; status: string; missing?: string | null }[]; feedback?: Feedback } | null;
}

const STAGE_LABEL: Record<string, string> = { present: "есть", partial: "частично", absent: "нет" };
const WAIT_LIMIT_MS = 150_000;

export function DebriefPanel({ sessionId }: { sessionId: string }) {
  const [d, setD] = useState<Debrief | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let stop = false;
    const started = Date.now();
    async function poll() {
      while (!stop) {
        const r = await fetch(`/api/practice/sessions/${sessionId}`, { cache: "no-store" }).catch(() => null);
        const j = r?.ok ? ((await r.json()) as { voice_debriefs: Debrief | null }) : null;
        const deb = j?.voice_debriefs ?? null;
        if (deb) setD(deb);
        if (deb && (deb.status === "ready" || deb.status === "none" || deb.status === "failed")) return;
        if (Date.now() - started > WAIT_LIMIT_MS) {
          setTimedOut(true);
          return;
        }
        await new Promise((res) => setTimeout(res, 3000));
      }
    }
    void poll();
    return () => {
      stop = true;
    };
  }, [sessionId]);

  if (!d || d.status === "queued" || d.status === "processing") {
    return (
      <div className="vp-card" role="status">
        <p className="vp-kicker">Сначала — вы</p>
        <p className="vp-lead" style={{ margin: "0 0 8px" }}>
          Как в учебной тройке, первое слово после встречи — за психологом. Вспомните момент, где было труднее всего, и что бы вы сказали там иначе.
        </p>
        <p className="vp-small vp-left" style={{ margin: 0 }}>
          {timedOut ? "Разбор задерживается. Обновите страницу через минуту." : "Тем временем собираем разбор — обычно это 20–40 секунд."}
        </p>
      </div>
    );
  }
  if (d.status === "none") {
    return <div className="vp-card vp-hint">Разговор получился слишком коротким для разбора. Попробуйте ещё раз — хватит двух-трёх минут.</div>;
  }

  const fb = d.result?.feedback;
  return (
    <>
      {d.is_fallback && <div className="vp-error">Подробный разбор не собрался. Ниже — то, что посчитано автоматически.</div>}
      {fb?.client_voice?.text ? <TroikaFeedback fb={fb} /> : <LegacyFeedback d={d} />}
      <Details d={d} stuck={fb?.stuck_stage ?? null} />
    </>
  );
}

function TroikaFeedback({ fb }: { fb: Feedback }) {
  const worked = (fb.worked ?? []).filter((w) => w.quote);
  const tries = (fb.try ?? []).filter((t) => t.quote || t.alternative);
  return (
    <>
      <div className="vp-card">
        <p className="vp-kicker">Как клиенту было с вами</p>
        <p className="vp-lead" style={{ margin: 0 }}>{fb.client_voice?.text}</p>
      </div>
      {worked.length > 0 && (
        <div className="vp-card">
          <p className="vp-kicker">Что сработало</p>
          {worked.map((w, i) => (
            <div key={i} style={i ? { marginTop: 14 } : undefined}>
              <p className="vp-quote">«{w.quote}»</p>
              {w.effect && <p className="vp-hint" style={{ margin: 0 }}>{w.effect}</p>}
            </div>
          ))}
        </div>
      )}
      {tries.map((t, i) => (
        <div className="vp-card" key={i}>
          <p className="vp-kicker">Что попробовать иначе</p>
          {t.client_line && <p className="vp-small vp-left">Клиент: «{t.client_line}»</p>}
          {t.quote && <p className="vp-quote vp-quote-was">Вы: «{t.quote}»</p>}
          {t.alternative && <p className="vp-quote">Можно: «{t.alternative}»</p>}
          {t.why && <p className="vp-hint" style={{ margin: 0 }}>{t.why}</p>}
        </div>
      ))}
      {fb.focus?.text && (
        <div className="vp-card">
          <p className="vp-kicker">Фокус на следующую попытку</p>
          <p className="vp-lead" style={{ margin: 0 }}>{fb.focus.text}</p>
        </div>
      )}
    </>
  );
}

function LegacyFeedback({ d }: { d: Debrief }) {
  return (
    <>
      {d.strength?.quote && (
        <div className="vp-card">
          <p className="vp-kicker">Что сработало</p>
          <p className="vp-quote">«{d.strength.quote}»</p>
          <p className="vp-hint">{d.strength.why}</p>
        </div>
      )}
      {d.fix?.quote && (
        <div className="vp-card">
          <p className="vp-kicker">Что попробовать</p>
          <p className="vp-quote vp-quote-was">«{d.fix.quote}»</p>
          {d.fix.alternative && <p className="vp-quote">→ «{d.fix.alternative}»</p>}
          <p className="vp-hint">{d.fix.why}</p>
        </div>
      )}
      {d.summary && <p className="vp-lead">{d.summary}</p>}
    </>
  );
}

function Details({ d, stuck }: { d: Debrief; stuck: Feedback["stuck_stage"] }) {
  const c = d.counters ?? {};
  return (
    <details className="vp-card">
      <summary className="vp-kicker" style={{ cursor: "pointer", margin: 0 }}>Подробнее</summary>
      <div style={{ marginTop: 10 }}>
        {stuck?.note && (
          <p className="vp-hint" style={{ marginTop: 0 }}>
            Где встреча застряла{stuck.name ? ` — ${stuck.name}` : ""}: {stuck.note}
          </p>
        )}
        <div className="vp-row"><span>Вопросов «почему» и «зачем»</span><b>{c.why_count ?? 0}</b></div>
        <div className="vp-row"><span>Советов</span><b>{c.advice_markers ?? 0}</b></div>
        <div className="vp-row"><span>«Всё будет хорошо» и похожее</span><b>{c.reassurance_cliches ?? 0}</b></div>
        {c.talk_share_student != null && (
          <div className="vp-row"><span>Сколько говорили вы</span><b>{Math.round(c.talk_share_student * 100)}%</b></div>
        )}
        {(d.result?.stages ?? []).map((st) => (
          <div className="vp-row" key={st.stage}>
            <span>
              {st.name}
              {st.missing && st.status !== "present" ? <span className="vp-small" style={{ display: "block", textAlign: "left", marginTop: 2 }}>{st.missing}</span> : null}
            </span>
            <b>{STAGE_LABEL[st.status] ?? st.status}</b>
          </div>
        ))}
      </div>
    </details>
  );
}
