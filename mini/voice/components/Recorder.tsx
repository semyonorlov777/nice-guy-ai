"use client";

import { useState } from "react";
import { useVoiceRecorder } from "@mini/voice/lib/useVoiceRecorder";

interface RecorderProps {
  chatId: string;
  onMessageAdded: () => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Recorder({ chatId, onMessageAdded }: RecorderProps) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const recorder = useVoiceRecorder({
    onTranscript: async (text, dur) => {
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch(`/api/voice/chats/${chatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, audio_duration_sec: dur }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setSaveError(data.error ?? "Не удалось сохранить");
        } else {
          onMessageAdded();
        }
      } catch {
        setSaveError("Не удалось сохранить");
      } finally {
        setSaving(false);
      }
    },
  });

  const { state, backend, duration, interimText, waveformData, error, startRecording, stopRecording, cancelRecording } =
    recorder;

  if (!recorder.isSupported) {
    return (
      <div className="voice-recorder voice-recorder-unsupported">
        Запись в этом браузере не поддерживается. Открой Chrome или Edge.
      </div>
    );
  }

  const isRecording = state === "recording";
  const isProcessing = state === "processing" || saving;

  return (
    <div className={`voice-recorder ${isRecording ? "is-recording" : ""}`}>
      {error && <div className="voice-recorder-error">{error}</div>}
      {saveError && <div className="voice-recorder-error">{saveError}</div>}

      {isRecording && (
        <div className="voice-recorder-status">
          <div className="voice-recorder-waveform">
            {waveformData.length > 0
              ? waveformData.map((amp, i) => (
                  <span
                    key={i}
                    className="voice-recorder-bar"
                    style={{ transform: `scaleY(${Math.max(0.1, amp * 3)})` }}
                  />
                ))
              : Array.from({ length: 20 }).map((_, i) => <span key={i} className="voice-recorder-bar" />)}
          </div>
          <div className="voice-recorder-meta">
            <span className="voice-recorder-time">{formatDuration(duration)}</span>
            <span className="voice-recorder-backend">
              {backend === "web-speech" ? "распознавание в браузере" : "запись → транскрипция"}
            </span>
          </div>
          {interimText && <div className="voice-recorder-interim">{interimText}</div>}
        </div>
      )}

      <div className="voice-recorder-controls">
        {!isRecording ? (
          <button
            type="button"
            className="voice-record-btn"
            onClick={startRecording}
            disabled={isProcessing}
            aria-label="Записать голосовое"
          >
            <span className="voice-record-icon" aria-hidden="true" />
            <span className="voice-record-label">
              {isProcessing ? "Сохраняю…" : "Записать голосовое"}
            </span>
          </button>
        ) : (
          <>
            <button
              type="button"
              className="voice-stop-btn"
              onClick={stopRecording}
              aria-label="Остановить и расшифровать"
            >
              <span className="voice-stop-icon" aria-hidden="true" />
              <span>Готово</span>
            </button>
            <button type="button" className="voice-cancel-btn" onClick={cancelRecording} aria-label="Отменить">
              Отмена
            </button>
          </>
        )}
      </div>
    </div>
  );
}
