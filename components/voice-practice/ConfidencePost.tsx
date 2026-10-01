"use client";

import { useState } from "react";
import { ConfidenceSliders, isConfidenceComplete, type ConfidenceDraft } from "./ConfidenceSliders";
import "./voice-practice.css";

// Уверенность «после» на экране итога: необязательно, не чаще раза в день.
export function ConfidencePost({ programSlug, sessionId }: { programSlug: string; sessionId: string }) {
  const [value, setValue] = useState<ConfidenceDraft>({});
  const [state, setState] = useState<"open" | "busy" | "done" | "later">("open");
  const [error, setError] = useState<string | null>(null);

  if (state === "later") return null;
  if (state === "done") {
    return <div className="vp-card vp-hint">Записали. Сравнение «было → сейчас» — в разделе «Моя практика».</div>;
  }

  async function save() {
    if (!isConfidenceComplete(value)) return;
    setState("busy");
    setError(null);
    const r = await fetch("/api/practice/self-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programSlug, reports: [{ kind: "confidence_post", answers: value, sessionId }] }),
    }).catch(() => null);
    if (r?.ok) {
      setState("done");
      return;
    }
    const data = (await r?.json().catch(() => null)) as { error?: string } | null;
    setState("open");
    setError(data?.error ?? "Не удалось сохранить. Попробуйте ещё раз.");
  }

  const complete = isConfidenceComplete(value);
  return (
    <section style={{ marginTop: 20 }}>
      <p className="vp-kicker">Уверенность сейчас</p>
      <p className="vp-hint" style={{ margin: "0 0 12px" }}>
        Необязательно. Раз в день — чтобы видеть, как меняется ваше ощущение.
      </p>
      <ConfidenceSliders value={value} onChange={setValue} />
      {error && <div className="vp-error">{error}</div>}
      <button type="button" className="vp-btn" disabled={!complete || state === "busy"} onClick={save}>
        {state === "busy" ? "Сохраняем…" : "Сохранить"}
      </button>
      <div className="vp-actions-row">
        <button type="button" className="vp-link" disabled={state === "busy"} onClick={() => setState("later")}>
          Позже
        </button>
      </div>
    </section>
  );
}
