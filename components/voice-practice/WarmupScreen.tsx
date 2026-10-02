"use client";

// «Первые слова»: серия коротких живых попыток. Каждая попытка — своя сессия на движке звонка
// (kind=drill): клиент сам говорит реплику, студент отвечает, клиент живо реагирует, сервер
// закрывает попытку. Микрофон и звук открываются один раз (нажатие «Начать») и живут всю серию.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import "./voice-practice.css";

type Reaction = "warm" | "neutral" | "cold";

interface Attempt {
  n: number;
  transcript: string;
  reaction: Reaction;
  firstWordMs: number | null;
  flags: { reflection: boolean; openQ: boolean; why: boolean; advice: boolean };
}

interface Card {
  loading: boolean;
  speech?: boolean;
  transcript?: string;
  clientReply?: string;
  lineText?: string;
  reaction?: Reaction;
  got?: string;
  try?: string;
  cardFailed?: boolean;
  firstWordMs: number | null;
}

type Phase = "intro" | "call" | "result" | "summary";

/** Ответ «без долгой паузы» — первое слово раньше трёх секунд после реплики. */
const QUICK_START_MS = 3000;
const RANK: Record<Reaction, number> = { cold: 0, neutral: 1, warm: 2 };

function reactionText(r: Reaction, name: string): string {
  return r === "warm" ? `${name} потеплела` : r === "cold" ? `${name} закрылась` : `${name} ответила ровно`;
}

function seconds(ms: number): string {
  return (ms / 1000).toFixed(1).replace(".", ",");
}

type Created = { ok: true; sessionId: string; ticket: string } | { ok: false; error: string };

