"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// Адаптация hooks/useVoiceInput.ts из основного проекта.
// Отличия:
//   - Шлёт MediaRecorder fallback на /api/voice/transcribe (а не /api/transcribe).
//   - Никакого token-биллинга и balance_tokens.
//   - Максимум 25 минут записи (вместо часа) — защита от случайного оставленного микрофона.

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type VoiceState = "idle" | "recording" | "processing" | "error";
export type VoiceBackend = "web-speech" | "media-recorder" | "none";

export interface UseVoiceRecorderOptions {
  lang?: string;
  maxDuration?: number;
  onTranscript: (text: string, durationSec: number) => void;
}

export interface UseVoiceRecorderReturn {
  state: VoiceState;
  backend: VoiceBackend;
  isSupported: boolean;
  duration: number;
  interimText: string;
  waveformData: number[];
  error: string | null;

  startRecording: () => void;
  stopRecording: () => void;
  cancelRecording: () => void;
}

function detectBackend(): VoiceBackend {
  if (typeof window === "undefined") return "none";
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  if (w.SpeechRecognition || w.webkitSpeechRecognition) return "web-speech";
  if (
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  ) {
    return "media-recorder";
  }
  return "none";
}

function hasMediaRecorderFallback(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

// Понятные тексты для всех SpeechRecognition error codes, которые могут зашатнуть запись.
// До этого фикса обрабатывались только `not-allowed` и `network` — остальные молча
// игнорировались, и пользователь видел только что кнопка «не работает» без причины.
function describeSpeechError(err: string): string {
  switch (err) {
    case "not-allowed":
      return "Нет доступа к микрофону. Разреши в настройках браузера.";
    case "service-not-allowed":
      return "Сервис распознавания недоступен. Попробуй ещё раз через минуту.";
    case "audio-capture":
      return "Микрофон занят другим приложением. Закрой Zoom/Meet/другие вкладки.";
    case "network":
      return "Сервис распознавания не отвечает. Переключаюсь на запасной путь.";
    case "language-not-supported":
      return "Русский язык не поддерживается. Переключаюсь на запасной путь.";
    case "bad-grammar":
      return "Ошибка распознавания (bad-grammar).";
    default:
      return `Ошибка распознавания: ${err}`;
  }
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const mt of candidates) {
    if (MediaRecorder.isTypeSupported(mt)) return mt;
  }
  return "audio/webm";
}

