"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useWarmupRecorder, type WarmupRecording } from "@/hooks/useWarmupRecorder";
import "./voice-practice.css";

type Reaction = "warm" | "neutral" | "cold";

interface Attempt {
  n: number;
  transcript: string;
  reaction: Reaction;
  got: string;
  try: string;
  firstWordMs: number | null;
  flags: { reflection: boolean; openQ: boolean; why: boolean; advice: boolean };
}

type Phase = "intro" | "ready" | "playing" | "recording" | "sending" | "result" | "silent" | "offline" | "mic" | "summary";

const SEND_TIMEOUT_MS = 25_000;
/** Меньше полсекунды голоса — ответа не было: в тишине модель «слышит» несказанные фразы. */
const MIN_VOICED_MS = 500;
/** Ответ «без долгой паузы» — первое слово раньше трёх секунд после реплики. */
const QUICK_START_MS = 3000;
const RANK: Record<Reaction, number> = { cold: 0, neutral: 1, warm: 2 };

function reactionText(r: Reaction, name: string): string {
  return r === "warm" ? `${name} потеплела` : r === "cold" ? `${name} закрылась` : `${name} ответила ровно`;
}

function seconds(ms: number): string {
  return (ms / 1000).toFixed(1).replace(".", ",");
}

export function WarmupScreen(props: {
  programSlug: string;
  setId: string;
  lineNumbers: number[];
  clientName: string;
  audioBase: string;
}) {
  const { clientName, lineNumbers } = props;
  const audioRef = useRef<HTMLAudioElement>(null);
  const playingRef = useRef<"line" | "reaction" | null>(null);
  const rec = useWarmupRecorder();
  const [phase, setPhase] = useState<Phase>("intro");
  const [idx, setIdx] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [current, setCurrent] = useState<(Attempt & { lineText?: string }) | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [clientTalking, setClientTalking] = useState(false);
  /** Записанный ответ, который не удалось отправить, — для «Отправить ещё раз». */
  const [pending, setPending] = useState<WarmupRecording | null>(null);
  const n = lineNumbers[idx];

  const play = useCallback(
    (kind: "line" | Reaction, lineN: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      playingRef.current = kind === "line" ? "line" : "reaction";
      audio.src = `${props.audioBase}/${lineN}-${kind}.mp3`;
      // Вызов play() внутри нажатия разблокирует элемент на iOS; дальше он играет и без жеста.
      void audio.play().catch(() => {
        // Звук не пошёл (редко на iOS после сворачивания) — просим нажать ещё раз.
        playingRef.current = null;
        // Реплика не прозвучала — просим нажать ещё раз; реакция не прозвучала — сразу к разбору.
        setPhase(kind === "line" ? "ready" : "result");
      });
    },
    [props.audioBase],
  );

  const send = useCallback(
    async (recording: WarmupRecording, lineN: number) => {
      setPhase("sending");
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setPhase("offline");
        return;
      }
      const form = new FormData();
      const ext = recording.mimeType.includes("mp4") ? "m4a" : recording.mimeType.includes("ogg") ? "ogg" : "webm";
      form.append("audio", recording.blob, `answer.${ext}`);
      form.append("programSlug", props.programSlug);
      form.append("set", props.setId);
      form.append("n", String(lineN));
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), SEND_TIMEOUT_MS);
      const r = await fetch("/api/practice/warmup/answer", { method: "POST", body: form, signal: ctrl.signal }).catch(() => null);
      clearTimeout(t);
      const data = (await r?.json().catch(() => null)) as
        | (Partial<Attempt> & { speech?: boolean; lineText?: string; error?: string })
        | null;
      if (!r || r.status >= 500 || !data) {
        setPhase("offline");
        return;
      }
      if (!r.ok) {
        setNotice(r.status === 401 ? "Вход истёк. Обновите страницу и войдите снова." : (data.error ?? "Не удалось оценить ответ"));
        setPhase("offline");
        return;
      }
      if (!data.speech) {
        setPhase("silent");
        return;
      }
      const attempt: Attempt = {
        n: lineN,
        transcript: data.transcript ?? "",
        reaction: (data.reaction as Reaction) ?? "neutral",
        got: data.got ?? "",
        try: data.try ?? "",
        firstWordMs: recording.firstWordMs,
        flags: data.flags ?? { reflection: false, openQ: false, why: false, advice: false },
      };
      setPending(null);
      setAttempts((a) => [...a, attempt]);
      setCurrent({ ...attempt, lineText: data.lineText });
      // Сначала клиент реагирует голосом, карточка разбора — после реакции.
      setPhase("playing");
      play(attempt.reaction, lineN);
    },
    [play, props.programSlug, props.setId],
  );

  const onAudioEnded = useCallback(async () => {
    const what = playingRef.current;
    playingRef.current = null;
    if (what === "reaction") {
      setPhase("result");
      return;
    }
    if (what !== "line") return;
    setPhase("recording");
    try {
      const recording = await rec.record();
      if (recording.firstWordMs == null || recording.voicedMs < MIN_VOICED_MS) {
        setPhase("silent");
        return;
      }
      setPending(recording);
      await send(recording, n);
    } catch {
      setPhase("mic");
    }
  }, [rec, send, n]);

  /** «Начать»: доступ к микрофону (жест), затем «Слушать». */
  async function begin() {
    setNotice(null);
    try {
      await rec.prepare();
      setPhase("ready");
    } catch {
      setPhase("mic");
    }
  }

  function listen(lineIdx: number) {
    setNotice(null);
    setPending(null);
    setCurrent(null);
    setIdx(lineIdx);
    setPhase("playing");
    play("line", lineNumbers[lineIdx]);
    void rec.prepare().catch(() => setPhase("mic"));
  }

  function next() {
    if (idx + 1 < lineNumbers.length) listen(idx + 1);
    else {
      audioRef.current?.pause();
      rec.release();
      setPhase("summary");
    }
  }

  function restart() {
    setAttempts([]);
    setCurrent(null);
    setIdx(0);
    setPhase("intro");
  }

  const orbState = clientTalking ? "client" : phase === "recording" && rec.speaking ? "student" : undefined;

  return (
    <div className="vp-screen">
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        onPlaying={() => setClientTalking(true)}
        onPause={() => setClientTalking(false)}
        onEnded={() => {
          setClientTalking(false);
          void onAudioEnded();
        }}
      />
      <p className="vp-kicker">
        Первые слова · {clientName}
        {phase !== "intro" && phase !== "summary" && phase !== "mic" ? ` · реплика ${idx + 1} из ${lineNumbers.length}` : ""}
      </p>

      {phase === "intro" && (
        <>
          <h1 className="vp-title">Первые слова</h1>
          <div className="vp-card vp-hint">
            Клиент скажет одну фразу. Ответьте так, как ответили бы живому человеку. Это не экзамен, а разминка, чтобы слова
            включались.
          </div>
          <div className="vp-card vp-hint">
            Несколько коротких реплик, около трёх минут. Отвечайте, когда клиент договорит: запись начнётся сама и
            остановится, когда вы замолчите. Ответ не сохраняется — только оценивается.
          </div>
          <button type="button" className="vp-btn" onClick={begin}>
            Начать
          </button>
          <p className="vp-small">Понадобится микрофон. Учебного клиента играет ИИ, голос записан заранее.</p>
        </>
      )}

      {phase === "mic" && (
        <>
          <div className="vp-error">
            Нет доступа к микрофону. Разрешите его в настройках браузера для этого сайта и попробуйте ещё раз.
          </div>
          <button type="button" className="vp-btn" onClick={begin}>
            Попробовать ещё раз
          </button>
        </>
      )}

      {(phase === "ready" || phase === "playing" || phase === "recording" || phase === "sending") && (
        <div className="vp-warmup">
          <div className="vp-orb" data-speaking={orbState} style={phase === "recording" ? { transform: `scale(${0.96 + rec.level * 0.1})` } : undefined} />
          <p className="vp-status">
            {phase === "ready"
              ? `Нажмите «Слушать» — ${clientName} скажет фразу. Отвечайте, когда она договорит.`
              : phase === "playing"
                ? `Говорит ${clientName}`
                : phase === "recording"
                  ? rec.speaking
                    ? "Вы говорите"
                    : "Ваш ответ"
                  : `${clientName} слушает…`}
          </p>
          {phase === "ready" && (
            <button type="button" className="vp-btn" onClick={() => listen(idx)}>
              Слушать
            </button>
          )}
          {phase === "recording" && (
            <button type="button" className="vp-btn vp-btn-quiet" onClick={rec.stop}>
              Готово
            </button>
          )}
        </div>
      )}

      {phase === "silent" && (
        <>
          <div className="vp-card vp-hint">Ответ не прозвучал. Ничего страшного — попробуйте ещё раз, можно начать с простого.</div>
          <button type="button" className="vp-btn" onClick={() => listen(idx)}>
            Ещё раз
          </button>
        </>
      )}

      {phase === "offline" && (
        <>
          <div className="vp-error">{notice ?? "Нет связи. Ответ не оценён, попробуйте ещё раз."}</div>
          {pending && (
            <button type="button" className="vp-btn" onClick={() => send(pending, n)}>
              Отправить ответ ещё раз
            </button>
          )}
          <button type="button" className={pending ? "vp-btn vp-btn-quiet vp-gap" : "vp-btn"} onClick={() => listen(idx)}>
            Ответить заново
          </button>
        </>
      )}

      {phase === "result" && current && (
        <>
          <div className="vp-card">
            <p className="vp-reaction" data-reaction={current.reaction}>
              {reactionText(current.reaction, clientName)}
            </p>
            {current.lineText && (
              <p className="vp-small vp-left">
                {clientName}: «{current.lineText}»
              </p>
            )}
            <p className="vp-quote vp-quote-was">Вы: «{current.transcript}»</p>
            <div className="vp-row vp-row-stack">
              <span className="vp-ok">Получилось</span>
              <span>{current.got}</span>
            </div>
            <div className="vp-row vp-row-stack">
              <span className="vp-warn">Попробуйте</span>
              <span>{current.try}</span>
            </div>
            {current.firstWordMs != null && (
              <p className="vp-small vp-left">Вы начали отвечать через {seconds(current.firstWordMs)} с.</p>
            )}
          </div>
          <button type="button" className="vp-btn" onClick={() => listen(idx)}>
            Ещё раз
          </button>
          <button type="button" className="vp-btn vp-btn-quiet vp-gap" onClick={next}>
            {idx + 1 < lineNumbers.length ? "Дальше" : "Итог"}
          </button>
        </>
      )}

      {phase === "summary" && <WarmupSummary attempts={attempts} clientName={clientName} programSlug={props.programSlug} onRestart={restart} />}
    </div>
  );
}

