"use client";

// Голосовой звонок с учебным клиентом.
// start() вызывается ТОЛЬКО из обработчика нажатия: iOS Safari разрешает звук и
// микрофон лишь внутри жеста пользователя. Сокет переподключается сам: по просьбе
// сервера (предел функции), после обрыва сети и после сворачивания страницы.
//
// «Меня слышат?»: сервер раз в секунду подтверждает, сколько звука студента получил (heard).
// Звук без подтверждения дольше STALL_MS — связь прервалась (link: "lost"), дольше DEAD_MS —
// сокет считаем мёртвым и переподключаемся, не дожидаясь, пока браузер это заметит.
// Пока нового соединения нет (переподключение, смена соединения по пределу функции),
// звук копится (до 8 с) и досылается, как только сервер готов.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerMessage } from "@/lib/voice-practice/protocol";

export type CallPhase =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "paused"
  | "ending"
  | "ended"
  | "error";

/**
 * Доходит ли звук студента: ok — подтверждения идут, lost — нет (связь), nomic — микрофон не даёт
 * звука (выключен в системе, сменилось устройство), muted — микрофон ждёт, пока клиент договорит.
 */
export type MicLink = "ok" | "lost" | "nomic" | "muted";

export interface CallState {
  phase: CallPhase;
  speaking: "client" | "student" | "idle";
  secondsLeft: number | null;
  warn: boolean;
  clientSilent: boolean;
  /** «Трудный момент»: попытка засчитана. */
  attemptDone: boolean;
  /** Голос клиента звучит в динамике (может звучать и после конца сессии). */
  playing: boolean;
  /** Только во время разговора (live/reconnecting), иначе null. */
  link: MicLink | null;
  /** Сервер только что подтвердил речь студента. */
  heard: boolean;
  /** Связь вернулась: ok — ничего не потерялось, repeat — последние слова могли не дойти. */
  recovered: "ok" | "repeat" | null;
  error: string | null;
}

/** Попыток переподключения подряд (паузы 1–4 с): около минуты без сети. */
const MAX_RECONNECTS = 15;
/** Звук без подтверждения дольше — «связь прервалась». */
const STALL_MS = 3000;
/** Звук без подтверждения дольше — сокет мёртв (сеть пропала без закрытия), переподключаемся. */
const DEAD_MS = 10000;
/** Запас звука на время переподключения: кадры по 40 мс, 200 — 8 с. */
const PENDING_MAX = 200;
/** Сколько держится знак «речь дошла» после подтверждения. */
const HEARD_HOLD_MS = 1500;
/** Сколько держится «связь восстановлена». */
const RECOVERED_MS = 6000;

/** Порог громкости (RMS 0..1) для отметки «студент заговорил». */
const VOICE_RMS = 0.03;

export interface VoiceSessionOptions {
  /**
   * Пока звучит голос клиента, микрофон не передаётся (без наушников динамик телефона
   * иначе «перебивает» клиента его же голосом). Для «Трудного момента» и разминки.
   */
  halfDuplex?: boolean;
  /**
   * Серия сессий (разминка): после конца сессии звук и микрофон не закрываются —
   * реакция клиента доигрывает, следующая попытка стартует через connect() без нового
   * доступа к микрофону. Закрыть — release().
   */
  keepAudio?: boolean;
  /** Микрофон услышал голос (кадр громче порога, передан на сервер). */
  onVoice?: () => void;
  /** Голос клиента зазвучал / затих в динамике. */
  onPlaying?: (playing: boolean) => void;
}

