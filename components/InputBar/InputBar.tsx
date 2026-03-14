"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useInputBar } from "./useInputBar";

export type InputBarMode = "chat" | "exercise" | "test";

export interface InputBarProps {
  mode?: InputBarMode;
  placeholder?: string;
  disabled?: boolean;
  onSend: (text: string) => void;
  footer?: React.ReactNode;
  externalSentTrigger?: number;
}

export interface InputBarHandle {
  triggerSent: () => void;
  focus: () => void;
  showError: (message: string) => void;
}

const DEFAULT_PLACEHOLDERS: Record<InputBarMode, string> = {
  chat: "Сообщение…",
  exercise: "Расскажите своими словами…",
  test: "Ваш ответ…",
};

const InputBar = forwardRef<InputBarHandle, InputBarProps>(function InputBar(
  { mode = "chat", placeholder, disabled, onSend, footer, externalSentTrigger },
  ref
) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    actionState,
    errorMessage,
    errorFading,
    setIdle,
    setTyping,
    setSent,
    setError,
    dismissError,
  } = useInputBar();

  // Expose imperative handle
  useImperativeHandle(ref, () => ({
    triggerSent: () => setSent(),
    focus: () => textareaRef.current?.focus(),
    showError: (msg: string) => setError(msg),
  }), [setSent, setError]);

  // External sent trigger
  const prevTrigger = useRef(externalSentTrigger);
  useEffect(() => {
    if (
      externalSentTrigger !== undefined &&
      prevTrigger.current !== undefined &&
      externalSentTrigger !== prevTrigger.current
    ) {
      setSent();
    }
    prevTrigger.current = externalSentTrigger;
  }, [externalSentTrigger, setSent]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.overflowY = "hidden";
    const newH = Math.min(ta.scrollHeight, 140);
    ta.style.height = newH + "px";
    if (ta.scrollHeight > 140) {
      ta.style.overflowY = "auto";
    }
  }, []);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setText(val);
      if (val.trim()) {
        setTyping();
      } else {
        setIdle();
      }
      resizeTextarea();
    },
    [setTyping, setIdle, resizeTextarea]
  );

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    setSent();
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.overflowY = "hidden";
    }
  }, [text, onSend, setSent]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleActionClick = useCallback(() => {
    if (actionState === "typing") {
      handleSend();
    }
  }, [actionState, handleSend]);

  // Button CSS class
  const btnClass = [
    "ib-action-btn",
    actionState === "typing" && "s-typing",
    actionState === "sent" && "s-sent",
    actionState === "error" && "s-error",
  ]
    .filter(Boolean)
    .join(" ");

  // Container classes
  const containerClass = [
    "input-bar",
    disabled && "disabled",
    errorMessage && "has-error",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <div
        className={containerClass}
        data-mode={mode}
        role="group"
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          className="ib-textarea"
          rows={1}
          placeholder={placeholder || DEFAULT_PLACEHOLDERS[mode]}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label="Введите сообщение"
        />

        {/* Error bar */}
        <div
          className={`ib-error-bar${errorFading ? " fading" : ""}`}
          role="alert"
        >
          <svg
            className="ib-error-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="ib-error-text">{errorMessage}</span>
          <button
            className="ib-error-dismiss"
            onClick={dismissError}
            aria-label="Закрыть ошибку"
            type="button"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Action button */}
        <button
          className={btnClass}
          onClick={handleActionClick}
          aria-label={
            actionState === "typing"
              ? "Отправить сообщение"
              : "Отправить"
          }
          type="button"
          disabled={disabled}
        >
          {/* Send arrow icon */}
          <span className="ib-ico ib-ico-send">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </span>

          {/* Check icon */}
          <span className="ib-ico ib-ico-check">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        </button>
      </div>

      {/* Footer */}
      {footer && <div className="ib-footer">{footer}</div>}
    </div>
  );
});

export default InputBar;
