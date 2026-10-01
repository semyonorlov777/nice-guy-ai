"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "./voice-practice.css";

export interface PrecallClient {
  slug: string;
  displayName: string;
  level: string;
  summary: string;
}

const LEVEL_LABEL: Record<string, string> = { A: "А", B: "Б", V: "В", G: "Г" };

export function PrecallScreen(props: {
  programSlug: string;
  modeKey: string;
  modeName: string;
  modeDescription: string | null;
  precallText: string | null;
  maxMinutes: number;
  clients: PrecallClient[];
  moments: { id: string; title: string; context: string; clientSlug: string }[];
  initialMoment?: string;
}) {
  const isDrill = props.moments.length > 0;
  const [moment, setMoment] = useState(
    props.moments.find((m) => m.id === props.initialMoment)?.id ?? props.moments[0]?.id ?? "",
  );
  const router = useRouter();
  const [client, setClient] = useState(props.clients[0]?.slug ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/practice/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isDrill
          ? { programSlug: props.programSlug, modeKey: props.modeKey, momentId: moment }
          : { programSlug: props.programSlug, modeKey: props.modeKey, clientSlug: client },
      ),
    }).catch(() => null);
    const data = (await r?.json().catch(() => null)) as { sessionId?: string; activeSessionId?: string; error?: string } | null;
    if (r?.ok && data?.sessionId) {
      router.push(`/program/${props.programSlug}/voice/call/${data.sessionId}`);
      return;
    }
    if (r?.status === 409 && data?.activeSessionId) {
      router.push(`/program/${props.programSlug}/voice/call/${data.activeSessionId}`);
      return;
    }
    setBusy(false);
    setError(data?.error ?? "Не удалось начать. Проверьте связь и попробуйте ещё раз.");
  }

  return (
    <div className="vp-screen">
      <p className="vp-kicker">Учебная консультация · до {props.maxMinutes} мин</p>
      <h1 className="vp-title">{props.modeName}</h1>
      {props.modeDescription && <p className="vp-lead">{props.modeDescription}</p>}

      {isDrill && (
        <>
          <p className="vp-kicker">Трудный момент</p>
          {props.moments.map((m) => {
            const c = props.clients.find((x) => x.slug === m.clientSlug);
            return (
              <button
                key={m.id}
                type="button"
                className="vp-card vp-client"
                aria-pressed={moment === m.id}
                onClick={() => setMoment(m.id)}
              >
                <span className="vp-level">{c ? LEVEL_LABEL[c.level] ?? c.level : "·"}</span>
                <span>
                  <b>{m.title}</b>
                  <span>
                    {c?.displayName ? `${c.displayName}. ` : ""}
                    {m.context}
                  </span>
                </span>
              </button>
            );
          })}
        </>
      )}
      {!isDrill && <p className="vp-kicker">Учебный клиент</p>}
      {!isDrill && props.clients.map((c) => (
        <button
          key={c.slug}
          type="button"
          className="vp-card vp-client"
          aria-pressed={client === c.slug}
          onClick={() => setClient(c.slug)}
        >
          <span className="vp-level">{LEVEL_LABEL[c.level] ?? c.level}</span>
          <span>
            <b>{c.displayName}</b>
            <span>{c.summary}</span>
          </span>
        </button>
      ))}

      {props.precallText && (
        <div className="vp-card vp-hint">
          <b>Что тренируем.</b> {props.precallText}
        </div>
      )}
      <div className="vp-card vp-hint">
        Если есть наушники — наденьте, звук будет чище. Найдите тихое место и не сворачивайте страницу.{" "}
        {isDrill ? "Клиент начнёт сам: выслушайте реплику и ответьте." : "Разговор начинаете вы."}
      </div>

      {error && <div className="vp-error">{error}</div>}
      <button type="button" className="vp-btn" disabled={busy || (isDrill ? !moment : !client)} onClick={begin}>
        {busy ? "Готовим консультацию…" : "Перейти к звонку"}
      </button>
      <p className="vp-small">
        Учебного клиента играет ИИ. Разговор не записывается, сохраняется только расшифровка — её видите вы и куратор.
      </p>
    </div>
  );
}
