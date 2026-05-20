"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AnketaProgramSlug,
  AnketaQuestion,
} from "@/lib/anketa/questions";
import type {
  IdentityFacts,
  IdentityQuestionId,
} from "@/lib/personalization";

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const initialAnswers = useMemo(() => {
    const answers = {} as AnswersMap;
    for (const q of questions) {
      answers[q.id] = initialFacts[q.id]?.trim() ?? "";
    }
    return answers;
  }, [questions, initialFacts]);

  const [answers, setAnswers] = useState<AnswersMap>(initialAnswers);
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Префетчим хаб заранее — Skip/финальная кнопка отрабатывают мгновенно,
  // юзер не успевает повторно нажать пока сервер собирает страницу.
  useEffect(() => {
    router.prefetch(`/program/${slug}/hub`);
  }, [router, slug]);

  const total = questions.length;
  const isLastStep = currentStep === total - 1;
  const currentQ = questions[currentStep];
  const currentValue = answers[currentQ.id] ?? "";
  const hasOptions = (currentQ.options?.length ?? 0) > 0;

  const hasAnyAnswer = Object.values(answers).some(
    (text) => typeof text === "string" && text.trim().length > 0,
  );
  const currentStepHasAnswer = currentValue.trim().length > 0;
  const progressPct = ((currentStep + 1) / total) * 100;

  // Autofocus при заходе и при смене шага — поле всегда готово принять ввод.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [currentStep]);

  const onPickChip = (label: string) => {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: label }));
    const el = textareaRef.current;
    if (el) {
      el.focus({ preventScroll: true });
      // курсор в конец вставленного текста — сразу можно дописывать
      requestAnimationFrame(() => {
        el.setSelectionRange(label.length, label.length);
      });
    }
  };

  const onChangeOpen = (text: string) => {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: text }));
  };

  const onSkip = () => {
    if (skipping) return;
    setSkipping(true);
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
        <button
          type="button"
          className="anketa-skip"
          onClick={onSkip}
          disabled={skipping}
        >
          {skipping ? "Перехожу…" : "Пропустить →"}
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

          {hasOptions && (
            <div className="anketa-field-label">Напиши своими словами</div>
          )}
          <textarea
            ref={textareaRef}
            className="anketa-textarea"
            placeholder={currentQ.placeholder}
            value={currentValue}
            onChange={(e) => onChangeOpen(e.target.value)}
          />

          {hasOptions && (
            <>
              <div className="anketa-chips-label">Или выбери что ближе всего</div>
              <div className="anketa-chips">
                {currentQ.options?.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`anketa-chip ${
                      currentValue.trim() === opt.label ? "selected" : ""
                    }`}
                    onClick={() => onPickChip(opt.label)}
                  >
                    {opt.chipLabel ?? opt.label}
                  </button>
                ))}
              </div>
            </>
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
