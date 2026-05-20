"use client";

import { useEffect, useRef, useState } from "react";
import type { FunnelQuestion } from "@mini/funnel/lib/types";

const DEFAULT_SCALE_LABELS: [string, string, string, string, string] = [
  "Почти никогда",
  "Редко",
  "Иногда",
  "Часто",
  "Постоянно",
];

interface QuestionScreenProps {
  question: FunnelQuestion;
  questionIndex: number;
  estimatedTotal: number;
  disabled: boolean;
  onAnswer: (answerText: string, answerValue?: number) => void;
}

export function QuestionScreen({
  question,
  questionIndex,
  estimatedTotal,
  disabled,
  onAnswer,
}: QuestionScreenProps) {
  const [openText, setOpenText] = useState("");
  const [flashScore, setFlashScore] = useState<number | null>(null);
  const [flashChoice, setFlashChoice] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setOpenText("");
    setFlashScore(null);
    setFlashChoice(null);
    if (question.type === "open") {
      const t = setTimeout(() => textareaRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [question.id, question.type]);

  const progress = Math.min(
    ((questionIndex + 1) / estimatedTotal) * 100,
    100,
  );

  const handleScale = (score: number) => {
    if (disabled || flashScore !== null) return;
    const labels = question.scaleLabels ?? DEFAULT_SCALE_LABELS;
    setFlashScore(score);
    setTimeout(() => {
      onAnswer(labels[score - 1], score);
    }, 220);
  };

  const handleChoice = (index: number) => {
    if (disabled || flashChoice !== null) return;
    const opt = question.options?.[index];
    if (!opt) return;
    setFlashChoice(index);
    setTimeout(() => {
      onAnswer(opt);
    }, 220);
  };

  const handleOpenSubmit = () => {
    const trimmed = openText.trim();
    if (trimmed.length < 2 || disabled) return;
    onAnswer(trimmed);
  };

  return (
    <div className="funnel-screen funnel-question">
      <div className="funnel-progress-wrap">
        <div className="funnel-progress-info">
          Вопрос <strong>{questionIndex + 1}</strong>
          <span className="funnel-progress-of">
            {" из "}~{estimatedTotal}
          </span>
        </div>
        <div className="funnel-progress-bar">
          <div
            className="funnel-progress-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="funnel-question-area">
        <div className="funnel-question-text" key={question.id}>
          {question.text}
        </div>
        {question.hint && (
          <div className="funnel-question-hint">{question.hint}</div>
        )}
      </div>

      <div className={`funnel-input-area${disabled ? " disabled" : ""}`}>
        {question.type === "scale" && (
          <div className="funnel-scale-buttons">
            {[1, 2, 3, 4, 5].map((score) => {
              const labels = question.scaleLabels ?? DEFAULT_SCALE_LABELS;
              return (
                <button
                  key={score}
                  className={`funnel-scale-btn${flashScore === score ? " flash" : ""}`}
                  onClick={() => handleScale(score)}
                  disabled={disabled || flashScore !== null}
                >
                  <span className="funnel-scale-num">{score}</span>
                  <span className="funnel-scale-label">
                    {labels[score - 1]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {question.type === "choice" && question.options && (
          <div className="funnel-choice-buttons">
            {question.options.map((opt, i) => (
              <button
                key={`${question.id}-opt-${i}`}
                className={`funnel-choice-btn${flashChoice === i ? " flash" : ""}`}
                onClick={() => handleChoice(i)}
                disabled={disabled || flashChoice !== null}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {question.type === "open" && (
          <div className="funnel-open-wrap">
            <textarea
              ref={textareaRef}
              className="funnel-open-textarea"
              placeholder={question.placeholder ?? "Расскажите своими словами…"}
              value={openText}
              onChange={(e) => setOpenText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleOpenSubmit();
                }
              }}
              rows={5}
              disabled={disabled}
              maxLength={2000}
            />
            <div className="funnel-open-actions">
              <span className="funnel-open-hint">
                Чем больше расскажете — тем точнее разбор
              </span>
              <button
                className="funnel-btn-primary funnel-btn-compact"
                onClick={handleOpenSubmit}
                disabled={disabled || openText.trim().length < 2}
              >
                Дальше
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