const isIOS =
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export function useVoiceRecorder(options: UseVoiceRecorderOptions): UseVoiceRecorderReturn {
  const { lang = "ru-RU", maxDuration = 25 * 60, onTranscript } = options;

  const [state, setState] = useState<VoiceState>("idle");
  const [duration, setDuration] = useState(0);
  const [interimText, setInterimText] = useState("");
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [backend, setBackend] = useState<VoiceBackend>("none");

  const backendRef = useRef<VoiceBackend>("none");
  const stateRef = useRef<VoiceState>("idle");
  const durationRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef("");
  const interimRef = useRef("");
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldRestartRef = useRef(false);

  // Поздняя ссылка на startMediaRecorder — нужна чтобы из onerror Web Speech
  // можно было сразу переключиться на запасной путь без forward-reference.
  const startMediaRecorderRef = useRef<(() => Promise<void>) | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const b = detectBackend();
    backendRef.current = b;
    setBackend(b);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    durationRef.current = 0;
    setDuration(0);
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDuration(durationRef.current);
    }, 1000);
  }, [stopTimer]);

  const startWaveformLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    function loop() {
      if (stateRef.current !== "recording") return;
      analyser!.getByteTimeDomainData(dataArray);
      const bars: number[] = [];
      const step = Math.floor(dataArray.length / 20);
      for (let i = 0; i < 20; i++) {
        const val = dataArray[i * step] ?? 128;
        bars.push(Math.abs(val - 128) / 128);
      }
      setWaveformData(bars);
      rafRef.current = requestAnimationFrame(loop);
    }
    loop();
  }, []);

  const stopWaveformLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setWaveformData([]);
  }, []);

  const cleanupMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
    }
  }, []);

  const cleanupRecognition = useCallback(() => {
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
  }, []);

  const cleanupMediaRecorder = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const fullCleanup = useCallback(() => {
    stopTimer();
    stopWaveformLoop();
    cleanupRecognition();
    cleanupMediaRecorder();
    cleanupMediaStream();
  }, [stopTimer, stopWaveformLoop, cleanupRecognition, cleanupMediaRecorder, cleanupMediaStream]);

  useEffect(() => () => fullCleanup(), [fullCleanup]);

  const startWebSpeech = useCallback(() => {
    const SRCtor = getSpeechRecognitionCtor();
    if (!SRCtor) {
      setErrorMsg("Web Speech API не поддерживается");
      setState("error");
      stateRef.current = "error";
      return;
    }
    transcriptRef.current = "";
    interimRef.current = "";
    setInterimText("");
    shouldRestartRef.current = true;

    const recognition = new SRCtor();
    recognition.lang = lang;
    if (isIOS) {
      recognition.continuous = false;
      recognition.interimResults = false;
    } else {
      recognition.continuous = true;
      recognition.interimResults = true;
    }
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          transcriptRef.current += transcript + " ";
          interimRef.current = "";
        } else {
          interim += transcript;
        }
      }
      interimRef.current = interim;
      setInterimText(interim);

      if (isIOS && stateRef.current === "recording") {
        try {
          recognition.start();
        } catch {}
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;

      if (process.env.NODE_ENV === "development") {
        console.error(
          `[useVoiceRecorder] SpeechRecognition error: ${event.error}${event.message ? ` — ${event.message}` : ""}`,
        );
      }

      // Фатальные ошибки — нет смысла переключаться на запасной путь.
      if (event.error === "not-allowed") {
        setErrorMsg(describeSpeechError(event.error));
        fullCleanup();
        setState("error");
        stateRef.current = "error";
        return;
      }

      // Network: типичный сценарий «было нормально, потом перестало» — Google
      // backend перестал отвечать. Сохраняем накопленный текст и переключаемся
      // на MediaRecorder + Gemini, чтобы запись продолжилась без потери.
      if (event.error === "network") {
        const text = (transcriptRef.current + interimRef.current).trim();
        const dur = durationRef.current;
        cleanupRecognition();
        if (text) {
          // Отдадим уже распознанный кусок как отдельное сообщение, чтобы он
          // точно сохранился, даже если резервный путь тоже не сработает.
          onTranscriptRef.current(text, dur);
          transcriptRef.current = "";
          interimRef.current = "";
          setInterimText("");
        }
        // Пробуем MediaRecorder, если он доступен. Если нет — показываем ошибку.
        if (hasMediaRecorderFallback()) {
          backendRef.current = "media-recorder";
          setBackend("media-recorder");
          setErrorMsg(null);
          // startMediaRecorder сбрасывает duration сам, но мы тут продолжаем сессию.
          startMediaRecorderRef.current?.();
        } else if (!text) {
          setErrorMsg(describeSpeechError(event.error));
          fullCleanup();
          setDuration(0);
          setState("error");
          stateRef.current = "error";
        } else {
          // Текст уже сохранён, но fallback недоступен — просто завершаем сессию.
          fullCleanup();
          setDuration(0);
          setState("idle");
          stateRef.current = "idle";
        }
        return;
      }

      // Прочие ошибки (audio-capture, service-not-allowed, language-not-supported,
      // bad-grammar, неизвестные) — раньше молча игнорировались. Теперь:
      // 1) Показываем причину пользователю.
      // 2) Если MediaRecorder доступен и есть смысл — переключаемся на него.
      const text = (transcriptRef.current + interimRef.current).trim();
      const dur = durationRef.current;
      cleanupRecognition();
      if (text) {
        onTranscriptRef.current(text, dur);
        transcriptRef.current = "";
        interimRef.current = "";
        setInterimText("");
      }

      const canFallback =
        hasMediaRecorderFallback() &&
        (event.error === "audio-capture" ||
          event.error === "service-not-allowed" ||
          event.error === "language-not-supported" ||
          event.error === "bad-grammar" ||
          // Любая неизвестная ошибка — пробуем резервный путь.
          ![
            "not-allowed",
            "aborted",
            "no-speech",
            "network",
          ].includes(event.error));

      if (canFallback) {
        backendRef.current = "media-recorder";
        setBackend("media-recorder");
        setErrorMsg(null);
        startMediaRecorderRef.current?.();
      } else {
        setErrorMsg(describeSpeechError(event.error));
        fullCleanup();
        setDuration(0);
        setState("error");
        stateRef.current = "error";
      }
    };

    recognition.onend = () => {
      if (shouldRestartRef.current && stateRef.current === "recording") {
        if (isIOS) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch {}
          }, 100);
        } else {
          try {
            recognition.start();
          } catch {}
        }
      }
    };

    try {
      recognition.start();
    } catch {
      setErrorMsg("Не удалось запустить распознавание");
      setState("error");
      stateRef.current = "error";
    }
  }, [lang, fullCleanup, cleanupRecognition]);

  const startMediaRecorder = useCallback(async () => {
    transcriptRef.current = "";
    interimRef.current = "";
    setInterimText("");
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMsg("Нет доступа к микрофону");
      setState("error");
      stateRef.current = "error";
      return;
    }
    mediaStreamRef.current = stream;

    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      startWaveformLoop();
    } catch {}

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(5000);
  }, [startWaveformLoop]);

  // Связываем ref с актуальной реализацией — это позволяет вызвать MediaRecorder
  // из onerror Web Speech (объявленного раньше) без циклической зависимости.
  startMediaRecorderRef.current = startMediaRecorder;

  const stopRecording = useCallback(() => {
    if (stateRef.current !== "recording") return;
    setState("processing");
    stateRef.current = "processing";
    stopTimer();
    stopWaveformLoop();

    if (backendRef.current === "web-speech") {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      const text = (transcriptRef.current + interimRef.current).trim();
      const dur = durationRef.current;
      setInterimText("");
      interimRef.current = "";
      if (text) {
        setState("idle");
        stateRef.current = "idle";
        setDuration(0);
        onTranscriptRef.current(text, dur);
      } else {
        setErrorMsg("Не удалось распознать речь");
        setState("error");
        stateRef.current = "error";
        setDuration(0);
        setTimeout(() => {
          if (stateRef.current === "error") {
            setErrorMsg(null);
            setState("idle");
            stateRef.current = "idle";
          }
        }, 3000);
      }
      cleanupRecognition();
    } else if (backendRef.current === "media-recorder") {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        setState("idle");
        stateRef.current = "idle";
        setDuration(0);
        cleanupMediaRecorder();
        cleanupMediaStream();
        return;
      }
      const recordingDuration = durationRef.current;
      recorder.onstop = async () => {
        const mt = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mt });
        cleanupMediaRecorder();
        cleanupMediaStream();
        if (blob.size === 0) {
          setState("idle");
          stateRef.current = "idle";
          setDuration(0);
          return;
        }
        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");
          formData.append("duration", String(recordingDuration));
          const res = await fetch("/api/voice/transcribe", { method: "POST", body: formData });
          const data = await res.json();
          if (!res.ok) {
            setErrorMsg(data.error || "Ошибка транскрипции");
            setState("error");
            stateRef.current = "error";
            setDuration(0);
            return;
          }
          setDuration(0);
          if (data.text) {
            setState("idle");
            stateRef.current = "idle";
            onTranscriptRef.current(data.text, recordingDuration);
          } else {
            setErrorMsg("Не удалось распознать речь");
            setState("error");
            stateRef.current = "error";
          }
        } catch {
          setErrorMsg("Ошибка отправки аудио");
          setState("error");
          stateRef.current = "error";
          setDuration(0);
        }
      };
      recorder.stop();
    }
  }, [stopTimer, stopWaveformLoop, cleanupRecognition, cleanupMediaRecorder, cleanupMediaStream]);

  const startRecording = useCallback(() => {
    if (stateRef.current !== "idle") return;
    setErrorMsg(null);
    setState("recording");
    stateRef.current = "recording";
    startTimer();
    if (navigator.vibrate) navigator.vibrate(50);
    if (backendRef.current === "web-speech") startWebSpeech();
    else if (backendRef.current === "media-recorder") startMediaRecorder();
  }, [startTimer, startWebSpeech, startMediaRecorder]);

  const cancelRecording = useCallback(() => {
    if (stateRef.current !== "recording") return;
    fullCleanup();
    transcriptRef.current = "";
    interimRef.current = "";
    setInterimText("");
    setDuration(0);
    setState("idle");
    stateRef.current = "idle";
  }, [fullCleanup]);

  useEffect(() => {
    if (duration >= maxDuration && stateRef.current === "recording") {
      stopRecording();
    }
  }, [duration, maxDuration, stopRecording]);

  return {
    state,
    backend,
    isSupported: backend !== "none",
    duration,
    interimText,
    waveformData,
    error: errorMsg,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
