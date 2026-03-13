"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { InChatAuth } from "@/components/InChatAuth";
import { WelcomeScreen } from "@/components/test/WelcomeScreen";
import { QuestionScreen } from "@/components/test/QuestionScreen";
import { BlockTransition } from "@/components/test/BlockTransition";
import { AnalyzingScreen } from "@/components/test/AnalyzingScreen";
import { CompletionScreen } from "@/components/test/CompletionScreen";
import {
  ISSP_QUESTIONS,
  ISSP_SCALE_NAMES,
  ISSP_SCALE_ORDER,
  ISSP_BLOCK_INSIGHTS,
} from "@/lib/issp-config";

type CardPhase =
  | "loading"
  | "welcome"
  | "question"
  | "block_transition"
  | "auth_wall"
  | "migrating"
  | "analyzing"
  | "complete";

type StatusMessage = "analyzing" | "recorded" | "slow" | "fallback" | "fallback_timeout" | null;

const TOTAL_QUESTIONS = 35;
const TEXT_TIMEOUT_SLOW_MS = 5000;
const TEXT_TIMEOUT_ABORT_MS = 8000;

export function TestCardFlow() {
  const router = useRouter();

  // Core state
  const [phase, setPhase] = useState<CardPhase>("loading");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [sessionId, setSessionId] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [mode, setMode] = useState<"anonymous" | "authenticated">("anonymous");

  // UI state
  const [isLocked, setIsLocked] = useState(false);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [animationClass, setAnimationClass] = useState<"enter" | "exit" | null>("enter");
  const [migrateError, setMigrateError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Two-flow state
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
  const [fallbackActive, setFallbackActive] = useState(false);
  const transitioning = useRef(false);

  // Block transition state
  const [completedBlockIndex, setCompletedBlockIndex] = useState(0);

  // Error state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // API state
  const messagesHistory = useRef<{ role: string; content: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const initDone = useRef(false);
  const startPromiseRef = useRef<Promise<void> | null>(null);

  // ── Init ──
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Check for active test chat
        const { data: chat } = await supabase
          .from("chats")
          .select("id, test_state")
          .eq("chat_type", "test")
          .eq("status", "active")
          .maybeSingle();

        if (chat) {
          // Load messages
          const { data: dbMessages } = await supabase
            .from("messages")
            .select("role, content")
            .eq("chat_id", chat.id)
            .order("created_at", { ascending: true });

          messagesHistory.current = (dbMessages || []).map((m) => ({
            role: m.role,
            content: m.content,
          }));

          const testState = chat.test_state as { current_question?: number; status?: string } | null;
          const cq = testState?.current_question ?? 0;

          setChatId(chat.id);
          setMode("authenticated");

          // Test completed or at Q35 — go to analyzing
          if (cq >= 35 || testState?.status === "completed") {
            setPhase("analyzing");
            return;
          }

          setCurrentQuestionIndex(cq);
          setPhase("question");
          return;
        }
      }

      // Check storage for anonymous session
      let savedSessionId: string | null = null;
      try {
        savedSessionId =
          sessionStorage.getItem("issp_session_id") ||
          localStorage.getItem("issp_session_id");
      } catch {
        // storage unavailable
      }

      if (savedSessionId) {
        // If user is authenticated + has session_id → auto-migrate
        if (user) {
          try {
            const migrateRes = await fetch("/api/test/migrate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ session_id: savedSessionId }),
            });

            if (migrateRes.ok) {
              const migrateData = await migrateRes.json();
              const newChatId = migrateData.chat_id;

              const { data: dbMessages } = await supabase
                .from("messages")
                .select("role, content")
                .eq("chat_id", newChatId)
                .order("created_at", { ascending: true });

              messagesHistory.current = (dbMessages || []).map((m) => ({
                role: m.role,
                content: m.content,
              }));

              // Get test_state for current_question
              const { data: chatData } = await supabase
                .from("chats")
                .select("test_state")
                .eq("id", newChatId)
                .single();

              const testState = chatData?.test_state as { current_question?: number; status?: string } | null;
              const cq = testState?.current_question ?? 34;

              setChatId(newChatId);
              setMode("authenticated");
              try {
                sessionStorage.removeItem("issp_session_id");
                localStorage.removeItem("issp_session_id");
              } catch { /* ignore */ }

              // Test completed or at Q35 — go to analyzing
              if (cq >= 35 || testState?.status === "completed") {
                setPhase("analyzing");
                return;
              }

              setCurrentQuestionIndex(cq);
              setPhase("question");
              return;
            }
          } catch {
            // Migration failed — fall through to anonymous restore
          }
        }

        // Restore anonymous session
        const res = await fetch(
          `/api/test?session_id=${encodeURIComponent(savedSessionId)}`
        );
        if (res.ok) {
          const data = await res.json();

          // Session finished or migrated — clean up and show welcome
          if (data.status === "migrated" || data.status === "completed") {
            try {
              sessionStorage.removeItem("issp_session_id");
              localStorage.removeItem("issp_session_id");
            } catch { /* ignore */ }
            setPhase("welcome");
            return;
          }

          messagesHistory.current = data.messages || [];
          setSessionId(savedSessionId);
          const cq = data.current_question || 0;
          setCurrentQuestionIndex(cq);

          // If not started yet — show welcome instead of empty question
          if (cq === 0 && (!data.messages || data.messages.length === 0)) {
            setPhase("welcome");
          } else {
            setPhase("question");
          }
          return;
        } else {
          try {
            sessionStorage.removeItem("issp_session_id");
            localStorage.removeItem("issp_session_id");
          } catch { /* ignore */ }
        }
      }

      setPhase("welcome");
    }

    init();
  }, []);

  // ── SSE Consumer (silent — no AI reaction rendering) ──
  const consumeSSE = useCallback(async (
    response: Response,
  ): Promise<{
    fullText: string;
    requiresAuth: boolean;
    testComplete: boolean;
    resultId: string | null;
    answerConfirmed: boolean;
    nextQuestion: number | null;
    confirmedScore: number | null;
    answerRejected: boolean;
    chatId: string | null;
  }> => {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Нет потока ответа");

    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let requiresAuth = false;
    let testComplete = false;
    let gotResultId: string | null = null;
    let answerConfirmed = false;
    let nextQuestion: number | null = null;
    let confirmedScore: number | null = null;
    let answerRejected = false;
    let gotChatId: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine.startsWith("data: ")) continue;

        try {
          const data = JSON.parse(trimmedLine.slice(6));

          if (data.type === "delta") {
            fullText += data.content;
          } else if (data.type === "requires_auth") {
            requiresAuth = true;
          } else if (data.type === "test_complete") {
            testComplete = true;
            gotResultId = data.result_id;
          } else if (data.type === "answer_confirmed") {
            answerConfirmed = true;
            nextQuestion = data.next_question;
            confirmedScore = data.score;
          } else if (data.type === "calculating") {
            testComplete = true;
          } else if (data.type === "answer_rejected") {
            answerRejected = true;
          } else if (data.type === "chat_id") {
            gotChatId = data.chat_id;
          } else if (data.type === "error") {
            console.error("[TestCardFlow] SSE error:", data.message);
          }
        } catch {
          // skip malformed JSON
        }
      }
    }

    return {
      fullText, requiresAuth, testComplete, resultId: gotResultId,
      answerConfirmed, nextQuestion, confirmedScore, answerRejected,
      chatId: gotChatId,
    };
  }, []);

  // ── Handle Start ──
  const handleStart = useCallback(async () => {
    if (isStarting) return;
    setIsStarting(true);

    const newSessionId = crypto.randomUUID();
    try {
      sessionStorage.setItem("issp_session_id", newSessionId);
      localStorage.setItem("issp_session_id", newSessionId);
    } catch {
      // ignore
    }

    setSessionId(newSessionId);

    // Show first question IMMEDIATELY
    setCurrentQuestionIndex(0);
    setAnimationClass("enter");
    setPhase("question");

    // Fire-and-forget: create session in background
    startPromiseRef.current = (async () => {
      try {
        const body = {
          message: "Готов, начнём",
          test_slug: "issp",
          session_id: newSessionId,
          messages: [],
        };

        const response = await fetch("/api/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error("Ошибка создания сессии");

        const result = await consumeSSE(response);

        // Server auto-created a chat for authenticated user — switch to authenticated mode
        if (result.chatId) {
          setChatId(result.chatId);
          setMode("authenticated");
          try {
            sessionStorage.removeItem("issp_session_id");
            localStorage.removeItem("issp_session_id");
          } catch { /* ignore */ }
        }

        messagesHistory.current = [
          { role: "user", content: "Готов, начнём" },
          { role: "assistant", content: result.fullText },
        ];
      } catch (err) {
        console.error("[TestCardFlow] Start message failed:", err);
      }
    })();
  }, [isStarting, consumeSSE]);

  // ── Auth flow ──
  const handleRequiresAuth = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await doMigrate();
    } else {
      setPhase("auth_wall");
    }
  }, []);

  const handleAuthSuccess = useCallback(async () => {
    await doMigrate();
  }, []);

  async function doMigrate() {
    setPhase("migrating");
    setMigrateError(null);

    try {
      const res = await fetch("/api/test/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Ошибка миграции");
      }

      const data = await res.json();
      setChatId(data.chat_id);
      setMode("authenticated");

      try {
        sessionStorage.removeItem("issp_session_id");
        localStorage.removeItem("issp_session_id");
      } catch {
        // ignore
      }

      // Show last question
      setIsLocked(false);
      setSelectedScore(null);
      setStatusMessage(null);
      setFallbackActive(false);
      setCurrentQuestionIndex(TOTAL_QUESTIONS - 1);
      setAnimationClass("enter");
      setPhase("question");
    } catch (err) {
      setMigrateError((err as Error).message);
      setPhase("auth_wall");
    }
  }

  // ── Special cases check (block boundary, auth wall, test complete) ──
  const handleSpecialCases = useCallback((nextIndex: number): boolean => {
    // Test complete
    if (nextIndex >= TOTAL_QUESTIONS) {
      setPhase("analyzing");
      return true;
    }

    // Block boundary (every 5 questions)
    const prevBlock = Math.floor((nextIndex - 1) / 5);
    const nextBlock = Math.floor(nextIndex / 5);
    if (nextBlock > prevBlock && nextIndex < TOTAL_QUESTIONS) {
      setCompletedBlockIndex(prevBlock);
      setPhase("block_transition");
      return true;
    }

    // Auth wall at Q34 for anonymous
    if (nextIndex === 34 && mode === "anonymous") {
      handleRequiresAuth();
      return true;
    }

    return false;
  }, [mode, handleRequiresAuth]);

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
        }),
      });

      if (response.status === 409) {
        const data = await response.json();
        if (data.test_complete) {
          if (data.result_id) setResultId(data.result_id);
          setPhase(data.result_ready ? "complete" : "analyzing");
        }
        console.warn("[ISSP] Question desync:", data.server_question);
        return;
      }

      if (!response.ok) throw new Error("API error");

      const data = await response.json();

      // Server returned chat_id (auto-created for authenticated user)
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
      console.error("[ISSP] submitQuickAnswer error:", err);
      setErrorMessage("Не удалось сохранить ответ");
      setTimeout(() => setErrorMessage(null), 5000);
    }
  }, [chatId, sessionId, handleRequiresAuth]);

  // ── Handle Quick Answer (Flow 1: ~1s) ──
  const handleQuickAnswer = useCallback(async (score: number) => {
    if (transitioning.current || isLocked) return;
    transitioning.current = true;

    // Wait for start message if still in progress
    if (startPromiseRef.current) {
      await startPromiseRef.current;
      startPromiseRef.current = null;
    }

    // Reset fallback state if active
    if (fallbackActive) {
      setFallbackActive(false);
      setStatusMessage(null);
    }

    setSelectedScore(score);
    setIsLocked(true);

    // Capture question index BEFORE any async — stale closure protection
    const questionIdx = currentQuestionIndex;

    // Update messages history
    messagesHistory.current.push(
      { role: "user", content: String(score) },
    );

    // 370ms: fire-and-forget API call + start exit animation
    setTimeout(() => {
      // Fire-and-forget — questionIdx passed as argument, NOT read from state
      submitQuickAnswer(score, questionIdx);

      setAnimationClass("exit");

      // 280ms: exit done → check special cases or advance
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

        // 350ms: enter done → reset animation class
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

    // Wait for start message if still in progress
    if (startPromiseRef.current) {
      await startPromiseRef.current;
      startPromiseRef.current = null;
    }

    // Capture question index BEFORE async — stale closure protection
    const questionIdx = currentQuestionIndex;

    setIsLocked(true);
    setStatusMessage("analyzing");

    // Timeout watchers
    const controller = new AbortController();
    abortRef.current = controller;
    const slowTimeoutId = setTimeout(() => {
      setStatusMessage("slow");
    }, TEXT_TIMEOUT_SLOW_MS);
    const abortTimeoutId = setTimeout(() => {
      controller.abort();
    }, TEXT_TIMEOUT_ABORT_MS);

    try {
      // Send text answer to /api/test (existing SSE endpoint)
      const body = {
        test_slug: "issp",
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

      // Handle 409 — question_index mismatch
      if (response.status === 409) {
        const data = await response.json();
        console.warn("[TestCardFlow] Question mismatch, syncing to", data.server_question);

        if (data.test_complete) {
          if (data.result_id) setResultId(data.result_id);
          setPhase(data.result_ready ? "complete" : "analyzing");
          transitioning.current = false;
          return;
        }
        if (data.server_question >= 35) {
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

      // Consume SSE silently — no AI reaction rendering
      const result = await consumeSSE(response);

      // Update messages history
      messagesHistory.current.push(
        { role: "user", content: text },
        { role: "assistant", content: result.fullText }
      );

      // Server returned chat_id (auto-created)
      if (result.chatId) {
        setChatId(result.chatId);
        setMode("authenticated");
        try {
          sessionStorage.removeItem("issp_session_id");
          localStorage.removeItem("issp_session_id");
        } catch { /* ignore */ }
      }

      // Test complete (Q35)
      if (result.testComplete) {
        if (result.resultId) setResultId(result.resultId);
        setStatusMessage("recorded");
        setTimeout(() => setPhase("analyzing"), 500);
        transitioning.current = false;
        return;
      }

      // Auth required
      if (result.requiresAuth && !result.answerConfirmed) {
        setStatusMessage(null);
        handleRequiresAuth();
        transitioning.current = false;
        return;
      }

      // Answer confirmed — show "Ответ записан ✓" then transition
      if (result.answerConfirmed && result.nextQuestion !== null) {
        setStatusMessage("recorded");

        // 500ms hold "Ответ записан"
        setTimeout(() => {
          if (result.requiresAuth) {
            handleRequiresAuth();
            transitioning.current = false;
            return;
          }

          setAnimationClass("exit");

          // 280ms: exit done → advance
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

            // 350ms: enter done
            setTimeout(() => {
              setAnimationClass(null);
              transitioning.current = false;
            }, 350);
          }, 280);
        }, 500);
        return;
      }

      // Answer rejected — fallback to quick buttons
      if (result.answerRejected) {
        activateFallback("fallback");
        return;
      }

      // Fallback: requires_auth without answer_confirmed
      if (result.requiresAuth) {
        setStatusMessage(null);
        handleRequiresAuth();
        transitioning.current = false;
        return;
      }

      // Unknown state — fallback
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
  }, [isLocked, currentQuestionIndex, mode, sessionId, chatId, consumeSSE, handleSpecialCases, handleRequiresAuth]);

  function activateFallback(type: "fallback" | "fallback_timeout") {
    setStatusMessage(type);
    setFallbackActive(true);
    setIsLocked(false);
    transitioning.current = false;
  }

  // ── Block transition continue ──
  const handleBlockContinue = useCallback(() => {
    const nextIndex = (completedBlockIndex + 1) * 5;
    setCurrentQuestionIndex(nextIndex);
    setIsLocked(false);
    setSelectedScore(null);
    setStatusMessage(null);
    setFallbackActive(false);
    setAnimationClass("enter");
    setPhase("question");
  }, [completedBlockIndex]);

  // ── Result ready (from polling) ──
  const handleResultReady = useCallback((newResultId: string) => {
    setResultId(newResultId);
    setPhase("complete");
  }, []);

  // ── View results ──
  const handleViewResults = useCallback(() => {
    if (resultId) {
      router.push(`/test/results/${resultId}`);
    }
  }, [resultId, router]);

  // ── Render ──
  const question = ISSP_QUESTIONS[currentQuestionIndex];
  const scaleKey = question?.scale || ISSP_SCALE_ORDER[0];
  const scaleName = ISSP_SCALE_NAMES[scaleKey] || "";

  if (phase === "loading") {
    return (
      <div className="tc-page">
        <div className="tc-frame">
          <div className="tc-loading">
            <div className="tc-spinner" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tc-page">
      <div className="tc-frame">
        {phase === "welcome" && (
          <WelcomeScreen onStart={handleStart} isStarting={isStarting} />
        )}

        {phase === "question" && question && (
          <QuestionScreen
            question={question}
            questionIndex={currentQuestionIndex}
            totalQuestions={TOTAL_QUESTIONS}
            scaleName={scaleName}
            isLocked={isLocked}
            selectedScore={selectedScore}
            animationClass={animationClass}
            transitioning={transitioning.current}
            statusMessage={statusMessage}
            fallbackActive={fallbackActive}
            onQuickAnswer={handleQuickAnswer}
            onTextAnswer={handleTextAnswer}
          />
        )}

        {/* Error toast */}
        {errorMessage && (
          <div style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#dc2626",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 12,
            fontSize: 14,
            zIndex: 1000,
            maxWidth: "90vw",
            textAlign: "center",
          }}>
            {errorMessage}
          </div>
        )}

        {phase === "block_transition" && (
          <BlockTransition
            blockIndex={completedBlockIndex}
            completedScaleName={ISSP_SCALE_NAMES[ISSP_SCALE_ORDER[completedBlockIndex]] || ""}
            nextScaleName={ISSP_SCALE_NAMES[ISSP_SCALE_ORDER[completedBlockIndex + 1]] || ""}
            insight={ISSP_BLOCK_INSIGHTS[completedBlockIndex] || ""}
            onContinue={handleBlockContinue}
          />
        )}

        {phase === "analyzing" && (
          <AnalyzingScreen resultId={resultId} onComplete={handleResultReady} />
        )}

        {phase === "complete" && (
          <CompletionScreen onViewResults={handleViewResults} />
        )}

        {/* Auth overlay */}
        {phase === "auth_wall" && (
          <div className="tc-auth-overlay">
            <div className="tc-auth-overlay-text">
              <strong>Остался 1 вопрос</strong>
              Авторизуйся, чтобы сохранить результаты
            </div>
            {migrateError && (
              <div className="tc-error" style={{ marginBottom: 16 }}>
                {migrateError}
              </div>
            )}
            <InChatAuth onAuthSuccess={handleAuthSuccess} />
          </div>
        )}

        {/* Migrating overlay */}
        {phase === "migrating" && (
          <div className="tc-auth-overlay">
            <div className="tc-migrating">
              <div className="tc-spinner" />
              <span>Сохраняем прогресс...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
