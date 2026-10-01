"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ANKETA_QUESTIONS, MAX_ANSWER_LENGTH } from "@/lib/voice-practice/self-report";
import { ConfidenceSliders, isConfidenceComplete, type ConfidenceDraft } from "./ConfidenceSliders";
import "./voice-practice.css";

const HOW_IT_WORKS = [
  "Клиента играет ИИ — голосом, как на настоящей встрече.",
  "Голос не хранится, сохраняется только расшифровка. Её видите вы и куратор.",
  "Остановиться можно в любой момент.",
  "После каждой встречи — разбор: что получилось и что попробовать.",
];

type Step = "how" | 0 | 1 | 2 | "confidence";
const ORDER: Step[] = ["how", 0, 1, 2, "confidence"];

// Первый вход в практикум: как это устроено → три вопроса → уверенность «до».
export function IntroFlow({ programSlug }: { programSlug: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("how");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<Record<string, boolean>>({});
  const [confidence, setConfidence] = useState<ConfidenceDraft>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = (d: 1 | -1) => {
    setError(null);
    setStep(ORDER[ORDER.indexOf(step) + d]);
    window.scrollTo({ top: 0 });
  };

  async function save(withConfidence: boolean) {
    setBusy(true);
    setError(null);
    const reports: { kind: string; answers: unknown }[] = [{ kind: "anketa", answers }];
    if (withConfidence && isConfidenceComplete(confidence)) reports.push({ kind: "confidence_pre", answers: confidence });
    const r = await fetch("/api/practice/self-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programSlug, reports }),
    }).catch(() => null);
    if (r?.ok) {
      router.replace(`/program/${programSlug}/hub`);
      router.refresh();
      return;
    }
    const data = (await r?.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    setError(data?.error ?? "Не удалось сохранить. Проверьте связь и попробуйте ещё раз.");
  }

  if (step === "how") {
    return (
      <div className="vp-screen">
        <p className="vp-kicker">Практикум учебных консультаций</p>
        <h1 className="vp-title">Как это устроено</h1>
        <ol className="vp-card vp-list">
          {HOW_IT_WORKS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
        <p className="vp-lead">Дальше — три коротких вопроса, чтобы подсказать, с чего начать.</p>
        <button type="button" className="vp-btn" onClick={() => go(1)}>
          Понятно, дальше
        </button>
      </div>
    );
  }

  if (step === "confidence") {
    return (
      <div className="vp-screen">
        <p className="vp-kicker">Точка отсчёта</p>
        <h1 className="vp-title">Насколько это про вас сейчас?</h1>
        <p className="vp-lead">Это не оценка, а точка отсчёта. Через несколько консультаций сравним.</p>
        <ConfidenceSliders value={confidence} onChange={setConfidence} />
        {error && <div className="vp-error">{error}</div>}
        <button type="button" className="vp-btn" disabled={busy || !isConfidenceComplete(confidence)} onClick={() => save(true)}>
          {busy ? "Сохраняем…" : "Сохранить и перейти к практике"}
        </button>
        {!isConfidenceComplete(confidence) && <p className="vp-small">Отметьте все три утверждения.</p>}
        <div className="vp-actions-row">
          <button type="button" className="vp-link" disabled={busy} onClick={() => go(-1)}>
            Назад
          </button>
          <button type="button" className="vp-link" disabled={busy} onClick={() => save(false)}>
            Пропустить этот шаг
          </button>
        </div>
      </div>
    );
  }

  const q = ANKETA_QUESTIONS[step];
  const value = answers[q.key] ?? "";
  const isCustom = custom[q.key] ?? false;
  const setValue = (v: string, asCustom: boolean) => {
    setAnswers({ ...answers, [q.key]: v });
    setCustom({ ...custom, [q.key]: asCustom });
  };

  return (
    <div className="vp-screen">
      <p className="vp-kicker">Вопрос {step + 1} из 3</p>
      <h1 className="vp-title">{q.title}</h1>
      <div className="vp-chips" role="radiogroup" aria-label={q.title}>
        {q.options.map((o) => (
          <button
            key={o.text}
            type="button"
            role="radio"
            aria-checked={!isCustom && value === o.text}
            className="vp-card vp-chip"
            onClick={() => setValue(o.text, false)}
          >
            {o.text}
          </button>
        ))}
      </div>
      <textarea
        className="vp-input"
        rows={2}
        maxLength={MAX_ANSWER_LENGTH}
        placeholder={q.placeholder}
        value={isCustom ? value : ""}
        onChange={(e) => setValue(e.currentTarget.value, true)}
      />
      <button type="button" className="vp-btn" disabled={!value.trim()} onClick={() => go(1)}>
        Дальше
      </button>
      <div className="vp-actions-row">
        <button type="button" className="vp-link" onClick={() => go(-1)}>
          Назад
        </button>
      </div>
    </div>
  );
}
