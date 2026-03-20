import { useState, useRef, useEffect, useCallback } from "react";

export type WelcomePhase =
  | "idle"
  | "thinking"
  | "streaming"
  | "quick-replies"
  | "input-pulse"
  | "done";

interface UseWelcomeAnimationOptions {
  welcomeMessage: string;
  enabled: boolean;
  storageKey: string;
  storageType: "local" | "session";
  triggerOnVisible?: boolean;
  containerEl?: HTMLElement | null;
}

interface UseWelcomeAnimationReturn {
  phase: WelcomePhase;
  streamedText: string;
  showCursor: boolean;
  quickReplyStaggerIndex: number;
  inputPulseActive: boolean;
  skipToEnd: () => void;
}

function getStorage(type: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  return type === "local" ? localStorage : sessionStorage;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function fakeStream(
  text: string,
  onUpdate: (partial: string) => void,
  signal: AbortSignal
): Promise<void> {
  const words = text.split(" ");
  let current = "";

  for (const word of words) {
    if (signal.aborted) {
      onUpdate(text);
      return;
    }
    current += (current ? " " : "") + word;
    onUpdate(current);

    const lastChar = word[word.length - 1];
    const delay = /[.!?—]/.test(lastChar)
      ? 120
      : /[,;:]/.test(lastChar)
        ? 60
        : 30 + Math.random() * 15;
    await new Promise((r) => setTimeout(r, delay));
  }
}

export function useWelcomeAnimation({
  welcomeMessage,
  enabled,
  storageKey,
  storageType,
  triggerOnVisible,
  containerEl,
}: UseWelcomeAnimationOptions): UseWelcomeAnimationReturn {
  // Check storage synchronously to avoid flash
  const alreadySeen = useRef(false);
  if (typeof window !== "undefined" && !alreadySeen.current) {
    const s = getStorage(storageType);
    if (s?.getItem(storageKey)) alreadySeen.current = true;
  }

  const isActive = enabled && !alreadySeen.current;

  const [phase, setPhase] = useState<WelcomePhase>(isActive ? "idle" : "done");
  const [streamedText, setStreamedText] = useState(isActive ? "" : welcomeMessage);
  const [staggerIndex, setStaggerIndex] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedRef = useRef(false);
  const skippedRef = useRef(false);

  const addTimer = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }, []);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const markDone = useCallback(() => {
    const s = getStorage(storageType);
    s?.setItem(storageKey, "1");
  }, [storageKey, storageType]);

  const skipToEnd = useCallback(() => {
    if (skippedRef.current) return;
    skippedRef.current = true;
    clearAllTimers();
    abortRef.current?.abort();
    setStreamedText(welcomeMessage);
    setStaggerIndex(999);
    setPhase("done");
    markDone();
  }, [welcomeMessage, clearAllTimers, markDone]);

  // Main sequence
  const runSequence = useCallback(async () => {
    if (startedRef.current || skippedRef.current) return;
    startedRef.current = true;

    const reduced = prefersReducedMotion();

    if (reduced) {
      setStreamedText(welcomeMessage);
      setStaggerIndex(999);
      setPhase("done");
      markDone();
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // Phase: thinking (at 800ms)
    await new Promise<void>((r) => addTimer(r, 800));
    if (skippedRef.current) return;
    setPhase("thinking");

    // Phase: streaming (at ~2000ms)
    await new Promise<void>((r) => addTimer(r, 1200));
    if (skippedRef.current) return;
    setPhase("streaming");

    await fakeStream(welcomeMessage, (partial) => {
      if (!skippedRef.current) setStreamedText(partial);
    }, controller.signal);
    if (skippedRef.current) return;

    // Brief pause before quick replies appear
    await new Promise<void>((r) => addTimer(r, 300));
    if (skippedRef.current) return;

    // Phase: quick-replies
    setPhase("quick-replies");

    // Stagger quick reply buttons (100ms each)
    for (let i = 1; i <= 10; i++) {
      await new Promise<void>((r) => addTimer(r, 100));
      if (skippedRef.current) return;
      setStaggerIndex(i);
    }

    // Phase: input-pulse (after 1000ms)
    await new Promise<void>((r) => addTimer(r, 1000));
    if (skippedRef.current) return;
    setPhase("input-pulse");

    // Wait for 2 pulse cycles (2 × 1500ms)
    await new Promise<void>((r) => addTimer(r, 3000));
    if (skippedRef.current) return;

    setPhase("done");
    markDone();
  }, [welcomeMessage, addTimer, markDone]);

  // Start sequence (immediate or on visibility)
  useEffect(() => {
    if (!isActive || startedRef.current) return;

    if (!triggerOnVisible) {
      runSequence();
      return;
    }

    // IntersectionObserver for landing page
    if (!containerEl) return;

    // Immediate check: if already visible, start right away
    const rect = containerEl.getBoundingClientRect();
    const alreadyVisible =
      rect.top < window.innerHeight && rect.bottom > 0 &&
      rect.height > 0;
    if (alreadyVisible) {
      runSequence();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !startedRef.current) {
          observer.disconnect();
          runSequence();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(containerEl);

    return () => observer.disconnect();
  }, [isActive, triggerOnVisible, containerEl, runSequence]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
      abortRef.current?.abort();
    };
  }, [clearAllTimers]);

  return {
    phase,
    streamedText,
    showCursor: phase === "streaming",
    quickReplyStaggerIndex: staggerIndex,
    inputPulseActive: phase === "input-pulse",
    skipToEnd,
  };
}
