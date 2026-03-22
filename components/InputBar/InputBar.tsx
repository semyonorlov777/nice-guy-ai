"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useInputBar } from "./useInputBar";
import { useVoiceInput } from "@/hooks/useVoiceInput";

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

/* ── Helpers ── */

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ── Pointer constants ── */
const HOLD_THRESHOLD = 200; // ms
const SWIPE_UP_PX = 40;
const SWIPE_LEFT_PX = 60;

const InputBar = forwardRef<InputBarHandle, InputBarProps>(function InputBar(
  { mode = "chat", placeholder, disabled, onSend, footer, externalSentTrigger },
  ref
) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    actionState,
    setActionState,
    errorMessage,
    errorFading,
    setIdle,
    setTyping,
    setSent,
    setError,
    dismissError,
  } = useInputBar();

  const hasVoice = true;

  // ── Voice input (always called — React rules of hooks) ──
  const voiceInput = useVoiceInput({
    lang: "ru-RU",
    maxDuration: 3600,
    onTranscript: (text: string) => {
      onSend(text);
      setSent();
    },
    paidFallbackEnabled: true,
  });

  // ── Sync voiceInput.state → actionState ──
  useEffect(() => {
    if (!hasVoice) return;

    switch (voiceInput.state) {
      case "recording":
        setActionState("recording");
        break;
      case "locked":
        setActionState("locked");
        break;
      case "processing":
        // НЕ менять actionState — кнопка остаётся 64px locked.
        // useVoiceInput сам вызовет onTranscript → setSent()
        break;
      case "error":
        if (voiceInput.error) {
          setError(voiceInput.error);
        }
        break;
      case "idle":
        // Только если мы были в recording/locked — значит голос завершился
        if (actionState === "recording" || actionState === "locked") {
          setActionState("idle");
        }
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceInput.state, voiceInput.error, hasVoice]);

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
        if (actionState === "locked") {
          voiceInput.stopRecording();
          return;
        }
        handleSend();
      }
    },
    [actionState, handleSend, voiceInput]
  );

  // ── Pointer event refs ──
  const ptrIdRef = useRef<number | null>(null);
  const ptrStartYRef = useRef(0);
  const ptrStartXRef = useRef(0);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingRef = useRef(false);
  const btnDownTimeRef = useRef(0);
  const lastPointerTypeRef = useRef<string>("mouse");

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  // Cleanup hold timer on unmount
  useEffect(() => clearHoldTimer, [clearHoldTimer]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;

      lastPointerTypeRef.current = e.pointerType;
      ptrIdRef.current = e.pointerId;
      ptrStartYRef.current = e.clientY;
      ptrStartXRef.current = e.clientX;
      btnDownTimeRef.current = Date.now();
      isHoldingRef.current = false;

      // Capture pointer for swipe tracking
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      // typing → send text
      if (actionState === "typing") {
        handleSend();
        return;
      }

      // locked → stop recording
      if (actionState === "locked") {
        voiceInput.stopRecording();
        return;
      }

      // idle + voice
      if (actionState === "idle" && hasVoice) {
        if (e.pointerType === "mouse") {
          // Desktop: click = hands-free (immediate lock)
          voiceInput.startRecording();
          voiceInput.lockRecording();
        } else if (e.pointerType === "touch") {
          // Touch: start hold timer
          holdTimerRef.current = setTimeout(() => {
            isHoldingRef.current = true;
            voiceInput.startRecording();
          }, HOLD_THRESHOLD);
        }
      }
    },
    [disabled, actionState, hasVoice, handleSend, voiceInput, clearHoldTimer]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (ptrIdRef.current !== e.pointerId) return;

      const dy = ptrStartYRef.current - e.clientY; // positive = swipe up
      const dx = ptrStartXRef.current - e.clientX; // positive = swipe left

      // Swipe up → lock
      if (actionState === "recording" && dy > SWIPE_UP_PX) {
        voiceInput.lockRecording();
      }

      // Swipe left → cancel
      if ((actionState === "recording" || actionState === "locked") && dx > SWIPE_LEFT_PX) {
        clearHoldTimer();
        voiceInput.cancelRecording();
      }
    },
    [actionState, voiceInput, clearHoldTimer]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (ptrIdRef.current !== e.pointerId) return;
      ptrIdRef.current = null;

      clearHoldTimer();
      const elapsed = Date.now() - btnDownTimeRef.current;

      // Touch: tap < threshold → hands-free
      if (actionState === "idle" && hasVoice && e.pointerType === "touch" && elapsed < HOLD_THRESHOLD) {
        voiceInput.startRecording();
        voiceInput.lockRecording();
        return;
      }

      // Touch: hold release in recording → send (push-to-talk)
      if (actionState === "recording" && e.pointerType === "touch" && isHoldingRef.current) {
        voiceInput.stopRecording();
        return;
      }

      isHoldingRef.current = false;
    },
    [actionState, hasVoice, voiceInput, clearHoldTimer]
  );

  // ── Waveform bars ──
  const isRecording = actionState === "recording" || actionState === "locked";
  // Fake waveform ref — regenerated each second only while recording
  const fakeWaveRef = useRef<number[]>([]);
  const prevDurationRef = useRef(-1);

  const waveformBars = useMemo(() => {
    if (!isRecording) return [];
    if (voiceInput.waveformData.length > 0) {
      return voiceInput.waveformData.map((v: number) => Math.max(4, v * 24));
    }
    // Fake waveform for web-speech — regenerate each second
    if (prevDurationRef.current !== voiceInput.duration) {
      prevDurationRef.current = voiceInput.duration;
      fakeWaveRef.current = Array.from({ length: 32 }, () => 4 + Math.random() * 16);
    }
    return fakeWaveRef.current.length > 0 ? fakeWaveRef.current : Array.from({ length: 32 }, () => 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, voiceInput.waveformData, voiceInput.duration]);

  // Button CSS class
  const btnClass = [
    "ib-action-btn",
    actionState === "typing" && "s-typing",
    actionState === "recording" && "s-recording",
    actionState === "locked" && "s-locked",
    actionState === "sent" && "s-sent",
    actionState === "error" && "s-error",
  ]
    .filter(Boolean)
    .join(" ");

  // Container classes
  const containerClass = [
    "input-bar",
    actionState === "recording" && "recording",
    actionState === "locked" && "locked",
    disabled && "disabled",
    errorMessage && "has-error",
  ]
    .filter(Boolean)
    .join(" ");

  // Button aria-label
  const btnAriaLabel =
    actionState === "typing"
      ? "Отправить сообщение"
      : actionState === "recording" || actionState === "locked"
        ? "Остановить запись"
        : hasVoice
          ? "Голосовой ввод"
          : "Отправить";

  return (
    <div>
      <div
        className={containerClass}
        data-mode={mode}
        role="group"
      >
        {/* The pill-shaped container that looks like one input field */}
        <div className="input-container">
          {/* Textarea — transparent, no border */}
          <textarea
            ref={textareaRef}
            className="input-textarea"
            rows={1}
            placeholder={placeholder || DEFAULT_PLACEHOLDERS[mode]}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            aria-label="Введите сообщение"
          />

          {/* RecBar — replaces textarea during recording/locked */}
          <div className="ib-rec-bar" role="status" aria-live="polite">
            <div className="ib-rec-dot" aria-hidden="true" />
            <span className="ib-rec-timer">
              {formatDuration(voiceInput.duration)}
            </span>
            <div className="ib-rec-wave" aria-hidden="true">
              {waveformBars.map((h, i) => (
                <div key={i} className="ib-rec-wave-bar" style={{ height: `${h}px` }} />
              ))}
            </div>
            {actionState === "recording" && (
              <span className="ib-rec-swipe-hint">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                свайп
              </span>
            )}
            <span
              className="ib-rec-cancel"
              onClick={() => voiceInput.cancelRecording()}
              role="button"
              tabIndex={0}
            >
              Отмена
            </span>
          </div>

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

          {/* LockHint — swipe up to lock (touch only, recording state) */}
          {actionState === "recording" && lastPointerTypeRef.current === "touch" && (
            <div className="ib-lock-hint" aria-hidden="true">
              <svg className="ib-lock-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
              <svg className="ib-lock-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
          )}

          {/* Action button — INSIDE the pill container */}
          <button
            className={btnClass}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            aria-label={btnAriaLabel}
            type="button"
            disabled={disabled}
          >
            {/* Mic icon — only for chat/exercise */}
            {hasVoice && (
              <span className="ib-ico ib-ico-mic">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </span>
            )}

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

            {/* Stop icon — recording/locked */}
            <span className="ib-ico ib-ico-stop">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
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
      </div>

      {/* Footer */}
      {footer && <div className="ib-footer">{footer}</div>}
    </div>
  );
});

export default InputBar;
