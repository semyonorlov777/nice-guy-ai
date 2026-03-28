import { useState, useCallback, type MutableRefObject } from "react";
import type { TestConfig } from "@/lib/test-config";
import type { CardPhase, SSEResult } from "./types";
import type { TestResultSummary } from "@/components/test/HistoryScreen";
import { consumeSSE } from "./consumeSSE";

interface UseTestSessionParams {
  testConfig: TestConfig;
  storageKey: string;
  messagesHistory: MutableRefObject<{ role: string; content: string }[]>;
  startPromiseRef: MutableRefObject<Promise<void> | null>;
  startFailedRef: MutableRefObject<boolean>;
  setPhase: (phase: CardPhase) => void;
  setMode: (mode: "anonymous" | "authenticated") => void;
  setSessionId: (id: string) => void;
  setChatId: (id: string | null) => void;
  setCurrentQuestionIndex: (idx: number) => void;
  setAnimationClass: (cls: "enter" | "exit" | null) => void;
  setTestResults: (results: TestResultSummary[]) => void;
}

export function useTestSession({
  testConfig,
  storageKey,
  messagesHistory,
  startPromiseRef,
  startFailedRef,
  setPhase,
  setMode,
  setSessionId,
  setChatId,
  setCurrentQuestionIndex,
  setAnimationClass,
  setTestResults,
}: UseTestSessionParams) {
  const [isStarting, setIsStarting] = useState(false);

  const startNewTest = useCallback(async () => {
    setIsStarting(true);

    const newSessionId = crypto.randomUUID();
    try {
      sessionStorage.setItem(storageKey, newSessionId);
      localStorage.setItem(storageKey, newSessionId);
    } catch {
      // ignore
    }

    setSessionId(newSessionId);
    setCurrentQuestionIndex(0);
    setAnimationClass("enter");
    setPhase("question");

    startFailedRef.current = false;
    startPromiseRef.current = (async () => {
      try {
        // Typed-answer tests: questions are pre-defined in testConfig,
        // no legacy AI start needed. Session/chat auto-created on first answer.
        if (testConfig.questions && testConfig.questions.length > 0) {
          return;
        }

        // Legacy mode: AI generates questions via SSE streaming
        const body = {
          message: "Готов, начнём",
          test_slug: testConfig.slug,
          session_id: newSessionId,
          messages: [],
        };

        const response = await fetch("/api/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error("Ошибка создания сессии");

        const result: SSEResult = await consumeSSE(response);

        if (result.chatId) {
          setChatId(result.chatId);
          setMode("authenticated");
          try {
            sessionStorage.removeItem(storageKey);
            localStorage.removeItem(storageKey);
          } catch { /* ignore */ }
        }

        messagesHistory.current = [
          { role: "user", content: "Готов, начнём" },
          { role: "assistant", content: result.fullText },
        ];
      } catch (err) {
        console.error("[TestCardFlow] Start message failed:", err);
        startFailedRef.current = true;
      }
    })();
  }, []);

  const handleStart = useCallback(() => {
    if (isStarting) return;
    startNewTest();
  }, [isStarting, startNewTest]);

  const handleRetake = useCallback(() => {
    if (isStarting) return;
    setChatId(null);
    setTestResults([]);
    startNewTest();
  }, [isStarting, startNewTest]);

  return { isStarting, handleStart, handleRetake };
}
