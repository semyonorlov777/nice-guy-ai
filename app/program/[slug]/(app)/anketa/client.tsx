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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAnyAnswer = Object.values(answers).some(
    (text) => typeof text === "string" && text.trim().length > 0,
  );

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
        <div className="anketa-meta">{questions.length} вопроса · ~2 минуты</div>
        <h1 className="anketa-title">Расскажи о себе</h1>
        <button type="button" className="anketa-skip" onClick={onSkip}>
          Пропустить →
        </button>
      </header>

      <div className="anketa-body">
        {questions.map((q, index) => {
          const value = answers[q.id] ?? "";
          const isHybrid = q.type === "hybrid";
          const otherActive = isHybrid && selected[q.id] === "other";
          return (
            <section className="anketa-q" key={q.id}>
              <div className="anketa-q-eyebrow">
                Вопрос {index + 1} из {questions.length}
              </div>
              <h2 className="anketa-q-title">{q.title}</h2>
              {q.help && <p className="anketa-q-help">{q.help}</p>}

              {isHybrid ? (
                <>
                  <div className="anketa-options">
                    {q.options?.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`anketa-option ${
                          selected[q.id] === opt.value ? "selected" : ""
                        }`}
                        onClick={() => onPickOption(q, opt.value, opt.label)}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`anketa-option anketa-option-other ${
                        otherActive ? "selected" : ""
                      }`}
                      onClick={() => onPickOther(q)}
                    >
                      Другое (напишу сам)
                    </button>
                  </div>
                  {otherActive && (
                    <textarea
                      className="anketa-textarea"
                      placeholder={q.placeholder}
                      value={value}
                      onChange={(e) => onChangeOpen(q, e.target.value)}
                    />
                  )}
                </>
              ) : (
                <textarea
                  className="anketa-textarea"
                  placeholder={q.placeholder}
                  value={value}
                  onChange={(e) => onChangeOpen(q, e.target.value)}
                />
              )}
            </section>
          );
        })}
      </div>

      <footer className="anketa-footer">
        {error && <div className="anketa-error">{error}</div>}
        <button
          type="button"
          className="anketa-submit"
          disabled={submitting || !hasAnyAnswer}
          onClick={onSubmit}
        >
          {submitting ? "Сохраняю…" : "Сохранить и перейти к программе"}
        </button>
      </footer>
    </div>
  );
}
