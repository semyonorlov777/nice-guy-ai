"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type ActionState = "idle" | "typing" | "sent" | "error";

const SENT_DURATION = 1200;
const ERROR_SHOW_DURATION = 2500;
const ERROR_FADE_DURATION = 500;

export function useInputBar() {
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorFading, setErrorFading] = useState(false);

  const sentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (sentTimer.current) { clearTimeout(sentTimer.current); sentTimer.current = null; }
    if (errorTimer.current) { clearTimeout(errorTimer.current); errorTimer.current = null; }
    if (errorFadeTimer.current) { clearTimeout(errorFadeTimer.current); errorFadeTimer.current = null; }
  }, []);

  useEffect(() => clearAllTimers, [clearAllTimers]);

  const setIdle = useCallback(() => {
    clearAllTimers();
    setActionState("idle");
    setErrorMessage(null);
    setErrorFading(false);
  }, [clearAllTimers]);

  const setTyping = useCallback(() => {
    if (sentTimer.current) return; // don't interrupt sent state
    setActionState("typing");
  }, []);

  const setSent = useCallback(() => {
    clearAllTimers();
    setActionState("sent");
    setErrorMessage(null);
    setErrorFading(false);
    sentTimer.current = setTimeout(() => {
      setActionState("idle");
      sentTimer.current = null;
    }, SENT_DURATION);
  }, [clearAllTimers]);

  const dismissError = useCallback(() => {
    clearAllTimers();
    setActionState("idle");
    setErrorMessage(null);
    setErrorFading(false);
  }, [clearAllTimers]);

  const setError = useCallback((message: string) => {
    clearAllTimers();
    setActionState("error");
    setErrorMessage(message);
    setErrorFading(false);

    // After animation, return button to idle
    setTimeout(() => setActionState("idle"), 400);

    // Auto-dismiss error bar after ERROR_SHOW_DURATION
    errorTimer.current = setTimeout(() => {
      setErrorFading(true);
      errorFadeTimer.current = setTimeout(() => {
        setActionState("idle");
        setErrorMessage(null);
        setErrorFading(false);
        errorTimer.current = null;
        errorFadeTimer.current = null;
      }, ERROR_FADE_DURATION);
    }, ERROR_SHOW_DURATION);
  }, [clearAllTimers]);

  return {
    actionState,
    errorMessage,
    errorFading,
    setIdle,
    setTyping,
    setSent,
    setError,
    dismissError,
  };
}
