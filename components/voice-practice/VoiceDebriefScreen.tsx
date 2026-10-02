"use client";

// Голосовой разбор после встречи — «как в учебной тройке». Сначала пауза «роли сняты» и кнопка
// (iPhone даёт звук и микрофон только по нажатию), потом три голоса по очереди: вы о себе →
// клиент уже не в роли → наблюдатель (что сработало, одна правка, фраза вслух, ваш вывод, итог).
// Кто говорит — по сообщениям сервера: handover (слово переходит), speaker (голос зазвучал).
// В конце — запись разбора текстом на странице итога.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import type { DebriefSpeaker, ServerMessage } from "@/lib/voice-practice/protocol";
import { VoiceOrb, LOST_TEXT, NOMIC_TEXT, REPEAT_TEXT } from "./VoiceOrb";
import "./voice-practice.css";

type Seat = "student" | DebriefSpeaker;

export function VoiceDebriefScreen(props: {
  programSlug: string;
  parentId: string;
  client: { name: string; gen: string; dat: string; female: boolean };
  resumable: boolean;
  /** Клиент во встрече выходил из роли — его голоса в разборе нет. */
  skipClient: boolean;
}) {
  const { client, parentId, programSlug } = props;
  const router = useRouter();
  const resultHref = `/program/${programSlug}/voice/session/${parentId}`;
  const [started, setStarted] = useState(false);
  const [speaker, setSpeaker] = useState<DebriefSpeaker | null>(null);
  const [segment, setSegment] = useState(1);
  const [pending, setPending] = useState<DebriefSpeaker | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onEnded = useCallback(() => router.replace(resultHref), [router, resultHref]);
  const onMessage = useCallback((m: ServerMessage) => {
    if (m.t === "handover") setPending(m.to);
    if (m.t === "speaker") {
      setSpeaker(m.who);
      setSegment(m.segment);
      setPending(null);
    }
  }, []);
  const voice = useVoiceSession("", onEnded, { halfDuplex: true, onMessage });
  const { state } = voice;

  // Текстовый разбор встречи начинает считаться сразу (голоса опираются на него) — пока студент читает экран.
  useEffect(() => {
    void fetch(`/api/practice/sessions/${parentId}`, { cache: "no-store" }).catch(() => undefined);
  }, [parentId]);

  /** Вызывается из нажатия: звук и микрофон открываются внутри жеста (iOS). */
  async function begin() {
    setStarted(true);
    setNotice(null);
    const [ok, r] = await Promise.all([
      voice.prepare(),
      fetch(`/api/practice/sessions/${parentId}/debrief`, { method: "POST" }).catch(() => null),
    ]);
    const d = (await r?.json().catch(() => null)) as { sessionId?: string; ticket?: string; error?: string; code?: string } | null;
    if (!r?.ok || !d?.sessionId || !d.ticket) {
      voice.release();
      if (d?.code === "done") return router.replace(resultHref);
      setStarted(false);
      setNotice(d?.error ?? "Нет связи. Попробуйте ещё раз или прочитайте разбор текстом.");
      return;
    }
    if (!ok) return;
    await voice.connect({ sessionId: d.sessionId, ticket: d.ticket });
  }

  const { phase } = state;
  const aiTalking = state.playing || state.speaking === "client";
  const active: Seat | null = !started
    ? null
    : state.speaking === "student"
      ? "student"
      : aiTalking && speaker
        ? speaker
        : pending ?? (speaker && !aiTalking ? "student" : null);

  const status = !started
    ? null
    : phase === "connecting"
      ? "Соединяем…"
      : phase === "reconnecting" || (phase === "live" && state.link === "lost")
        ? LOST_TEXT
        : phase === "paused"
          ? "Разбор на паузе."
          : phase === "ending"
            ? "Завершаем…"
            : phase === "error"
              ? state.error
              : state.link === "nomic"
                ? NOMIC_TEXT
                : state.recovered === "repeat"
                  ? REPEAT_TEXT
                  : pending && !aiTalking
                    ? pending === "client"
                      ? `${client.name} выходит из роли…`
                      : "Слово переходит к наблюдателю…"
                    : aiTalking && speaker
                      ? speaker === "client"
                        ? `Говорит ${client.name} — уже не в роли`
                        : "Говорит наблюдатель"
                      : state.speaking === "student"
                        ? "Вы говорите"
                        : speaker
                          ? "Ваша очередь — ответьте вслух"
                          : "Наблюдатель начинает разбор…";

  const steps = props.skipClient
    ? ["Вы о себе", "Наблюдатель и ваш вывод"]
    : ["Вы о себе", `${client.name} вне роли`, "Наблюдатель и ваш вывод"];
  const stepIdx = props.skipClient ? (segment >= 3 ? 1 : 0) : segment - 1;
  const inCall = phase === "live" || phase === "reconnecting" || phase === "connecting";

  return (
    <div className="vp-call vp-troika">
      <div className="vp-call-head">
        <h1>{started ? "Разбор встречи" : "Встреча окончена"}</h1>
        <p>{started ? `${stepIdx + 1} из ${steps.length} · ${steps[stepIdx]}` : "Роли сняты"}</p>
      </div>

      <div className="vp-seats" aria-label="Участники разбора">
        <SeatView label="Вы" active={active === "student"} />
        {!props.skipClient && <SeatView label={client.name} note="вне роли" active={active === "client"} />}
        <SeatView label="Наблюдатель" active={active === "observer"} />
      </div>

      {started ? (
        <VoiceOrb speaking={inCall ? (aiTalking ? "client" : state.speaking) : "idle"} link={state.link} heard={state.heard} micLevel={voice.micLevel} />
      ) : (
        <div className="vp-troika-intro">
          <p className="vp-lead">
            Вы больше не психолог {client.gen}, а {client.name} — не {client.female ? "ваша клиентка" : "ваш клиент"}. Сделайте вдох и выдох.
          </p>
          <p className="vp-hint">
            Дальше — разбор, как в учебной тройке: сначала вы скажете, как вам было,
            {props.skipClient ? " потом" : ` потом ${client.name} — уже не в роли, потом`} наблюдатель. Три-четыре минуты, голосом.
          </p>
        </div>
      )}

      <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
        {status && (
          <div className="vp-status" role="status">
            {status}
          </div>
        )}
        {notice && <div className="vp-error">{notice}</div>}
      </div>

      <div className="vp-call-actions">
        {!started && (
          <button type="button" className="vp-btn" onClick={() => void begin()}>
            {props.resumable ? "Продолжить разбор" : "Начать разбор"}
          </button>
        )}
        {started && phase === "error" && (
          <button type="button" className="vp-btn" onClick={() => void begin()}>
            Попробовать ещё раз
          </button>
        )}
        {started && phase !== "ended" ? (
          <button type="button" className="vp-btn vp-btn-quiet" onClick={() => void voice.end()}>
            Завершить разбор
          </button>
        ) : null}
        {!started && (
          <Link className="vp-link" href={resultHref} style={{ textAlign: "center" }}>
            Прочитать разбор текстом
          </Link>
        )}
      </div>
    </div>
  );
}

function SeatView({ label, note, active }: { label: string; note?: string; active: boolean }) {
  return (
    <div className="vp-seat" data-active={active}>
      <span className="vp-seat-dot" aria-hidden />
      <span className="vp-seat-label">{label}</span>
      {note && <span className="vp-seat-note">{note}</span>}
    </div>
  );
}
