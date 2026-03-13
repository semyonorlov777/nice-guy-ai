"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ISSPQuestion } from "@/lib/issp-config";

const QUICK_LABELS = ["Не про меня", "Скорее нет", "Иногда", "Часто", "Полностью"];

type StatusMessage = "analyzing" | "recorded" | "slow" | "fallback" | "fallback_timeout" | null;

interface QuestionScreenProps {
  question: ISSPQuestion;
  questionIndex: number;
  totalQuestions: number;
  scaleName: string;
  isLocked: boolean;
  selectedScore: number | null;
  animationClass: "enter" | "exit" | null;
  transitioning: boolean;
  statusMessage: StatusMessage;
  fallbackActive: boolean;
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
  onQuickAnswer,
  onTextAnswer,
}: QuestionScreenProps) {
  const [textInput, setTextInput] = useState("");
  const [actionState, setActionState] = useState<"mic" | "typing" | "sent">("mic");
  const [flashBtn, setFlashBtn] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentBlock = Math.floor(questionIndex / 5);
  const questionInBlock = (questionIndex % 5) + 1;

  // Reset textarea when question changes
  useEffect(() => {
    setTextInput("");
    setActionState("mic");
    setFlashBtn(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "";
      textareaRef.current.style.overflow = "hidden";
    }
  }, [questionIndex]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTextInput(val);
    setActionState(val.trim() ? "typing" : "mic");

    // Auto-resize
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.overflow = "hidden";
    const newH = Math.min(ta.scrollHeight, 140);
    ta.style.height = newH + "px";
    if (ta.scrollHeight > 140) ta.style.overflow = "auto";
  }, []);

  const handleSend = useCallback(() => {
    if (!textInput.trim() || isLocked || transitioning) return;
    setActionState("sent");
    onTextAnswer(textInput.trim());
    // Text stays visible in textarea until question transition
  }, [textInput, isLocked, transitioning, onTextAnswer]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && textInput.trim()) {
      e.preventDefault();
      handleSend();
    }
  }, [textInput, handleSend]);

  const handleQuickClick = useCallback((score: number) => {
    if (isLocked || transitioning) return;

    // Flash animation
    setFlashBtn(score);
    setTimeout(() => {
      setFlashBtn(null);
      onQuickAnswer(score);
    }, 120);
  }, [isLocked, transitioning, onQuickAnswer]);

  const actionBtnClass = `tc-action-btn${actionState === "typing" ? " typing" : ""}${actionState === "sent" ? " sent" : ""}`;

  return (
    <div className="tc-screen tc-test-screen">
      {/* Header with progress */}
      <div className="tc-header">
        <div className="tc-progress-info">
          <strong>{questionIndex + 1}</strong> из {totalQuestions}
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

      {/* Question area */}
      <div className="tc-question-area">
        <div className="tc-scale-label">{scaleName}</div>
        <div className={`tc-question-text${animationClass ? ` ${animationClass}` : ""}`}>
          {question.text}
        </div>
        <div className="tc-question-timeframe">Вспомните последние 2–4 недели</div>
      </div>

      {/* Input area */}
      <div className={`tc-input-area${isLocked ? " locked" : ""}`}>
        <div className="tc-text-input-wrap">
          <textarea
            ref={textareaRef}
            className="tc-text-input"
            rows={1}
            placeholder="Расскажите своими словами…"
            value={textInput}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={isLocked || fallbackActive}
          />
          <button
            className={actionBtnClass}
            onClick={handleSend}
            disabled={actionState === "mic" || isLocked}
          >
            <svg className="tc-ico tc-ico-mic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            <svg className="tc-ico tc-ico-send" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            <svg className="tc-ico tc-ico-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>

        {/* Status line */}
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

        <div className="tc-divider-or"><span>или быстрый ответ</span></div>
        <div className="tc-quick-buttons">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              className={`tc-quick-btn${selectedScore === score ? " selected" : ""}${flashBtn === score ? " flash" : ""}${fallbackActive ? " highlight" : ""}`}
              onClick={() => handleQuickClick(score)}
              disabled={isLocked && !fallbackActive}
            >
              <span className="tc-qb-label">{QUICK_LABELS[score - 1]}</span>
            </button>
          ))}
        </div>

        {/* Fallback hint */}
        {(statusMessage === "fallback" || statusMessage === "fallback_timeout") && (
          <div className="tc-fallback-hint visible">
            {statusMessage === "fallback_timeout"
              ? "Сервер не ответил. Ближе к какому из вариантов?"
              : "Ближе к какому из вариантов?"}
          </div>
        )}
      </div>
    </div>
  );
}
