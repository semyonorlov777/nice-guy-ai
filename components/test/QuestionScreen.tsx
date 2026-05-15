"use client";

import { useState, useEffect, useCallback } from "react";
import type { TestQuestion } from "@/lib/test-config";
import InputBar from "@/components/InputBar/InputBar";

const DEFAULT_QUICK_LABELS = [
  "Совсем нет",
  "Скорее нет",
  "Иногда",
  "Скорее да",
  "Полностью",
];

type StatusMessage = "analyzing" | "recorded" | "slow" | "fallback" | "fallback_timeout" | null;

interface QuestionScreenProps {
  question: TestQuestion;
  questionIndex: number;
  totalQuestions: number;
  scaleName: string;
  isLocked: boolean;
  selectedScore: number | null;
  animationClass: "enter" | "exit" | null;
  transitioning: boolean;
  statusMessage: StatusMessage;
  fallbackActive: boolean;
  quickAnswerLabels?: string[];
  onQuickAnswer: (score: number) => void;
  onTextAnswer: (text: string) => void;
}

export function QuestionScreen({
  question,
  questionIndex,
  totalQuestions,
  scaleName,
  isLocked,
  selectedScore,
  animationClass,
  transitioning,
  statusMessage,
  fallbackActive,
  quickAnswerLabels,
  onQuickAnswer,
  onTextAnswer,
}: QuestionScreenProps) {
  const [flashBtn, setFlashBtn] = useState<number | null>(null);
  const [sentTrigger, setSentTrigger] = useState(0);

  const labels = quickAnswerLabels && quickAnswerLabels.length === 5
    ? quickAnswerLabels
    : DEFAULT_QUICK_LABELS;

  const currentBlock = Math.floor(questionIndex / 5);
  const questionInBlock = (questionIndex % 5) + 1;

  useEffect(() => {
    setFlashBtn(null);
    setSentTrigger(0);
  }, [questionIndex]);

  const handleQuickClick = useCallback((score: number) => {
    if (isLocked || transitioning) return;

    setFlashBtn(score);
    setTimeout(() => {
      setFlashBtn(null);
      onQuickAnswer(score);
      setSentTrigger(prev => prev + 1);
    }, 120);
  }, [isLocked, transitioning, onQuickAnswer]);

  return (
    <div className="tc-screen tc-test-screen">
      <div className="tc-header">
        <div className="tc-progress-info">
          Вопрос <strong>{questionIndex + 1}</strong> из {totalQuestions}
        </div>
        <div className="tc-progress-segments">
          {Array.from({ length: 7 }, (_, i) => (
            <div className="tc-progress-seg" key={i}>
              <div
                className="tc-progress-seg-fill"
                style={{
                  width:
                    i < currentBlock
                      ? "100%"
                      : i === currentBlock
                        ? `${(questionInBlock / 5) * 100}%`
                        : "0%",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="tc-question-area">
        <div className="tc-scale-label">{scaleName}</div>
        <div className="tc-ask-pill">Насколько это про вас?</div>
        <div className={`tc-question-text tc-question-quoted${animationClass ? ` ${animationClass}` : ""}`}>
          {question.text}
        </div>
        <div className="tc-question-timeframe">Вспомните последние 2–4 недели</div>
      </div>

      <div className={`tc-input-area${isLocked ? " locked" : ""}`}>
        <div className="tc-pick-label">Выберите вариант</div>
        <div className="tc-quick-buttons tc-quick-buttons-large">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              className={`tc-quick-btn${selectedScore === score ? " selected" : ""}${flashBtn === score ? " flash" : ""}${fallbackActive ? " highlight" : ""}`}
              onClick={() => handleQuickClick(score)}
              disabled={isLocked && !fallbackActive}
            >
              <span className="tc-qb-num">{score}</span>
              <span className="tc-qb-label">{labels[score - 1]}</span>
            </button>
          ))}
        </div>

        {(statusMessage === "fallback" || statusMessage === "fallback_timeout") && (
          <div className="tc-fallback-hint visible">
            {statusMessage === "fallback_timeout"
              ? "Сервер не ответил. Ближе к какому из вариантов?"
              : "Ближе к какому из вариантов?"}
          </div>
        )}

        <div className="tc-secondary-input-wrap">
          <div className="tc-secondary-hint">при желании добавьте словами</div>
          <InputBar
            key={questionIndex}
            mode="test"
            placeholder="опишите подробнее…"
            disabled={isLocked || fallbackActive}
            onSend={(text: string) => onTextAnswer(text)}
            externalSentTrigger={sentTrigger}
          />

          <div className="tc-status-line">
            {statusMessage === "analyzing" && (
              <span className="tc-status-text visible">Анализирую ответ...</span>
            )}
            {statusMessage === "recorded" && (
              <span className="tc-status-text visible success">Ответ записан ✓</span>
            )}
            {statusMessage === "slow" && (
              <span className="tc-status-text visible">Долгая обработка...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
