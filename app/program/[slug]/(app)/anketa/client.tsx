"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AnketaProgramSlug,
  AnketaQuestion,
} from "@/lib/anketa/questions";
import type {
  IdentityFacts,
  IdentityQuestionId,
} from "@/lib/personalization";

type SelectedMap = Record<IdentityQuestionId, string | "other" | null>;
type AnswersMap = Record<IdentityQuestionId, string>;

interface AnketaClientProps {
  slug: AnketaProgramSlug;
  questions: AnketaQuestion[];
  initialFacts: IdentityFacts;
}

export function AnketaClient({
  slug,
  questions,
  initialFacts,
}: AnketaClientProps) {
  const router = useRouter();

  const { initialAnswers, initialSelected } = useMemo(() => {
    const answers = {} as AnswersMap;
    const selected = {} as SelectedMap;
    for (const q of questions) {
      const fact = initialFacts[q.id]?.trim() ?? "";
      answers[q.id] = fact;
      if (q.type !== "hybrid") {
        selected[q.id] = null;
        continue;
      }
      const match = q.options?.find((opt) => opt.label === fact);
      if (match) {
        selected[q.id] = match.value;
      } else if (fact.length > 0) {
        selected[q.id] = "other";
      } else {
        selected[q.id] = null;
      }
    }
    return { initialAnswers: answers, initialSelected: selected };
  }, [questions, initialFacts]);

  const [answers, setAnswers] = useState<AnswersMap>(initialAnswers);
  const [selected, setSelected] = useState<SelectedMap>(initialSelected);
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = questions.length;
  const isLastStep = currentStep === total - 1;
  const currentQ = questions[currentStep];
  const currentValue = answers[currentQ.id] ?? "";
  const isHybrid = currentQ.type === "hybrid";
  const otherActive = isHybrid && selected[currentQ.id] === "other";

  const hasAnyAnswer = Object.values(answers).some(
    (text) => typeof text === "string" && text.trim().length > 0,
  );

  const currentStepHasAnswer = (() => {
    const trimmed = currentValue.trim();
    if (isHybrid) {
      const sel = selected[currentQ.id];
      if (sel !== null && sel !== "other") return true;
      return trimmed.length > 0;
    }
    return trimmed.length > 0;
  })();

  const progressPct = ((currentStep + 1) / total) * 100;

  const onPickOption = (q: AnketaQuestion, optValue: string, optLabel: string) => {
    setSelected((prev) => ({ ...prev, [q.id]: optValue }));
    setAnswers((prev) => ({ ...prev, [q.id]: optLabel }));
  };

  const onPickOther = (q: AnketaQuestion) => {
    setSelected((prev) => ({ ...prev, [q.id]: "other" }));
    // если предыдущий ответ был label опции — очищаем, чтобы пользователь написал своё.
    const prev = answers[q.id]?.trim() ?? "";
    const wasOptionLabel = q.options?.some((o) => o.label === prev);
    if (wasOptionLabel) {
      setAnswers((cur) => ({ ...cur, [q.id]: "" }));
    }
  };

  const onChangeOpen = (q: AnketaQuestion, text: string) => {
    setAnswers((prev) => ({ ...prev, [q.id]: text }));
  };

  const onSkip = () => {
    router.push(`/program/${slug}/hub`);
  };

  const onBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const onNext = () => {
    if (!currentStepHasAnswer) return;
    if (currentStep < total - 1) setCurrentStep((s) => s + 1);
  };

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, string> = {};
      for (const [qid, text] of Object.entries(answers)) {
        const trimmed = (text ?? "").trim();
        if (trimmed.length > 0) payload[qid] = trimmed;
      }
      const res = await fetch("/api/profile/anketa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programSlug: slug, answers: payload }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Не удалось сохранить ответы");
      }
      const data = (await res.json()) as { redirect?: string };
      router.push(data.redirect || `/program/${slug}/hub`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setSubmitting(false);
    }
  };

  return (
    <div className="anketa-page">
      <header className="anketa-header">
        <div className="anketa-meta">{total} вопроса · ~2 минуты</div>
        <h1 className="anketa-title">Расскажи о себе</h1>
        <button type="button" className="anketa-skip" onClick={onSkip}>
          Пропустить →
        </button>
        <div className="anketa-progress">
          <div className="anketa-progress-bar">
            <div
              className="anketa-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="anketa-progress-text">
            Вопрос {currentStep + 1} из {total}
          </div>
        </div>
      </header>

      <div className="anketa-body">
        <section className="anketa-q" key={currentQ.id}>
          <h2 className="anketa-q-title">{currentQ.title}</h2>
          {currentQ.help && <p className="anketa-q-help">{currentQ.help}</p>}

          {isHybrid ? (
            <>
              <div className="anketa-options">
                {currentQ.options?.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`anketa-option ${
                      selected[currentQ.id] === opt.value ? "selected" : ""
                    }`}
                    onClick={() => onPickOption(currentQ, opt.value, opt.label)}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`anketa-option anketa-option-other ${
                    otherActive ? "selected" : ""
                  }`}
                  onClick={() => onPickOther(currentQ)}
                >
                  Другое (напишу сам)
                </button>
              </div>
              {otherActive && (
                <textarea
                  className="anketa-textarea"
                  placeholder={currentQ.placeholder}
                  value={currentValue}
                  onChange={(e) => onChangeOpen(currentQ, e.target.value)}
                />
              )}
            </>
          ) : (
            <textarea
              className="anketa-textarea"
              placeholder={currentQ.placeholder}
              value={currentValue}
              onChange={(e) => onChangeOpen(currentQ, e.target.value)}
            />
          )}
        </section>
      </div>

      <footer className="anketa-footer">
        {error && <div className="anketa-error">{error}</div>}
        <div className="anketa-nav">
          {currentStep > 0 ? (
            <button type="button" className="anketa-back" onClick={onBack}>
              ← Назад
            </button>
          ) : (
            <span className="anketa-back-spacer" aria-hidden="true" />
          )}
          {isLastStep ? (
            <button
              type="button"
              className="anketa-next"
              disabled={submitting || !hasAnyAnswer}
              onClick={onSubmit}
            >
              {submitting ? "Сохраняю…" : "Сохранить и перейти"}
            </button>
          ) : (
            <button
              type="button"
              className="anketa-next"
              disabled={!currentStepHasAnswer}
              onClick={onNext}
            >
              Далее →
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