export function useVoiceSession(sessionId: string, onEnded: () => void, opts: VoiceSessionOptions = {}) {
  const [state, setState] = useState<CallState>({
    phase: "idle",
    speaking: "idle",
    secondsLeft: null,
    warn: false,
    clientSilent: false,
    attemptDone: false,
    playing: false,
    link: null,
    heard: false,
    recovered: null,
    error: null,
  });
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureRef = useRef<AudioWorkletNode | null>(null);
  const playbackRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelBufRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  /** Сокет, получивший ready: только в него идёт звук. */
  const audioWsRef = useRef<WebSocket | null>(null);
  /** Звук, ждущий готового соединения. */
  const pendingRef = useRef<{ buf: ArrayBuffer; voiced: boolean; at: number }[]>([]);
  /** В этой сессии уже было готовое соединение (до первого — звук не копим). */
  const liveOnceRef = useRef(false);
  /** Отправлено байт в текущий сокет и отметки «сколько к моменту at» — для сверки с heard. */
  const sentRef = useRef(0);
  const marksRef = useRef<{ bytes: number; at: number }[]>([]);
  const lastVoiceSentAtRef = useRef(0);
  /** Последний кадр с микрофона: кадров нет — звук браузера «уснул», слать нечего. */
  const lastFrameAtRef = useRef(0);
  const lastSpeechMsRef = useRef(0);
  const speechAckAtRef = useRef(0);
  /** Речь студента пропала при обрыве — после восстановления попросить повторить. */
  const droppedRef = useRef(false);
  const wasLostRef = useRef(false);
  const recoveredRef = useRef<{ kind: "ok" | "repeat"; until: number } | null>(null);
  const endedRef = useRef(false);
  const pausedRef = useRef(false);
  const reconnectsRef = useRef(0);
  const playingUntilRef = useRef(0);
  const halfDuplex = !!opts.halfDuplex;
  const keepAudio = !!opts.keepAudio;
  const sessionIdRef = useRef(sessionId);
  /** Билет из ответа на создание сессии — первый connect обходится без лишнего запроса. */
  const ticketRef = useRef<string | null>(null);
  const onEndedRef = useRef(onEnded);
  const onVoiceRef = useRef(opts.onVoice);
  const onPlayingRef = useRef(opts.onPlaying);
  useEffect(() => {
    onEndedRef.current = onEnded;
    onVoiceRef.current = opts.onVoice;
    onPlayingRef.current = opts.onPlaying;
  }, [onEnded, opts.onVoice, opts.onPlaying]);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);
  // Повторное открытие сокета из его же обработчиков — через ссылку.
  const reopenRef = useRef<(isReconnect: boolean) => Promise<void>>(async () => undefined);

  const patch = useCallback((p: Partial<CallState>) => setState((s) => ({ ...s, ...p })), []);

  const getTicket = useCallback(async (): Promise<string | null> => {
    const ready = ticketRef.current;
    ticketRef.current = null;
    if (ready) return ready;
    // Сеть или сбой сервера — исключение (переподключение попробует ещё), 4xx — сессии больше нет.
    const r = await fetch(`/api/practice/sessions/${sessionIdRef.current}/ticket`, { method: "POST" });
    if (r.status >= 500) throw new Error(`ticket ${r.status}`);
    if (!r.ok) return null;
    return ((await r.json()) as { ticket: string }).ticket;
  }, []);

  const teardownAudio = useCallback(() => {
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    captureRef.current?.port.close();
    captureRef.current?.disconnect();
    playbackRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    void ctxRef.current?.close();
    captureRef.current = null;
    playbackRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
  }, []);

  const finish = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    wsRef.current?.close();
    if (!keepAudio) teardownAudio();
    patch({ phase: "ended", speaking: "idle" });
    onEndedRef.current();
  }, [keepAudio, patch, teardownAudio]);

  /** Неподтверждённый звук пропал вместе с сокетом: была ли в нём речь. */
  const dropUnacked = useCallback(() => {
    const oldest = marksRef.current[0];
    if (oldest && lastVoiceSentAtRef.current >= oldest.at - 250) droppedRef.current = true;
    marksRef.current = [];
  }, []);

  const sendFrame = useCallback((ws: WebSocket, buf: ArrayBuffer, voiced: boolean) => {
    ws.send(buf);
    sentRef.current += buf.byteLength;
    const now = Date.now();
    if (voiced) lastVoiceSentAtRef.current = now;
    const marks = marksRef.current;
    const last = marks[marks.length - 1];
    if (last && now - last.at < 250) last.bytes = sentRef.current;
    else marks.push({ bytes: sentRef.current, at: now });
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (endedRef.current || pausedRef.current) return;
    if (reconnectsRef.current >= MAX_RECONNECTS) {
      patch({ phase: "error", error: "Связь потеряна. Консультация сохранена — откройте разбор." });
      return;
    }
    reconnectsRef.current += 1;
    patch({ phase: "reconnecting" });
    setTimeout(() => void reopenRef.current(true), Math.min(1000 * reconnectsRef.current, 4000));
  }, [patch]);

  const openSocket = useCallback(
    async (isReconnect: boolean): Promise<void> => {
      let ticket: string | null;
      try {
        ticket = await getTicket();
      } catch {
        if (endedRef.current || pausedRef.current) return;
        if (isReconnect) scheduleReconnect();
        else patch({ phase: "error", error: "Нет связи. Проверьте интернет и попробуйте ещё раз." });
        return;
      }
      if (endedRef.current || pausedRef.current) return;
      if (!ticket) {
        // Сессии больше нет (закрыта сервером или уборкой) — к разбору.
        finish();
        return;
      }
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/api/practice/ws`);
      ws.binaryType = "arraybuffer";
      const prev = wsRef.current;
      wsRef.current = ws;
      let rotating = false;

      ws.onopen = () => ws.send(JSON.stringify({ t: "auth", ticket }));
      ws.onmessage = (e) => {
        if (e.data instanceof ArrayBuffer) {
          playbackRef.current?.port.postMessage(e.data, [e.data]);
          return;
        }
        const m = JSON.parse(String(e.data)) as ServerMessage;
        switch (m.t) {
          case "ready": {
            reconnectsRef.current = 0;
            if (prev && prev !== ws) prev.close();
            audioWsRef.current = ws;
            liveOnceRef.current = true;
            sentRef.current = 0;
            marksRef.current = [];
            lastSpeechMsRef.current = 0;
            // Сказанное, пока соединения не было, — досылаем.
            const pending = pendingRef.current;
            pendingRef.current = [];
            for (const f of pending) sendFrame(ws, f.buf, f.voiced);
            patch({ phase: "live", secondsLeft: m.secondsLeft, error: null });
            break;
          }
          case "heard": {
            if (ws !== audioWsRef.current) break;
            marksRef.current = marksRef.current.filter((x) => x.bytes > m.bytes);
            if (m.speechMs > lastSpeechMsRef.current) {
              lastSpeechMsRef.current = m.speechMs;
              speechAckAtRef.current = Date.now();
            }
            break;
          }
          case "state":
            patch({ speaking: m.speaking, secondsLeft: m.secondsLeft, ...(m.warn ? { warn: true } : {}), clientSilent: false });
            break;
          case "interrupted":
            playbackRef.current?.port.postMessage({ t: "flush" });
            break;
          case "attempt_done":
            patch({ attemptDone: true });
            break;
          case "client_silent":
            patch({ clientSilent: true });
            break;
          case "rotate":
            if (!rotating) {
              rotating = true;
              void reopenRef.current(true);
            }
            break;
          case "ended":
            finish();
            break;
          case "error":
            if (m.code === "superseded") {
              endedRef.current = true;
              teardownAudio();
              patch({ phase: "error", error: m.message });
            } else if (m.code !== "ticket_invalid" || !isReconnect) {
              patch({ phase: "error", error: m.message });
            }
            break;
        }
      };
      ws.onclose = () => {
        if (audioWsRef.current === ws) {
          audioWsRef.current = null;
          dropUnacked();
        }
        if (wsRef.current !== ws || endedRef.current || pausedRef.current) return;
        scheduleReconnect();
      };
    },
    [dropUnacked, finish, getTicket, patch, scheduleReconnect, sendFrame, teardownAudio],
  );
  useEffect(() => {
    reopenRef.current = openSocket;
  }, [openSocket]);

  /** Микрофон и звук. Вызывать из обработчика нажатия; false — доступа нет (ошибка уже в state). */
  const prepare = useCallback(async (): Promise<boolean> => {
    endedRef.current = false;
    pausedRef.current = false;
    patch({ phase: "connecting", error: null, clientSilent: false, warn: false });
    try {
      if (!streamRef.current || streamRef.current.getAudioTracks().every((t) => t.readyState === "ended")) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        });
        streamRef.current = stream;
        // Микрофон выдернули или отдали другой программе — сказать сразу, а не молчать.
        stream.getAudioTracks()[0]?.addEventListener("ended", () => {
          if (streamRef.current !== stream || endedRef.current) return;
          pausedRef.current = true;
          const ws = wsRef.current;
          if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "pause" }));
          ws?.close();
          teardownAudio();
          patch({ phase: "error", error: "Микрофон отключился. Проверьте его и нажмите «Попробовать ещё раз»." });
        });
        // Новый микрофон — звук собираем заново.
        if (ctxRef.current && ctxRef.current.state !== "closed") {
          void ctxRef.current.close();
          ctxRef.current = null;
        }
      }
      if (!ctxRef.current || ctxRef.current.state === "closed") {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        ctxRef.current = ctx;
        await ctx.resume();
        await ctx.audioWorklet.addModule("/audio/pcm-capture.worklet.js");
        await ctx.audioWorklet.addModule("/audio/pcm-playback.worklet.js");
        const src = ctx.createMediaStreamSource(streamRef.current);
        // Уровень голоса для экрана — прямо с микрофона, без сети.
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0;
        src.connect(analyser);
        analyserRef.current = analyser;
        const capture = new AudioWorkletNode(ctx, "pcm-capture");
        capture.port.onmessage = (e) => {
          lastFrameAtRef.current = Date.now();
          if (halfDuplex && Date.now() < playingUntilRef.current) return;
          if (pausedRef.current || endedRef.current) return;
          const buf = e.data as ArrayBuffer;
          const pcm = new Int16Array(buf);
          let sum = 0;
          for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
          const voiced = Math.sqrt(sum / pcm.length) / 0x8000 > VOICE_RMS;
          const ws = audioWsRef.current;
          if (ws && ws === wsRef.current && ws.readyState === WebSocket.OPEN) {
            if (voiced) onVoiceRef.current?.();
            sendFrame(ws, buf, voiced);
          } else if (liveOnceRef.current) {
            if (voiced) onVoiceRef.current?.();
            const p = pendingRef.current;
            p.push({ buf, voiced, at: Date.now() });
            if (p.length > PENDING_MAX && p.shift()?.voiced) droppedRef.current = true;
          }
        };
        src.connect(capture);
        const playback = new AudioWorkletNode(ctx, "pcm-playback", { outputChannelCount: [1] });
        playback.port.onmessage = (e) => {
          const d = e.data as { t?: string; playing?: boolean };
          if (d?.t !== "playing") return;
          // Хвост 400 мс: отзвук динамика после конца реплики.
          playingUntilRef.current = d.playing ? Number.MAX_SAFE_INTEGER : Date.now() + 400;
          patch({ playing: !!d.playing });
          onPlayingRef.current?.(!!d.playing);
        };
        playback.connect(ctx.destination);
        captureRef.current = capture;
        playbackRef.current = playback;
      } else {
        await ctxRef.current.resume();
      }
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
      patch({
        phase: "error",
        error: denied
          ? "Нет доступа к микрофону. Разрешите микрофон для этого сайта в настройках браузера и попробуйте снова."
          : "Не удалось включить звук. Попробуйте ещё раз.",
      });
      return false;
    }
    return true;
  }, [halfDuplex, patch, sendFrame, teardownAudio]);

  /** Подключиться к сессии (по умолчанию — к текущей). Для серии — новая сессия и её билет. */
  const connect = useCallback(
    async (next?: { sessionId: string; ticket?: string }) => {
      if (next) {
        sessionIdRef.current = next.sessionId;
        ticketRef.current = next.ticket ?? null;
      }
      endedRef.current = false;
      pausedRef.current = false;
      reconnectsRef.current = 0;
      liveOnceRef.current = false;
      pendingRef.current = [];
      marksRef.current = [];
      droppedRef.current = false;
      wasLostRef.current = false;
      recoveredRef.current = null;
      patch({ phase: "connecting", error: null, clientSilent: false, warn: false, secondsLeft: null });
      await openSocket(false);
    },
    [openSocket, patch],
  );

  /** Вызывать из обработчика нажатия. */
  const start = useCallback(async () => {
    if (await prepare()) await connect();
  }, [prepare, connect]);

  /** Закрыть звук и микрофон (keepAudio: конец серии). */
  const release = useCallback(() => {
    endedRef.current = true;
    wsRef.current?.close();
    teardownAudio();
    patch({ playing: false });
  }, [patch, teardownAudio]);

  const end = useCallback(async () => {
    patch({ phase: "ending" });
    const sid = sessionIdRef.current;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "end" }));
    else await fetch(`/api/practice/sessions/${sid}/finish`, { method: "POST" }).catch(() => undefined);
    // Запасное закрытие — только если за это время не началась следующая сессия серии.
    setTimeout(() => {
      if (sessionIdRef.current === sid) finish();
    }, 2500);
  }, [finish, patch]);

  /** Громкость микрофона 0..1 (шкала по децибелам) — для кольца вокруг круга, читать в кадре анимации. */
  const micLevel = useCallback((): number => {
    const a = analyserRef.current;
    if (!a) return 0;
    if (!levelBufRef.current || levelBufRef.current.length !== a.fftSize) levelBufRef.current = new Float32Array(a.fftSize);
    const b = levelBufRef.current;
    a.getFloatTimeDomainData(b);
    let sum = 0;
    for (let i = 0; i < b.length; i++) sum += b[i] * b[i];
    const db = 20 * Math.log10(Math.sqrt(sum / b.length) + 1e-9);
    return Math.max(0, Math.min(1, (db + 55) / 40));
  }, []);

  // Доходит ли звук: раз в 0,4 с сверяем отправленное с подтверждениями сервера.
  const { phase } = state;
  useEffect(() => {
    if (phase !== "live" && phase !== "reconnecting") {
      wasLostRef.current = false;
      return;
    }
    const check = () => {
      const now = Date.now();
      const mark = marksRef.current[0];
      const pend = pendingRef.current[0];
      const unacked = mark ? now - mark.at : 0;
      // Сеть пропала, а сокет «открыт» (браузер узнает о разрыве через минуты) — переподключаемся сами.
      const dead = audioWsRef.current;
      if (phase === "live" && dead && unacked > DEAD_MS) {
        dead.onclose = null;
        dead.onmessage = null;
        audioWsRef.current = null;
        dropUnacked();
        dead.close();
        if (wsRef.current === dead) scheduleReconnect();
      }
      // Микрофон не выдаёт кадров (звук браузера приостановлен) — будим и не говорим «Вас слышно».
      const micIdle = now - lastFrameAtRef.current > 1500;
      if (micIdle) void ctxRef.current?.resume().catch(() => undefined);
      const stalled = Math.max(unacked, pend ? now - pend.at : 0) > STALL_MS;
      const link: MicLink =
        phase === "reconnecting" || stalled
          ? "lost"
          : micIdle
            ? "nomic"
            : halfDuplex && now < playingUntilRef.current
              ? "muted"
              : "ok";
      // Без микрофона сказанное не записалось — после возврата тоже попросим повторить.
      if (link === "nomic") droppedRef.current = true;
      if (link === "lost" || link === "nomic") wasLostRef.current = true;
      else if (wasLostRef.current) {
        wasLostRef.current = false;
        recoveredRef.current = { kind: droppedRef.current ? "repeat" : "ok", until: now + RECOVERED_MS };
        droppedRef.current = false;
      }
      const rec = recoveredRef.current;
      const recovered = rec && now < rec.until ? rec.kind : null;
      const heard = link === "ok" && now - speechAckAtRef.current < HEARD_HOLD_MS;
      setState((s) => (s.link === link && s.heard === heard && s.recovered === recovered ? s : { ...s, link, heard, recovered }));
    };
    check();
    const id = setInterval(check, 400);
    return () => clearInterval(id);
  }, [phase, halfDuplex, dropUnacked, scheduleReconnect]);

  // Свернули страницу — пауза (сервер не считает минуты), вернулись — «Продолжить».
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      const ws = wsRef.current;
      if (!ws || endedRef.current || state.phase === "idle") return;
      pausedRef.current = true;
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "pause" }));
      ws.close();
      patch({ phase: "paused" });
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [patch, state.phase]);

  useEffect(() => () => {
    endedRef.current = true;
    wsRef.current?.close();
    teardownAudio();
  }, [teardownAudio]);

  // Вне разговора знака связи нет (последнее значение проверки не показываем).
  const talking = phase === "live" || phase === "reconnecting";
  const shown = talking ? state : { ...state, link: null, heard: false, recovered: null };
  return { state: shown, start, end, prepare, connect, release, micLevel };
}
