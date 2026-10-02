"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import { VoiceOrb, LOST_TEXT, REPEAT_TEXT } from "./VoiceOrb";
import "./voice-practice.css";

function mmss(sec: number | null): string {
  if (sec === null) return "";
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function CallScreen(props: {
  programSlug: string;
  sessionId: string;
  clientName: string;
  resumable: boolean;
  /** «Трудный момент»: клиент начинает сам, после его реакции попытка заканчивается. */
  drill?: { title: string; context: string } | null;
}) {
  const router = useRouter();
  const onEnded = useCallback(() => {
    router.replace(`/program/${props.programSlug}/voice/session/${props.sessionId}`);
  }, [router, props.programSlug, props.sessionId]);
  const { state, start, end, micLevel } = useVoiceSession(props.sessionId, onEnded, { halfDuplex: !!props.drill });
  const { phase } = state;

  const status =
    phase === "idle" && props.drill
      ? "Клиент скажет одну трудную фразу. Дослушайте и ответьте так, как ответили бы живому человеку. После реакции клиента попытка закончится и откроется разбор."
      : phase === "idle"
      ? props.resumable
        ? "Консультация прервалась. Нажмите «Продолжить» — клиент продолжит с того же места."
        : "Нажмите «Начать звонок»."
      : phase === "connecting"
        ? "Соединяем с учебным клиентом…"
        : phase === "reconnecting" || (phase === "live" && state.link === "lost")
          ? LOST_TEXT
          : phase === "paused"
            ? "Консультация на паузе."
            : phase === "ending"
              ? "Завершаем…"
              : phase === "error"
                ? state.error
                : state.recovered === "repeat"
                  ? REPEAT_TEXT
                  : state.clientSilent
                  ? "Клиент молчит. Повторите последнюю фразу."
                  : state.speaking === "client"
                    ? "Говорит клиент"
                    : state.speaking === "student"
                      ? "Вы говорите"
                      : state.recovered === "ok"
                        ? "Связь восстановлена."
                        : props.drill && state.attemptDone
                        ? "Ответ засчитан. Можете продолжить разговор с клиентом или перейти к разбору."
                        : props.drill
                        ? "Ваш ответ"
                        : "Слушает";

  const needsGesture = phase === "idle" || phase === "paused" || phase === "error";
  const inCall = phase === "live" || phase === "reconnecting" || phase === "connecting";

  return (
    <div className="vp-call">
      <div className="vp-call-head">
        <h1>{props.clientName}</h1>
        <p>{props.drill ? `Трудный момент · ${props.drill.title}` : "учебный клиент"}</p>
        {props.drill && <p style={{ marginTop: 6, maxWidth: 320 }}>{props.drill.context}</p>}
      </div>

      <VoiceOrb speaking={inCall ? state.speaking : "idle"} link={state.link} heard={state.heard} micLevel={micLevel} />

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
          <button
            type="button"
            className={props.drill && state.attemptDone ? "vp-btn" : "vp-btn vp-btn-quiet"}
            onClick={() => void end()}
          >
            {props.drill && state.attemptDone ? "К разбору" : "Завершить"}
          </button>
        )}
      </div>
    </div>
  );
}
