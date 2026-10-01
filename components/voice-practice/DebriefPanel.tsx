"use client";

// Разбор после консультации: ждём готовности (сервер собирает его в фоне) и показываем
// одну сильную сторону, одну правку и что повторить. Остальное — свёрнуто.
import { useEffect, useState } from "react";
import "./voice-practice.css";

interface Fb {
  turn?: string;
  quote?: string;
  why?: string;
  alternative?: string;
  skill?: string;
  client_line?: string;
  verified?: boolean;
}
interface Debrief {
  status: "queued" | "processing" | "ready" | "failed" | "none";
  is_fallback: boolean;
  strength: Fb | null;
  fix: Fb | null;
  repeat: Fb | null;
  summary: string | null;
  counters: { why_count?: number; advice_markers?: number; reassurance_cliches?: number; evaluation_words?: number; talk_share_student?: number | null } | null;
  result: { stages?: { stage: number; name: string; status: string; missing?: string | null }[] } | null;
}

const STAGE_LABEL: Record<string, string> = { present: "есть", partial: "частично", absent: "нет" };
const WAIT_LIMIT_MS = 90_000;

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
      <div className="vp-card vp-hint" role="status">
        {timedOut ? "Разбор задерживается. Обновите страницу через минуту." : "Собираем разбор по критериям курса — обычно это 20–40 секунд."}
      </div>
    );
  }
  if (d.status === "none") {
    return <div className="vp-card vp-hint">Разговор получился слишком коротким для разбора. Попробуйте ещё раз — хватит двух-трёх минут.</div>;
  }

  const c = d.counters ?? {};
  return (
    <>
      {d.is_fallback && (
        <div className="vp-error">Подробный разбор не собрался. Ниже — то, что посчитано автоматически.</div>
      )}
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
      <details className="vp-card">
        <summary className="vp-kicker" style={{ cursor: "pointer", margin: 0 }}>Подробнее</summary>
        <div style={{ marginTop: 10 }}>
          <div className="vp-row"><span>Вопросов «почему»</span><b>{c.why_count ?? 0}</b></div>
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
    </>
  );
}
