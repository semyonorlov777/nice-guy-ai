import { useCallback, type MutableRefObject } from "react";
import type { TestConfig } from "@/lib/test-config";
import type { CardPhase, StatusMessage, DebugLogEntry } from "./types";
import { TEXT_TIMEOUT_SLOW_MS, TEXT_TIMEOUT_ABORT_MS } from "./types";
import { consumeSSE } from "./consumeSSE";

interface UseTestAnswersParams {
  testConfig: TestConfig;
  mode: "anonymous" | "authenticated";
  sessionId: string;
  chatId: string | null;
  isLocked: boolean;
  fallbackActive: boolean;
  currentQuestionIndex: number;
  totalQuestions: number;
  questionsPerBlock: number;
  authWallQuestion: number | null;
  isDebug: boolean;
  transitioning: MutableRefObject<boolean>;
  startPromiseRef: MutableRefObject<Promise<void> | null>;
  startFailedRef: MutableRefObject<boolean>;
  lastAnswerPromiseRef: MutableRefObject<Promise<void> | null>;
  abortRef: MutableRefObject<AbortController | null>;
  messagesHistory: MutableRefObject<{ role: string; content: string }[]>;
  debugLogRef: MutableRefObject<DebugLogEntry[]>;
  handleRequiresAuth: () => void;
  setPhase: (phase: CardPhase | ((prev: CardPhase) => CardPhase)) => void;
  setMode: (mode: "anonymous" | "authenticated") => void;
  setChatId: (id: string | null) => void;
  setCurrentQuestionIndex: (idx: number) => void;
  setIsLocked: (locked: boolean) => void;
  setSelectedScore: (score: number | null) => void;
  setAnimationClass: (cls: "enter" | "exit" | null) => void;
  setStatusMessage: (msg: StatusMessage) => void;
  setFallbackActive: (active: boolean) => void;
  setResultId: (id: string | null) => void;
  setErrorMessage: (msg: string | null) => void;
  setCompletedBlockIndex: (idx: number) => void;
}

