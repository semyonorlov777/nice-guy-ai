"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// --- Web Speech API type declarations (not in all lib.dom versions) ---

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

// --- Types ---

export type VoiceState = "idle" | "recording" | "locked" | "processing" | "error";
export type VoiceBackend = "web-speech" | "media-recorder" | "none";

export interface UseVoiceInputOptions {
  lang?: string;
  maxDuration?: number; // секунды
  onTranscript: (text: string) => void;
  paidFallbackEnabled?: boolean;
}

export interface UseVoiceInputReturn {
  state: VoiceState;
  backend: VoiceBackend;
  isPaidBackend: boolean;
  isSupported: boolean;

  duration: number;
  interimText: string;
  waveformData: number[];
  error: string | null;

  startRecording: () => void;
  stopRecording: () => void;
  cancelRecording: () => void;
  lockRecording: () => void;

  isLocked: boolean;
  isNearLimit: boolean;
}

// --- Constants ---

const NEAR_LIMIT_THRESHOLD = 30; // секунд до конца

// --- Helpers ---

function detectBackend(paidFallbackEnabled: boolean): VoiceBackend {
  if (typeof window === "undefined") return "none";
  const SR =
    (window as /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ any).SpeechRecognition ||
    (window as /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ any).webkitSpeechRecognition;
  if (SR) return "web-speech";
  if (
    paidFallbackEnabled &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  ) {
    return "media-recorder";
  }
  return "none";
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  return (
    (window as /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ any).SpeechRecognition ||
    (window as /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ any).webkitSpeechRecognition ||
    null
  );
}

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
  for (const mt of candidates) {
    if (MediaRecorder.isTypeSupported(mt)) return mt;
  }
  return "audio/webm";
}

// --- Hook ---