function WarmupSummary(props: { attempts: Attempt[]; clientName: string; programSlug: string; onRestart: () => void }) {
  const { attempts, clientName } = props;
  const quick = attempts.filter((a) => a.firstWordMs != null && a.firstWordMs <= QUICK_START_MS).length;
  const good = attempts.filter((a) => a.flags.reflection || a.flags.openQ).length;
  const bad = attempts.filter((a) => a.flags.why || a.flags.advice).length;

  // «Было → стало»: реплика с повтором и самым большим сдвигом; без повторов — первая и последняя попытки серии.
  let was: Attempt | undefined;
  let now: Attempt | undefined;
  let best = -Infinity;
  for (const lineN of new Set(attempts.map((a) => a.n))) {
    const tries = attempts.filter((a) => a.n === lineN);
    if (tries.length < 2) continue;
    const shift = RANK[tries[tries.length - 1].reaction] - RANK[tries[0].reaction];
    if (shift > best) {
      best = shift;
      was = tries[0];
      now = tries[tries.length - 1];
    }
  }
  const sameLine = !!was;
  if (!was && attempts.length >= 2) {
    was = attempts[0];
    now = attempts[attempts.length - 1];
  }

  return (
    <>
      <h1 className="vp-title">Итог разминки</h1>
      <div className="vp-card">
        <div className="vp-row">
          <span>Ответили без долгой паузы</span>
          <span>
            {quick} из {attempts.length}
          </span>
        </div>
        <div className="vp-row">
          <span>Отражений и открытых вопросов</span>
          <span>{good}</span>
        </div>
        <div className="vp-row">
          <span>«Почему», советов и оценок</span>
          <span>{bad}</span>
        </div>
      </div>

      {was && now && (
        <div className="vp-card">
          <p className="vp-kicker">{sameLine ? `Было → стало, реплика ${was.n}` : "Было → стало"}</p>
          <p className="vp-quote vp-quote-was">
            «{was.transcript}» — {reactionText(was.reaction, clientName)}
          </p>
          <p className="vp-quote">
            «{now.transcript}» — {reactionText(now.reaction, clientName)}
          </p>
        </div>
      )}

      <button type="button" className="vp-btn" onClick={props.onRestart}>
        Пройти ещё раз
      </button>
      <Link href={`/program/${props.programSlug}/hub`} className="vp-btn vp-btn-quiet vp-gap">
        На главную
      </Link>
    </>
  );
}