export function useTestAnswers({
  testConfig,
  mode,
  sessionId,
  chatId,
  isLocked,
  fallbackActive,
  currentQuestionIndex,
  totalQuestions,
  questionsPerBlock,
  authWallQuestion,
  isDebug,
  transitioning,
  startPromiseRef,
  startFailedRef,
  lastAnswerPromiseRef,
  abortRef,
  messagesHistory,
  debugLogRef,
  handleRequiresAuth,
  setPhase,
  setMode,
  setChatId,
  setCurrentQuestionIndex,
  setIsLocked,
  setSelectedScore,
  setAnimationClass,
  setStatusMessage,
  setFallbackActive,
  setResultId,
  setErrorMessage,
  setCompletedBlockIndex,
}: UseTestAnswersParams) {

  // ── Special cases check (block boundary, auth wall, test complete) ──
  const handleSpecialCases = useCallback((nextIndex: number): boolean => {
    if (nextIndex >= totalQuestions) {
      setPhase("analyzing");
      return true;
    }

    const prevBlock = Math.floor((nextIndex - 1) / questionsPerBlock);
    const nextBlock = Math.floor(nextIndex / questionsPerBlock);
    if (questionsPerBlock > 0 && nextBlock > prevBlock && nextIndex < totalQuestions) {
      setCompletedBlockIndex(prevBlock);
      setPhase("block_transition");
      return true;
    }

    if (authWallQuestion !== null && nextIndex === authWallQuestion && mode === "anonymous") {
      handleRequiresAuth();
      return true;
    }

    return false;
  }, [mode, handleRequiresAuth, totalQuestions, questionsPerBlock, authWallQuestion]);

  // ── Fire-and-forget: submit quick answer to server ──
  const submitQuickAnswer = useCallback(async (score: number, questionIndex: number) => {
    try {
      const response = await fetch("/api/test/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          session_id: sessionId || undefined,
          question_index: questionIndex,
          score,
          test_slug: testConfig.slug,
        }),
      });

      if (response.status === 409) {
        const data = await response.json();
        if (data.test_complete) {
          if (data.result_id) setResultId(data.result_id);
          setPhase(data.result_ready ? "complete" : "analyzing");
        } else if (typeof data.server_question === "number") {
          setCurrentQuestionIndex(data.server_question);
        }
        console.warn("[Test] Question desync, synced to:", data.server_question);
        if (isDebug) {
          debugLogRef.current.push({ question: questionIndex, sentScore: score, serverConfirmed: false, serverQuestion: data.server_question ?? null, timestamp: Date.now() });
        }
        return;
      }

      if (!response.ok) {
        if (isDebug) {
          debugLogRef.current.push({ question: questionIndex, sentScore: score, serverConfirmed: false, serverQuestion: null, timestamp: Date.now() });
        }
        throw new Error("API error");
      }

      const data = await response.json();

      if (isDebug) {
        debugLogRef.current.push({ question: questionIndex, sentScore: score, serverConfirmed: true, serverQuestion: data.current_question ?? null, timestamp: Date.now() });
      }

      if (data.chat_id && !chatId) {
        setChatId(data.chat_id);
        setMode("authenticated");
        try {
          sessionStorage.removeItem("issp_session_id");
          localStorage.removeItem("issp_session_id");
        } catch { /* ignore */ }
      }

      if (data.test_complete) {
        setPhase("analyzing");
      }
      if (data.requires_auth) {
        handleRequiresAuth();
      }
    } catch (err) {
      console.error("[Test] submitQuickAnswer error:", err);
      if (isDebug) {
        debugLogRef.current.push({ question: questionIndex, sentScore: score, serverConfirmed: false, serverQuestion: null, timestamp: Date.now() });
      }
      setErrorMessage("Не удалось сохранить ответ. Попробуйте ещё раз.");
      setPhase((prev) => prev === "analyzing" ? "question" : prev);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  }, [chatId, sessionId, handleRequiresAuth, isDebug]);

  // ── Handle Quick Answer (Flow 1: ~1s) ──
  const handleQuickAnswer = useCallback(async (score: number) => {
    if (transitioning.current || isLocked) return;
    transitioning.current = true;

    if (startPromiseRef.current) {
      await startPromiseRef.current;
      startPromiseRef.current = null;
    }

    if (startFailedRef.current) {
      transitioning.current = false;
      setErrorMessage("Не удалось создать сессию. Перезагрузите страницу.");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    if (fallbackActive) {
      setFallbackActive(false);
      setStatusMessage(null);
    }

    setSelectedScore(score);
    setIsLocked(true);

    const questionIdx = currentQuestionIndex;

    messagesHistory.current.push(
      { role: "user", content: String(score) },
    );

    setTimeout(() => {
      const answerPromise = submitQuickAnswer(score, questionIdx);
      lastAnswerPromiseRef.current = answerPromise;

      setAnimationClass("exit");

      setTimeout(() => {
        const nextIndex = questionIdx + 1;

        if (handleSpecialCases(nextIndex)) {
          transitioning.current = false;
          return;
        }

        setCurrentQuestionIndex(nextIndex);
        setAnimationClass("enter");
        setIsLocked(false);
        setSelectedScore(null);

        setTimeout(() => {
          setAnimationClass(null);
          transitioning.current = false;
        }, 350);
      }, 280);
    }, 370);
  }, [isLocked, fallbackActive, currentQuestionIndex, submitQuickAnswer, handleSpecialCases]);

  // ── Handle Text Answer (Flow 2: ~3.5s) ──
  const handleTextAnswer = useCallback(async (text: string) => {
    if (transitioning.current || isLocked) return;
    transitioning.current = true;

    if (startPromiseRef.current) {
      await startPromiseRef.current;
      startPromiseRef.current = null;
    }

    if (startFailedRef.current) {
      transitioning.current = false;
      setErrorMessage("Не удалось создать сессию. Перезагрузите страницу.");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    const questionIdx = currentQuestionIndex;

    setIsLocked(true);
    setStatusMessage("analyzing");

    const controller = new AbortController();
    abortRef.current = controller;
    const slowTimeoutId = setTimeout(() => {
      setStatusMessage("slow");
    }, TEXT_TIMEOUT_SLOW_MS);
    const abortTimeoutId = setTimeout(() => {
      controller.abort();
    }, TEXT_TIMEOUT_ABORT_MS);

    try {
      const body = {
        test_slug: testConfig.slug,
        answer_type: "text",
        answer_text: text,
        question_index: questionIdx,
        ...(mode === "anonymous"
          ? { session_id: sessionId, messages: messagesHistory.current }
          : { chat_id: chatId }),
      };

      const response = await fetch("/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(slowTimeoutId);
      clearTimeout(abortTimeoutId);
      abortRef.current = null;

      // Handle 409
      if (response.status === 409) {
        const data = await response.json();
        console.warn("[TestCardFlow] Question mismatch, syncing to", data.server_question);

        if (data.test_complete) {
          if (data.result_id) setResultId(data.result_id);
          setPhase(data.result_ready ? "complete" : "analyzing");
          transitioning.current = false;
          return;
        }
        if (data.server_question >= totalQuestions) {
          setPhase("analyzing");
          transitioning.current = false;
          return;
        }

        setCurrentQuestionIndex(data.server_question);
        setIsLocked(false);
        setStatusMessage(null);
        transitioning.current = false;
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Ошибка сервера: ${response.status}`);
      }

      const result = await consumeSSE(response);

      messagesHistory.current.push(
        { role: "user", content: text },
        { role: "assistant", content: result.fullText },
      );

      if (result.chatId) {
        setChatId(result.chatId);
        setMode("authenticated");
        try {
          sessionStorage.removeItem("issp_session_id");
          localStorage.removeItem("issp_session_id");
        } catch { /* ignore */ }
      }

      if (result.testComplete) {
        if (result.resultId) setResultId(result.resultId);
        setStatusMessage("recorded");
        setTimeout(() => setPhase("analyzing"), 500);
        transitioning.current = false;
        return;
      }

      if (result.requiresAuth && !result.answerConfirmed) {
        setStatusMessage(null);
        handleRequiresAuth();
        transitioning.current = false;
        return;
      }

      if (result.answerConfirmed && result.nextQuestion !== null) {
        setStatusMessage("recorded");

        setTimeout(() => {
          if (result.requiresAuth) {
            handleRequiresAuth();
            transitioning.current = false;
            return;
          }

          setAnimationClass("exit");

          setTimeout(() => {
            const nextIndex = result.nextQuestion!;

            if (handleSpecialCases(nextIndex)) {
              transitioning.current = false;
              return;
            }

            setCurrentQuestionIndex(nextIndex);
            setAnimationClass("enter");
            setIsLocked(false);
            setStatusMessage(null);
            setSelectedScore(null);

            setTimeout(() => {
              setAnimationClass(null);
              transitioning.current = false;
            }, 350);
          }, 280);
        }, 500);
        return;
      }

      if (result.answerRejected) {
        activateFallback("fallback");
        return;
      }

      if (result.requiresAuth) {
        setStatusMessage(null);
        handleRequiresAuth();
        transitioning.current = false;
        return;
      }

      activateFallback("fallback");
    } catch (err) {
      clearTimeout(slowTimeoutId);
      clearTimeout(abortTimeoutId);

      if ((err as Error).name === "AbortError") {
        activateFallback("fallback_timeout");
      } else {
        console.error("[TestCardFlow] Text answer error:", err);
        activateFallback("fallback");
      }
    }
  }, [isLocked, currentQuestionIndex, mode, sessionId, chatId, handleSpecialCases, handleRequiresAuth]);

  function activateFallback(type: "fallback" | "fallback_timeout") {
    setStatusMessage(type);
    setFallbackActive(true);
    setIsLocked(false);
    transitioning.current = false;
  }

  return { handleQuickAnswer, handleTextAnswer, handleSpecialCases };
}
