"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import "./voice-practice.css";

function mmss(sec: number | null): string {
  if (sec === null) return "";
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function CallScreen(props: { programSlug: string; sessionId: string; clientName: string; resumable: boolean }) {
  const router = useRouter();
  const onEnded = useCallback(() => {
    router.replace(`/program/${props.programSlug}/voice/session/${props.sessionId}`);
  }, [router, props.programSlug, props.sessionId]);
  const { state, start, end } = useVoiceSession(props.sessionId, onEnded);
  const { phase } = state;

  const status =
    phase === "idle"
      ? props.resumable
        ? "Консультация прервалась. Нажмите «Продолжить» — клиент продолжит с того же места."
        : "Нажмите «Начать звонок»."
      : phase === "connecting"
        ? "Соединяем с учебным клиентом…"
        : phase === "reconnecting"
          ? "Восстанавливаем связь…"
          : phase === "paused"
            ? "Консультация на паузе."
            : phase === "ending"
              ? "Завершаем…"
              : phase === "error"
                ? state.error
                : state.clientSilent
                  ? "Клиент молчит. Повторите последнюю фразу."
                  : state.speaking === "client"
                    ? "Говорит клиент"
                    : state.speaking === "student"
                      ? "Вы говорите"
                      : "Слушает";

  const needsGesture = phase === "idle" || phase === "paused" || phase === "error";
  const inCall = phase === "live" || phase === "reconnecting" || phase === "connecting";

  return (
    <div className="vp-call">
      <div className="vp-call-head">
        <h1>{props.clientName}</h1>
        <p>учебный клиент</p>
      </div>

      <div className="vp-orb" data-speaking={inCall ? state.speaking : "idle"} aria-hidden />

      <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
        {inCall && (
          <div className="vp-timer" data-warn={state.warn}>
            {mmss(state.secondsLeft)}
          </div>
        )}
        <div className="vp-status" role="status">
          {status}
        </div>
      </div>

      <div className="vp-call-actions">
        {needsGesture && phase !== "error" && (
          <button type="button" className="vp-btn" onClick={() => void start()}>
            {phase === "paused" || props.resumable ? "Продолжить" : "Начать звонок"}
          </button>
        )}
        {phase === "error" && (
          <button type="button" className="vp-btn" onClick={() => void start()}>
            Попробовать ещё раз
          </button>
        )}
        {(inCall || phase === "paused" || phase === "error") && (
          <button type="button" className="vp-btn vp-btn-quiet" onClick={() => void end()}>
            Завершить
          </button>
        )}
      </div>
    </div>
  );
}
