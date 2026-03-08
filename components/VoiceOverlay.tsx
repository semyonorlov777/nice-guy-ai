"use client";

import { useRef, useCallback } from "react";
import type { UseVoiceInputReturn } from "@/hooks/useVoiceInput";

interface VoiceOverlayProps {
  voiceInput: UseVoiceInputReturn;
  onCancel: () => void;
}

const SWIPE_CANCEL_THRESHOLD = 60; // px

export function VoiceOverlay({ voiceInput, onCancel }: VoiceOverlayProps) {
  const { state, backend, duration, interimText, waveformData, isNearLimit, isPaidBackend } =
    voiceInput;

  const touchStartX = useRef(0);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.touches[0].clientX - touchStartX.current;
      if (dx < -SWIPE_CANCEL_THRESHOLD) {
        onCancel();
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(30);
      }
    },
    [onCancel]
  );

  if (state !== "recording" && state !== "locked" && state !== "processing") {
    return null;
  }

  if (state === "processing") {
    return (
      <div className="voice-overlay">
        <span className="voice-processing-text">Распознаю речь...</span>
      </div>
    );
  }

  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div
      className="voice-overlay"
      ref={overlayRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <button
        className="voice-cancel"
        onClick={onCancel}
        type="button"
        aria-label="Отменить запись"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M2.646 2.646a.5.5 0 0 1 .708 0L7 6.293l3.646-3.647a.5.5 0 0 1 .708.708L7.707 7l3.647 3.646a.5.5 0 0 1-.708.708L7 7.707l-3.646 3.647a.5.5 0 0 1-.708-.708L6.293 7 2.646 3.354a.5.5 0 0 1 0-.708z" />
        </svg>
      </button>

      <span className="voice-rec-dot" />

      <span className={`voice-timer${isNearLimit ? " near-limit" : ""}`}>
        {timeStr}
      </span>

      {backend === "web-speech" && interimText ? (
        <span className="voice-interim">{interimText}</span>
      ) : backend === "media-recorder" ? (
        <Waveform data={waveformData} />
      ) : null}

      {isPaidBackend && (
        <span className="voice-mode-indicator">платное</span>
      )}
    </div>
  );
}

function Waveform({ data }: { data: number[] }) {
  const bars = data.length > 0 ? data.slice(-20) : new Array(20).fill(0.05);
  return (
    <svg width={80} height={24} className="voice-waveform" aria-hidden="true">
      {bars.map((v, i) => (
        <rect
          key={i}
          x={i * 4}
          y={12 - v * 10}
          width={2}
          height={Math.max(2, v * 20)}
          rx={1}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