/** Новая попытка — новая сессия. Прошлая не успела закрыться (обрыв, сворачивание) — закрываем и пробуем снова. */
async function createSession(body: { programSlug: string; modeKey: string; momentId: string }, retry = true): Promise<Created> {
  const r = await fetch("/api/practice/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const d = (await r?.json().catch(() => null)) as { sessionId?: string; ticket?: string; error?: string; activeSessionId?: string } | null;
  if (r?.ok && d?.sessionId && d.ticket) return { ok: true, sessionId: d.sessionId, ticket: d.ticket };
  if (r?.status === 409 && d?.activeSessionId && retry) {
    await fetch(`/api/practice/sessions/${d.activeSessionId}/finish`, { method: "POST" }).catch(() => undefined);
    return createSession(body, false);
  }
  if (r?.status === 401) return { ok: false, error: "Вход истёк. Обновите страницу и войдите снова." };
  return { ok: false, error: d?.error ?? "Нет связи. Попробуйте ещё раз." };
}

export function WarmupScreen(props: { programSlug: string; modeKey: string; momentIds: string[]; clientName: string }) {
  const { clientName, momentIds } = props;
  const [phase, setPhase] = useState<Phase>("intro");
  const [idx, setIdx] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [card, setCard] = useState<Card | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Клиент уже сказал реплику в этой попытке — дальше ждём ответа студента. */
  const [heard, setHeard] = useState(false);
  const sessionRef = useRef<string | null>(null);
  /** Попытка идёт на сервере — при уходе со страницы её надо закрыть. */
  const liveRef = useRef(false);
  const heardRef = useRef(false);
  const idxRef = useRef(0);
  /** Конец последней реплики клиента и первый голос студента после неё — для «начали отвечать через». */
  const timingRef = useRef<{ lineEnd: number | null; voiceAt: number | null }>({ lineEnd: null, voiceAt: null });

  const onVoice = useCallback(() => {
    const t = timingRef.current;
    if (t.lineEnd != null && t.voiceAt == null) t.voiceAt = Date.now();
  }, []);

  const onEnded = useCallback(async () => {
    liveRef.current = false;
    const sessionId = sessionRef.current;
    const t = timingRef.current;
    const firstWordMs = t.lineEnd != null && t.voiceAt != null ? t.voiceAt - t.lineEnd : null;
    setPhase("result");
    setCard({ loading: true, firstWordMs });
    if (!sessionId) return setCard({ loading: false, speech: false, firstWordMs });
    const r = await fetch("/api/practice/warmup/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => null);
    const d = (await r?.json().catch(() => null)) as (Omit<Card, "loading" | "firstWordMs"> & { flags?: Attempt["flags"] }) | null;
    if (sessionRef.current !== sessionId) return;
    if (!r?.ok || !d) return setCard({ loading: false, speech: true, cardFailed: true, firstWordMs });
    setCard({ ...d, loading: false, firstWordMs });
    if (d.speech && d.reaction) {
      const attempt: Attempt = {
        n: idxRef.current + 1,
        transcript: d.transcript ?? "",
        reaction: d.reaction,
        firstWordMs,
        flags: d.flags ?? { reflection: false, openQ: false, why: false, advice: false },
      };
      setAttempts((a) => [...a, attempt]);
    }
  }, []);

  // Реплика клиента доиграла — от этого момента считаем паузу до ответа.
  const onPlaying = useCallback((playing: boolean) => {
    if (!liveRef.current) return;
    const t = timingRef.current;
    if (playing) {
      heardRef.current = true;
      setHeard(true);
    } else if (heardRef.current && t.voiceAt == null) t.lineEnd = Date.now();
  }, []);

  const voice = useVoiceSession("", onEnded, { halfDuplex: true, keepAudio: true, onVoice, onPlaying });
  const { state } = voice;

  // Ушли со страницы посреди попытки — закрыть сессию, иначе она займёт место следующего звонка.
  useEffect(
    () => () => {
      if (liveRef.current && sessionRef.current) navigator.sendBeacon(`/api/practice/sessions/${sessionRef.current}/finish`);
    },
    [],
  );

  /** Вызывается из нажатия: микрофон и звук открываются внутри жеста (iOS). */
  async function beginAttempt(i: number) {
    idxRef.current = i;
    sessionRef.current = null;
    timingRef.current = { lineEnd: null, voiceAt: null };
    setIdx(i);
    setCard(null);
    setNotice(null);
    setHeard(false);
    heardRef.current = false;
    setPhase("call");
    const [ok, created] = await Promise.all([voice.prepare(), createSession({ programSlug: props.programSlug, modeKey: props.modeKey, momentId: momentIds[i] })]);
    if (!created.ok) {
      setNotice(created.error);
      return;
    }
    if (!ok) {
      await fetch(`/api/practice/sessions/${created.sessionId}/finish`, { method: "POST" }).catch(() => undefined);
      return;
    }
    sessionRef.current = created.sessionId;
    liveRef.current = true;
    await voice.connect({ sessionId: created.sessionId, ticket: created.ticket });
  }

  function next() {
    if (idx + 1 < momentIds.length) void beginAttempt(idx + 1);
    else {
      voice.release();
      setPhase("summary");
    }
  }

  function restart() {
    setAttempts([]);
    setCard(null);
    setIdx(0);
    setPhase("intro");
  }

  const clientTalking = state.playing || state.speaking === "client";
  const callStatus =
    state.phase === "connecting"
      ? `Соединяем… ${clientName} сейчас скажет фразу.`
      : state.phase === "reconnecting"
        ? "Восстанавливаем связь…"
        : state.phase === "paused"
          ? "Разминка на паузе."
          : state.phase === "ending"
            ? "Завершаем…"
            : state.clientSilent
              ? `${clientName} молчит. Повторите последнюю фразу.`
              : clientTalking
                ? `Говорит ${clientName}`
                : state.speaking === "student"
                  ? "Вы говорите"
                  : heard
                    ? "Ваш ответ"
                    : `${clientName} сейчас скажет фразу`;
  const callError = notice ?? (state.phase === "error" ? state.error : null);

  return (
    <div className="vp-screen">
      <p className="vp-kicker">
        Первые слова · {clientName}
        {phase === "call" || phase === "result" ? ` · реплика ${idx + 1} из ${momentIds.length}` : ""}
      </p>

      {phase === "intro" && (
        <>
          <h1 className="vp-title">Первые слова</h1>
          <div className="vp-card vp-hint">
            {clientName} скажет одну фразу. Ответьте так, как ответили бы живому человеку, — она отреагирует сразу. Это не
            экзамен, а разминка, чтобы слова включались.
          </div>
          <div className="vp-card vp-hint">
            {momentIds.length} коротких реплики подряд, около трёх минут. Отвечайте, когда {clientName} договорит. После
            каждой реплики — короткая подсказка.
          </div>
          <button type="button" className="vp-btn" onClick={() => void beginAttempt(0)}>
            Начать
          </button>
          <p className="vp-small">Понадобится микрофон, наушники не нужны. Учебного клиента играет ИИ, звук не записывается.</p>
        </>
      )}

      {phase === "call" && (
        <div className="vp-warmup">
          <div className="vp-orb" data-speaking={clientTalking ? "client" : state.speaking} aria-hidden />
          {callError ? (
            <>
              <div className="vp-error">{callError}</div>
              <button type="button" className="vp-btn" onClick={() => void beginAttempt(idx)}>
                Попробовать ещё раз
              </button>
            </>
          ) : (
            <>
              <p className="vp-status" role="status">
                {callStatus}
              </p>
              {state.phase === "paused" ? (
                <button type="button" className="vp-btn" onClick={() => void voice.start()}>
                  Продолжить
                </button>
              ) : (
                (state.phase === "live" || state.phase === "reconnecting") && (
                  <button type="button" className="vp-btn vp-btn-quiet" onClick={() => void voice.end()}>
                    Закончить попытку
                  </button>
                )
              )}
            </>
          )}
        </div>
      )}

      {phase === "result" && card && (
        <>
          {state.playing || card.loading ? (
            <div className="vp-warmup">
              <div className="vp-orb" data-speaking={state.playing ? "client" : undefined} aria-hidden />
              <p className="vp-status" role="status">
                {state.playing ? `Говорит ${clientName}` : "Готовим подсказку…"}
              </p>
            </div>
          ) : card.speech === false ? (
            <div className="vp-card vp-hint">Ответ не прозвучал. Ничего страшного — попробуйте ещё раз, можно начать с простого.</div>
          ) : (
            <div className="vp-card">
              {card.reaction && (
                <p className="vp-reaction" data-reaction={card.reaction}>
                  {reactionText(card.reaction, clientName)}
                </p>
              )}
              {card.lineText && (
                <p className="vp-small vp-left">
                  {clientName}: «{card.lineText}»
                </p>
              )}
              {card.transcript && <p className="vp-quote vp-quote-was">Вы: «{card.transcript}»</p>}
              {card.clientReply && (
                <p className="vp-small vp-left">
                  {clientName}: «{card.clientReply}»
                </p>
              )}
              {card.cardFailed ? (
                <p className="vp-small vp-left">Подсказка не собралась. Попробуйте ещё раз или идите дальше.</p>
              ) : (
                <>
                  <div className="vp-row vp-row-stack">
                    <span className="vp-ok">Получилось</span>
                    <span>{card.got}</span>
                  </div>
                  <div className="vp-row vp-row-stack">
                    <span className="vp-warn">Попробуйте</span>
                    <span>{card.try}</span>
                  </div>
                </>
              )}
              {card.firstWordMs != null && <p className="vp-small vp-left">Вы начали отвечать через {seconds(card.firstWordMs)} с.</p>}
            </div>
          )}
          {!state.playing && !card.loading && (
            <>
              <button type="button" className="vp-btn" onClick={() => void beginAttempt(idx)}>
                Ещё раз
              </button>
              <button type="button" className="vp-btn vp-btn-quiet vp-gap" onClick={next}>
                {idx + 1 < momentIds.length ? "Дальше" : "Итог"}
              </button>
            </>
          )}
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