export function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInputReturn {
  const {
    lang = "ru-RU",
    maxDuration = 3600,
    onTranscript,
    paidFallbackEnabled = true,
  } = options;

  const [state, setState] = useState<VoiceState>("idle");
  const [duration, setDuration] = useState(0);
  const [interimText, setInterimText] = useState("");
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const backendRef = useRef<VoiceBackend>("none");
  const [backend, setBackend] = useState<VoiceBackend>("none");

  // Refs for cleanup
  const stateRef = useRef<VoiceState>("idle");
  const durationRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef("");
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  // Web Speech refs
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldRestartRef = useRef(false);

  // MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);

  // Detect backend once on mount
  useEffect(() => {
    const b = detectBackend(paidFallbackEnabled);
    backendRef.current = b;
    setBackend(b);
  }, [paidFallbackEnabled]);

  // --- Timer ---

  const startTimer = useCallback(() => {
    stopTimer();
    durationRef.current = 0;
    setDuration(0);
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDuration(durationRef.current);
    }, 1000);
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  // Auto-stop при maxDuration
  useEffect(() => {
    if (
      duration >= maxDuration &&
      (stateRef.current === "recording" || stateRef.current === "locked")
    ) {
      stopRecording();
    }
  }, [duration, maxDuration]);

  // --- Waveform (MediaRecorder only) ---

  const startWaveformLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function loop() {
      if (
        stateRef.current !== "recording" &&
        stateRef.current !== "locked"
      ) {
        return;
      }
      analyser!.getByteTimeDomainData(dataArray);
      // Compute amplitudes: normalize around 128 (silence) to 0..1
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

  // --- Cleanup helpers ---

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
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
  }, []);

  const cleanupMediaRecorder = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
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
  }, [stopWaveformLoop, cleanupRecognition, cleanupMediaRecorder, cleanupMediaStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      fullCleanup();
    };
  }, [fullCleanup]);

  // --- Web Speech API ---

  const startWebSpeech = useCallback(() => {
    const SRCtor = getSpeechRecognitionCtor();
    if (!SRCtor) {
      setErrorMsg("Web Speech API не поддерживается в этом браузере");
      setState("error");
      stateRef.current = "error";
      return;
    }

    transcriptRef.current = "";
    setInterimText("");
    shouldRestartRef.current = true;

    const recognition = new SRCtor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          transcriptRef.current += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted" || event.error === "no-speech") {
        // Не критичные — auto-restart в onend обработает
        return;
      }
      if (event.error === "not-allowed") {
        setErrorMsg("Нет доступа к микрофону. Разрешите доступ в настройках браузера.");
        fullCleanup();
        setState("error");
        stateRef.current = "error";
        return;
      }
      console.error("[useVoiceInput] Speech error:", event.error);
    };

    recognition.onend = () => {
      // Auto-restart if still recording/locked
      if (
        shouldRestartRef.current &&
        (stateRef.current === "recording" || stateRef.current === "locked")
      ) {
        try {
          recognition.start();
        } catch {
          // Already started or other error — ignore
        }
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("[useVoiceInput] Failed to start recognition:", e);
      setErrorMsg("Не удалось запустить распознавание речи");
      setState("error");
      stateRef.current = "error";
    }
  }, [lang, fullCleanup]);

  // --- MediaRecorder ---

  const startMediaRecorder = useCallback(async () => {
    transcriptRef.current = "";
    setInterimText("");
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMsg("Нет доступа к микрофону. Разрешите доступ в настройках браузера.");
      setState("error");
      stateRef.current = "error";
      return;
    }

    mediaStreamRef.current = stream;

    // Setup AudioContext + AnalyserNode for waveform
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      startWaveformLoop();
    } catch (e) {
      console.error("[useVoiceInput] AudioContext error:", e);
      // Non-critical — continue without waveform
    }

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.start(5000); // Chunks every 5 seconds
  }, [startWaveformLoop]);

  // --- Public API ---

  const startRecording = useCallback(() => {
    if (stateRef.current !== "idle") return;

    setErrorMsg(null);
    setState("recording");
    stateRef.current = "recording";
    startTimer();

    if (backendRef.current === "web-speech") {
      startWebSpeech();
    } else if (backendRef.current === "media-recorder") {
      startMediaRecorder();
    }
  }, [startTimer, startWebSpeech, startMediaRecorder]);

  const stopRecording = useCallback(() => {
    if (stateRef.current !== "recording" && stateRef.current !== "locked") return;

    setState("processing");
    stateRef.current = "processing";
    stopTimer();
    stopWaveformLoop();

    if (backendRef.current === "web-speech") {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      // Deliver transcript
      const text = transcriptRef.current.trim();
      setInterimText("");
      setState("idle");
      stateRef.current = "idle";
      setDuration(0);
      if (text) {
        onTranscriptRef.current(text);
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
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });

        cleanupMediaRecorder();
        cleanupMediaStream();

        if (blob.size === 0) {
          setState("idle");
          stateRef.current = "idle";
          setDuration(0);
          return;
        }

        // Send to /api/transcribe
        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");
          formData.append("duration", String(recordingDuration));

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();

          if (!res.ok) {
            setErrorMsg(data.error || "Ошибка транскрипции");
            setState("error");
            stateRef.current = "error";
            setDuration(0);
            return;
          }

          setState("idle");
          stateRef.current = "idle";
          setDuration(0);
          if (data.text) {
            onTranscriptRef.current(data.text);
          }
        } catch (e) {
          console.error("[useVoiceInput] Transcribe error:", e);
          setErrorMsg("Ошибка отправки аудио");
          setState("error");
          stateRef.current = "error";
          setDuration(0);
        }
      };

      recorder.stop();
    }
  }, [stopWaveformLoop, cleanupRecognition, cleanupMediaRecorder, cleanupMediaStream]);

  const cancelRecording = useCallback(() => {
    if (stateRef.current !== "recording" && stateRef.current !== "locked") return;
    fullCleanup();
    transcriptRef.current = "";
    setInterimText("");
    setDuration(0);
    setState("idle");
    stateRef.current = "idle";
  }, [fullCleanup]);

  const lockRecording = useCallback(() => {
    if (stateRef.current !== "recording") return;
    setState("locked");
    stateRef.current = "locked";
  }, []);

  // --- Derived state ---

  const isLocked = state === "locked";
  const isNearLimit =
    (state === "recording" || state === "locked") &&
    maxDuration - duration <= NEAR_LIMIT_THRESHOLD &&
    maxDuration - duration >= 0;

  return {
    state,
    backend,
    isPaidBackend: backend === "media-recorder",
    isSupported: backend !== "none",

    duration,
    interimText,
    waveformData,
    error: errorMsg,

    startRecording,
    stopRecording,
    cancelRecording,
    lockRecording,

    isLocked,
    isNearLimit,
  };
}
