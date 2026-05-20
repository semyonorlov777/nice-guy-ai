"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionScreen } from "./QuestionScreen";
import {
  createSession,
  getNextSeedQuestion,
  loadSession,
  saveSession,
} from "@mini/funnel/lib/session";
import { SEED_QUESTIONS } from "@mini/funnel/lib/seed-questions";
import {
  MAX_QUESTIONS,
  type FunnelAnswer,
  type FunnelQuestion,
  type FunnelSession,
  type NextQuestionResponse,
} from "@mini/funnel/lib/types";

const ESTIMATED_TOTAL = 17;

export function TestFlow() {
  const router = useRouter();
  const [session, setSession] = useState<FunnelSession | null>(null);
  const [loadingNext, setLoadingNext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    const existing = loadSession();
    const s = existing ?? createSession();
    if (s.status === "ready" && s.result) {
      router.replace("/funnel/result");
      return;
    }
    if (s.answers.length >= MAX_QUESTIONS) {
      router.replace("/funnel/result");
      return;
    }
    if (!s.currentQuestion && s.answers.length < SEED_QUESTIONS.length) {
      s.currentQuestion = getNextSeedQuestion(s.answers.length);
    }
    saveSession(s);
    setSession(s);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    if (session.currentQuestion) return;
    if (session.answers.length >= MAX_QUESTIONS) {
      router.replace("/funnel/result");
      return;
    }
    if (session.answers.length < SEED_QUESTIONS.length) {
      const next = getNextSeedQuestion(session.answers.length);
      if (next) {
        const updated: FunnelSession = { ...session, currentQuestion: next };
        saveSession(updated);
        setSession(updated);
      }
      return;
    }
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoadingNext(true);
    setError(null);
    void fetchNextQuestion(session)
      .then((res) => {
        if (res.isFinal || !res.question) {
          router.replace("/funnel/result");
          return;
        }
        setSession((prev) => {
          if (!prev) return prev;
          const updated: FunnelSession = {
            ...prev,
            currentQuestion: res.question,
          };
          saveSession(updated);
          return updated;
        });
      })
      .catch((err) => {
        console.error("[TestFlow] next-question failed:", err);
        setError("Что-то пошло не так. Попробуйте ещё раз через секунду.");
      })
      .finally(() => {
        fetchingRef.current = false;
        setLoadingNext(false);
      });
  }, [session, router]);

  const handleAnswer = (answerText: string, answerValue?: number) => {
    if (!session?.currentQuestion) return;
    const q = session.currentQuestion;
    const answer: FunnelAnswer = {
      questionId: q.id,
      questionText: q.text,
      questionType: q.type,
      answerText,
      answerValue,
    };
    const updated: FunnelSession = {
      ...session,
      answers: [...session.answers, answer],
      currentQuestion: null,
    };
    saveSession(updated);
    setSession(updated);
  };

  const handleRetry = () => {
    setError(null);
    setSession((prev) => (prev ? { ...prev } : prev));
  };

  if (!session) {
    return (
      <div className="funnel-screen funnel-loading-screen">
        <div className="funnel-loading-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="funnel-screen funnel-loading-screen">
        <p className="funnel-error-text">{error}</p>
        <button className="funnel-btn-primary" onClick={handleRetry}>
          Повторить
        </button>
      </div>
    );
  }

  if (!session.currentQuestion) {
    return (
      <div className="funnel-screen funnel-loading-screen">
        <div className="funnel-loading-spinner" />
        <p className="funnel-loading-text">
          {loadingNext
            ? "Готовлю следующий вопрос…"
            : "Минутку…"}
        </p>
      </div>
    );
  }

  return (
    <QuestionScreen
      question={session.currentQuestion}
      questionIndex={session.answers.length}
      estimatedTotal={ESTIMATED_TOTAL}
      disabled={loadingNext}
      onAnswer={handleAnswer}
    />
  );
}

async function fetchNextQuestion(
  session: FunnelSession,
): Promise<NextQuestionResponse> {
  const response = await fetch("/api/funnel/next-question", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers: session.answers }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = (await response.json()) as NextQuestionResponse | {
    question?: FunnelQuestion | null;
    isFinal?: boolean;
  };
  return {
    question: data.question ?? null,
    isFinal: Boolean(data.isFinal),
  };
}
