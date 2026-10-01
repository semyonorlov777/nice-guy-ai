"use client";

// Запись короткого ответа для «Первых слов»: MediaRecorder + детектор тишины на AnalyserNode.
// Стоп — 2 с тишины после начала речи, кнопкой или по потолку 20 с.
// useVoiceInput не подходит: он выбирает Web Speech API и не отдаёт аудио.
import { useCallback, useEffect, useRef, useState } from "react";

const SILENCE_MS = 2000;
const MAX_MS = 20_000;
const TICK_MS = 50;
/** Минимальный порог громкости (RMS 0..1); реальный — от шума комнаты, замеренного в начале. */
const MIN_SPEECH_RMS = 0.02;
const NOISE_FACTOR = 3;
/** Речь засчитывается после 150 мс выше порога подряд — щелчки и стуки не считаются. */
const SPEECH_CONFIRM_MS = 150;

export interface WarmupRecording {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  /** От начала записи до первого слова; null — речи не было. */
  firstWordMs: number | null;
  /** Сколько миллисекунд громкость была выше порога речи (отсев кашля и стука). */
  voicedMs: number;
}

type RecState = "idle" | "recording";

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return "";
}

export function useWarmupRecorder() {
  const [state, setState] = useState<RecState>("idle");
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Микрофон и AudioContext — вызывать внутри нажатия (жест нужен iOS).
   * Повторный вызов отдаёт уже открытый поток. Бросает ошибку, если доступа нет.
   */
  const prepare = useCallback(async () => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new Ctx();
    }
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    const live = streamRef.current?.getAudioTracks().some((t) => t.readyState === "live");
    if (!live) {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    }
  }, []);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  /** Начать запись; промис разрешается, когда запись остановлена (тишина, кнопка, потолок). */
  const record = useCallback(async (): Promise<WarmupRecording> => {
    await prepare();
    const stream = streamRef.current!;
    const ctx = ctxRef.current!;
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});

    const mime = pickMime();
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    recRef.current = rec;
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    const startedAt = performance.now();
    let noise = 0;
    let noiseSamples = 0;
    let firstWordMs: number | null = null;
    let aboveSince: number | null = null;
    let lastVoiceAt = 0;
    let voicedMs = 0;

    return new Promise<WarmupRecording>((resolve) => {
      rec.onstop = () => {
        clearTimer();
        source.disconnect();
        setState("idle");
        setLevel(0);
        setSpeaking(false);
        recRef.current = null;
        const type = rec.mimeType || mime || "audio/webm";
        resolve({
          blob: new Blob(chunks, { type }),
          mimeType: type,
          durationMs: Math.round(performance.now() - startedAt),
          firstWordMs,
          voicedMs,
        });
      };

      timerRef.current = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const now = performance.now();
        const elapsed = now - startedAt;

        // Первые 250 мс — замер шума комнаты (студент редко начинает раньше).
        if (elapsed < 250) {
          noise += rms;
          noiseSamples++;
        }
        const threshold = Math.max(MIN_SPEECH_RMS, noiseSamples ? (noise / noiseSamples) * NOISE_FACTOR : 0);
        setLevel(Math.min(1, rms / (threshold * 3)));

        if (rms > threshold) {
          voicedMs += TICK_MS;
          aboveSince ??= now;
          if (now - aboveSince >= SPEECH_CONFIRM_MS) {
            if (firstWordMs == null) firstWordMs = Math.round(aboveSince - startedAt);
            lastVoiceAt = now;
            setSpeaking(true);
          }
        } else {
          aboveSince = null;
          if (firstWordMs != null && now - lastVoiceAt > 400) setSpeaking(false);
        }

        const silentTooLong = firstWordMs != null && now - lastVoiceAt >= SILENCE_MS;
        if ((silentTooLong || elapsed >= MAX_MS) && rec.state === "recording") {
          clearTimer();
          rec.stop();
        }
      }, TICK_MS);

      rec.start();
      setState("recording");
    });
  }, [prepare]);

  /** Остановить запись кнопкой. */
  const stop = useCallback(() => {
    if (recRef.current?.state === "recording") recRef.current.stop();
  }, []);

  /** Отпустить микрофон (при уходе со страницы и в конце серии). */
  const release = useCallback(() => {
    clearTimer();
    if (recRef.current?.state === "recording") recRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }, []);

  useEffect(() => release, [release]);

  return { state, level, speaking, prepare, record, stop, release };
}
