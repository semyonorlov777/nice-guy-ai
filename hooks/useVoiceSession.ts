"use client";

// Голосовой звонок с учебным клиентом.
// start() вызывается ТОЛЬКО из обработчика нажатия: iOS Safari разрешает звук и
// микрофон лишь внутри жеста пользователя. Сокет переподключается сам: по просьбе
// сервера (предел функции), после обрыва сети и после сворачивания страницы.
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
  error: string | null;
}

const MAX_RECONNECTS = 5;

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
    error: null,
  });
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureRef = useRef<AudioWorkletNode | null>(null);
  const playbackRef = useRef<AudioWorkletNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
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
    const r = await fetch(`/api/practice/sessions/${sessionIdRef.current}/ticket`, { method: "POST" });
    if (!r.ok) return null;
    return ((await r.json()) as { ticket: string }).ticket;
  }, []);

  const teardownAudio = useCallback(() => {
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

  const openSocket = useCallback(
    async (isReconnect: boolean): Promise<void> => {
      const ticket = await getTicket();
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
          case "ready":
            reconnectsRef.current = 0;
            if (prev && prev !== ws) prev.close();
            patch({ phase: "live", secondsLeft: m.secondsLeft, error: null });
            break;
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
        if (wsRef.current !== ws || endedRef.current || pausedRef.current) return;
        if (reconnectsRef.current >= MAX_RECONNECTS) {
          patch({ phase: "error", error: "Связь потеряна. Консультация сохранена — откройте разбор." });
          return;
        }
        reconnectsRef.current += 1;
        patch({ phase: "reconnecting" });
        setTimeout(() => void reopenRef.current(true), Math.min(1000 * reconnectsRef.current, 4000));
      };
    },
    [finish, getTicket, patch, teardownAudio],
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
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        });
      }
      if (!ctxRef.current || ctxRef.current.state === "closed") {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        ctxRef.current = ctx;
        await ctx.resume();
        await ctx.audioWorklet.addModule("/audio/pcm-capture.worklet.js");
        await ctx.audioWorklet.addModule("/audio/pcm-playback.worklet.js");
        const src = ctx.createMediaStreamSource(streamRef.current);
        const capture = new AudioWorkletNode(ctx, "pcm-capture");
        capture.port.onmessage = (e) => {
          if (halfDuplex && Date.now() < playingUntilRef.current) return;
          const ws = wsRef.current;
          if (!ws || ws.readyState !== WebSocket.OPEN || pausedRef.current) return;
          if (onVoiceRef.current) {
            const pcm = new Int16Array(e.data as ArrayBuffer);
            let sum = 0;
            for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
            if (Math.sqrt(sum / pcm.length) / 0x8000 > VOICE_RMS) onVoiceRef.current();
          }
          ws.send(e.data as ArrayBuffer);
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
  }, [halfDuplex, patch]);

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

  return { state, start, end, prepare, connect, release };
}
