"use client";

import { useRef, useCallback } from "react";
import type { UseVoiceInputReturn } from "@/hooks/useVoiceInput";

interface VoiceButtonProps {
  voiceInput: UseVoiceInputReturn;
  hasText: boolean;
  isStreaming: boolean;
  disabled?: boolean;
  highlight?: boolean;
  onSend: () => void;
}

export function VoiceButton({
  voiceInput,
  hasText,
  isStreaming,
  disabled = false,
  highlight = false,
  onSend,
}: VoiceButtonProps) {
  const startY = useRef(0);
  const didLock = useRef(false);

  const { state, isSupported, startRecording, stopRecording, lockRecording } =
    voiceInput;

  // All hooks MUST be before any conditional returns (Rules of Hooks)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      startY.current = e.clientY;
      didLock.current = false;
      startRecording();
    },
    [startRecording]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (didLock.current) return;
      const dy = startY.current - e.clientY;
      if (dy > 40) {
        didLock.current = true;
        lockRecording();
      }
    },
    [lockRecording]
  );

  // --- If voice not supported, always show send button ---
  if (!isSupported) {
    return (
      <button
        className={`send-btn${highlight ? " send-highlight" : ""}`}
        onClick={onSend}
        disabled={isStreaming || !hasText || disabled}
      >
        {"↑"}
      </button>
    );
  }

  // --- Send button when there's text and idle ---
  if (hasText && state === "idle") {
    return (
      <button
        className={`send-btn${highlight ? " send-highlight" : ""}`}
        onClick={onSend}
        disabled={isStreaming || disabled}
      >
        {"↑"}
      </button>
    );
  }

  // --- Processing state ---
  if (state === "processing") {
    return (
      <button className="voice-btn processing" disabled>
        <svg width="16" height="16" viewBox="0 0 16 16" className="voice-spinner">
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="28"
            strokeDashoffset="8"
          />
        </svg>
      </button>
    );
  }

  // --- Locked state — show stop button ---
  if (state === "locked") {
    return (
      <button
        className="voice-btn locked"
        onClick={stopRecording}
      >
        <svg width="14" height="14" viewBox="0 0 14 14">
          <rect x="1" y="1" width="12" height="12" rx="2" fill="currentColor" />
        </svg>
      </button>
    );
  }

  // --- Recording state (push-to-talk, finger held) ---
  if (state === "recording") {
    return (
      <div className="voice-btn-wrap">
        <div className="voice-lock-target" data-active={!didLock.current ? "true" : undefined}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M7 1a3 3 0 0 0-3 3v2H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H5V4a2 2 0 1 1 4 0v1h2V4a3 3 0 0 0-4-3z" />
          </svg>
        </div>
        <button
          className="voice-btn recording"
          onPointerUp={(e) => {
            e.preventDefault();
            if (!didLock.current) {
              stopRecording();
            }
            didLock.current = false;
          }}
        >
          <MicIcon />
        </button>
      </div>
    );
  }

  // --- Idle state, no text — show mic button ---
  return (
    <button
      className="voice-btn"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      disabled={isStreaming || disabled}
    >
      <MicIcon />
    </button>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a2 2 0 0 0-2 2v4a2 2 0 1 0 4 0V3a2 2 0 0 0-2-2z" />
      <path d="M3.5 6.5a.5.5 0 0 1 1 0A3.5 3.5 0 1 0 11.5 6.5a.5.5 0 0 1 1 0 4.5 4.5 0 0 1-4 4.473V13.5h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2v-2.527a4.5 4.5 0 0 1-4-4.473z" />
    </svg>
  );
}
