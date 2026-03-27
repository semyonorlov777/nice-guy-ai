"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";
import { AuthSheet } from "@/components/AuthSheet";
import { WelcomeScreen } from "@/components/test/WelcomeScreen";
import { QuestionScreen } from "@/components/test/QuestionScreen";
import { BlockTransition } from "@/components/test/BlockTransition";
import { AnalyzingScreen } from "@/components/test/AnalyzingScreen";
import { CompletionScreen } from "@/components/test/CompletionScreen";
import { HistoryScreen, type TestResultSummary } from "@/components/test/HistoryScreen";
import type { TestConfig } from "@/lib/test-config";
import { getScaleOrder, getScaleNames } from "@/lib/test-config";

type CardPhase =
  | "loading"
  | "welcome"
  | "question"
  | "block_transition"
  | "auth_wall"
  | "migrating"
  | "history"
  | "analyzing"
  | "complete";

type StatusMessage = "analyzing" | "recorded" | "slow" | "fallback" | "fallback_timeout" | null;

const TEXT_TIMEOUT_SLOW_MS = 5000;
const TEXT_TIMEOUT_ABORT_MS = 8000;

export function TestCardFlow({ testConfig }: { testConfig: TestConfig }) {
  // Derived from config
  const TOTAL_QUESTIONS = testConfig.total_questions;
  const AUTH_WALL_QUESTION = testConfig.ui_config.auth_wall_question;
  const QUESTIONS_PER_BLOCK = testConfig.ui_config.questions_per_block;
  const scaleOrder = getScaleOrder(testConfig);
  const scaleNames = getScaleNames(testConfig);
  const blockInsights = testConfig.ui_config.block_insights;
  const storageKey = `test_session_${testConfig.slug}`;
  const router = useRouter();
  const pathname = usePathname();
  const programSlug = pathname.match(/^\/program\/([^/]+)\//)?.[1] ?? DEFAULT_PROGRAM_SLUG;
  const searchParams = useSearchParams();
  const isDebug = searchParams.get("debug") === "true";

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
  const [authSheetOpen, setAuthSheetOpen] = useState(false);

  // Two-flow state
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
  const [fallbackActive, setFallbackActive] = useState(false);
  const transitioning = useRef(false);

  // Block transition state
  const [completedBlockIndex, setCompletedBlockIndex] = useState(0);

  // History state
  const [testResults, setTestResults] = useState<TestResultSummary[]>([]);

  // Error state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // API state
  const messagesHistory = useRef<{ role: string; content: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const initDone = useRef(false);
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const startFailedRef = useRef(false);
  const lastAnswerPromiseRef = useRef<Promise<void> | null>(null);
  const migratingRef = useRef(false);
  const debugLogRef = useRef<Array<{
    question: number;
    sentScore: number;
    serverConfirmed: boolean;
    serverQuestion: number | null;
    timestamp: number;
  }>>([]);

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
        setMode("authenticated");

        // Load active chat and completed results in parallel
        const [chatResult, resultsResult] = await Promise.all([
          supabase
            .from("chats")
            .select("id, test_state")
            .eq("chat_type", "test")
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .maybeSingle(),
          supabase
            .from("test_results")
            .select("id, total_score, created_at, interpretation")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        ]);

        const chat = chatResult.data;
        const existingResults = resultsResult.data;

        // Scenario 3: active chat with real progress → restore
        const testState = chat?.test_state as { current_question?: number; status?: string; answers?: unknown[] } | null;
        const hasRealProgress = chat && Array.isArray(testState?.answers) && testState!.answers.length > 0;

        if (chat && hasRealProgress) {
          const { data: dbMessages } = await supabase
            .from("messages")
            .select("role, content")
            .eq("chat_id", chat.id)
            .order("created_at", { ascending: true });

          messagesHistory.current = (dbMessages || []).map((m) => ({
            role: m.role,
            content: m.content,
          }));

          const cq = testState?.current_question ?? 0;

          setChatId(chat.id);

          // Test completed or at last question — go to analyzing
          if (cq >= TOTAL_QUESTIONS || testState?.status === "completed") {
            setPhase("analyzing");
            return;
          }

          setCurrentQuestionIndex(cq);
          setPhase("question");
          return;
        }

        // Scenario 2: completed results exist → show history
        if (existingResults && existingResults.length > 0) {
          setTestResults(existingResults);
          setPhase("history");
          return;
        }

        // Scenario 1: new user → fall through to welcome
      }

      // Check storage for anonymous session
      let savedSessionId: string | null = null;
      try {
        savedSessionId =
          sessionStorage.getItem(storageKey) ||
          localStorage.getItem(storageKey) ||
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
                sessionStorage.removeItem(storageKey);
                localStorage.removeItem(storageKey);
                sessionStorage.removeItem("issp_session_id");
                localStorage.removeItem("issp_session_id");
              } catch { /* ignore */ }

              // Test completed or at last question — go to analyzing
              if (cq >= TOTAL_QUESTIONS || testState?.status === "completed") {
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

          // Auth wall: anonymous user at auth wall question+ must authenticate
          if (AUTH_WALL_QUESTION !== null && cq >= AUTH_WALL_QUESTION) {
            setPhase("auth_wall");
            setAuthSheetOpen(true);
            return;
          }

          // If not started yet — show welcome instead of empty question
          if (cq === 0 && (!data.messages || data.messages.length === 0)) {
            setPhase("welcome");
          } else {
            setPhase("question");
          }
          return;
        } else if (res.status === 404) {
          // Session not found on server — clean up stale storage
          try {
            sessionStorage.removeItem("issp_session_id");
            localStorage.removeItem("issp_session_id");
          } catch { /* ignore */ }
        } else {
          // Server error (500, timeout) — keep storage, user can retry on refresh
          console.warn("[Test] Failed to restore session (status:", res.status, "), keeping storage for retry");
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

  // ── Start new test (core logic, no guard) ──
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

    // Show first question IMMEDIATELY
    setCurrentQuestionIndex(0);
    setAnimationClass("enter");
    setPhase("question");

    // Fire-and-forget: create session in background
    startFailedRef.current = false;
    startPromiseRef.current = (async () => {
      try {
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
        startFailedRef.current = true;
      }
    })();
  }, [consumeSSE]);

  // ── Handle Start (WelcomeScreen — with double-click guard) ──
  const handleStart = useCallback(() => {
    if (isStarting) return;
    startNewTest();
  }, [isStarting, startNewTest]);

  // ── Handle Retake (HistoryScreen — reset + start) ──
  const handleRetake = useCallback(() => {
    if (isStarting) return;
    setChatId(null);
    setTestResults([]);
    startNewTest();
  }, [isStarting, startNewTest]);

  // ── Auth flow ──
  const doMigrate = useCallback(async () => {
    if (migratingRef.current) return;
    migratingRef.current = true;

    setPhase("migrating");
    setMigrateError(null);
    setAuthSheetOpen(false);

    try {
      // Wait for last fire-and-forget answer to complete (FIX 3: ensures all answers recorded)
      if (lastAnswerPromiseRef.current) {
        await lastAnswerPromiseRef.current;
        lastAnswerPromiseRef.current = null;
      }

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
      setSessionId("");
      setMode("authenticated");

      try {
        sessionStorage.removeItem("issp_session_id");
        localStorage.removeItem("issp_session_id");
      } catch {
        // ignore
      }

      // Show the question where server left off (usually Q34)
      const cq = typeof data.current_question === "number" ? data.current_question : TOTAL_QUESTIONS - 1;
      setIsLocked(false);
      setSelectedScore(null);
      setStatusMessage(null);
      setFallbackActive(false);
      setCurrentQuestionIndex(cq);
      setAnimationClass("enter");
      setPhase("question");
    } catch (err) {
      setMigrateError((err as Error).message);
      setPhase("auth_wall");
    } finally {
      migratingRef.current = false;
    }
  }, [sessionId]);

  const handleRequiresAuth = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await doMigrate();
    } else {
      setPhase("auth_wall");
      setAuthSheetOpen(true);
    }
  }, [doMigrate]);

  const handleAuthSuccess = useCallback(async () => {
    await doMigrate();
    router.refresh(); // layout перерендерится с sidebar
  }, [doMigrate, router]);

  // ── Special cases check (block boundary, auth wall, test complete) ──
  const handleSpecialCases = useCallback((nextIndex: number): boolean => {
    // Test complete
    if (nextIndex >= TOTAL_QUESTIONS) {
      setPhase("analyzing");
      return true;
    }

    // Block boundary
    const prevBlock = Math.floor((nextIndex - 1) / QUESTIONS_PER_BLOCK);
    const nextBlock = Math.floor(nextIndex / QUESTIONS_PER_BLOCK);
    if (QUESTIONS_PER_BLOCK > 0 && nextBlock > prevBlock && nextIndex < TOTAL_QUESTIONS) {
      setCompletedBlockIndex(prevBlock);
      setPhase("block_transition");
      return true;
    }

    // Auth wall for anonymous
    if (AUTH_WALL_QUESTION !== null && nextIndex === AUTH_WALL_QUESTION && mode === "anonymous") {
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
          test_slug: testConfig.slug,
        }),
      });

      if (response.status === 409) {
        const data = await response.json();
        if (data.test_complete) {
          if (data.result_id) setResultId(data.result_id);
          setPhase(data.result_ready ? "complete" : "analyzing");
        } else if (typeof data.server_question === "number") {
          // Sync client to server state on desync
          setCurrentQuestionIndex(data.server_question);
        }
        console.warn("[Test] Question desync, synced to:", data.server_question);
        if (isDebug) {
          debugLogRef.current.push({ question: questionIndex, sentScore: score, serverConfirmed: false, serverQuestion: data.server_question ?? null, timestamp: Date.now() });
          console.log(`[ISSP DEBUG] Q${questionIndex}: sent=${score} → 409 DESYNC, server at Q${data.server_question}`);
        }
        return;
      }

      if (!response.ok) {
        if (isDebug) {
          debugLogRef.current.push({ question: questionIndex, sentScore: score, serverConfirmed: false, serverQuestion: null, timestamp: Date.now() });
          console.log(`[ISSP DEBUG] Q${questionIndex}: sent=${score} → ERROR ${response.status}`);
        }
        throw new Error("API error");
      }

      const data = await response.json();

      if (isDebug) {
        debugLogRef.current.push({ question: questionIndex, sentScore: score, serverConfirmed: true, serverQuestion: data.current_question ?? null, timestamp: Date.now() });
        console.log(`[ISSP DEBUG] Q${questionIndex}: sent=${score} → server OK, next=${data.current_question}`);
      }

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
      console.error("[Test] submitQuickAnswer error:", err);
      if (isDebug) {
        debugLogRef.current.push({ question: questionIndex, sentScore: score, serverConfirmed: false, serverQuestion: null, timestamp: Date.now() });
        console.log(`[ISSP DEBUG] Q${questionIndex}: sent=${score} → ERROR`);
      }
      setErrorMessage("Не удалось сохранить ответ. Попробуйте ещё раз.");
      // Откатить фазу если уже перешли в analyzing
      setPhase((prev) => prev === "analyzing" ? "question" : prev);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  }, [chatId, sessionId, handleRequiresAuth, isDebug]);

  // ── Handle Quick Answer (Flow 1: ~1s) ──
  const handleQuickAnswer = useCallback(async (score: number) => {
    if (transitioning.current || isLocked) return;
    transitioning.current = true;

    // Wait for start message if still in progress
    if (startPromiseRef.current) {
      await startPromiseRef.current;
      startPromiseRef.current = null;
    }

    // If session creation failed, show error and abort
    if (startFailedRef.current) {
      transitioning.current = false;
      setErrorMessage("Не удалось создать сессию. Перезагрузите страницу.");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
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
      const answerPromise = submitQuickAnswer(score, questionIdx);
      lastAnswerPromiseRef.current = answerPromise;

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

    // If session creation failed, show error and abort
    if (startFailedRef.current) {
      transitioning.current = false;
      setErrorMessage("Не удалось создать сессию. Перезагрузите страницу.");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
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
        if (data.server_question >= TOTAL_QUESTIONS) {
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
    const nextIndex = (completedBlockIndex + 1) * QUESTIONS_PER_BLOCK;
    setCurrentQuestionIndex(nextIndex);
    setIsLocked(false);
    setSelectedScore(null);
    setStatusMessage(null);
    setFallbackActive(false);
    setAnimationClass("enter");
    setPhase("question");
  }, [completedBlockIndex]);

  // ── Debug summary when entering analyzing phase ──
  useEffect(() => {
    if (phase !== "analyzing" || !isDebug || debugLogRef.current.length === 0) return;
    console.log("[ISSP DEBUG] === ИТОГО ===");
    console.table(debugLogRef.current.map(entry => ({
      "Вопрос": `Q${entry.question}`,
      "Отправлено": entry.sentScore,
      "Сервер": entry.serverConfirmed ? "\u2713" : "\u2717",
      "Следующий Q": entry.serverQuestion,
    })));
    console.log(`[ISSP DEBUG] Всего ответов отправлено: ${debugLogRef.current.length}`);
  }, [phase, isDebug]);

  // ── Polling for resultId during analyzing phase ──
  useEffect(() => {
    if (phase !== "analyzing" || resultId) return;

    let cancelled = false;
    let intervalRef: ReturnType<typeof setInterval> | undefined;
    let notFoundCount = 0;
    let processingCount = 0;
    let waitingForChatId = 0;
    const NOT_FOUND_LIMIT = 20; // ~60s (20 polls × 3s)
    const PROCESSING_LIMIT = 20; // ~60s — accept result without interpretation
    const CHAT_ID_WAIT_LIMIT = 10; // ~30s waiting for chatId to arrive

    const poll = async () => {
      // chatId may arrive later from fire-and-forget submitQuickAnswer
      if (!chatId) {
        waitingForChatId++;
        if (waitingForChatId >= CHAT_ID_WAIT_LIMIT && !cancelled) {
          console.error("[Test] chatId still null after", CHAT_ID_WAIT_LIMIT, "polls — cannot fetch results");
          setPhase("question");
          setErrorMessage("Не удалось получить результаты. Попробуйте ответить на последний вопрос ещё раз.");
          setTimeout(() => setErrorMessage(null), 8000);
        }
        return;
      }

      try {
        const res = await fetch(`/api/test/result?chat_id=${chatId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        console.log("[Test] polling response:", data.status, data.result_id);

        if (data.result_id && data.status === "ready" && !cancelled) {
          setResultId(data.result_id);
          return;
        }

        // Fallback: если result_id есть но status не ready — возможно after() зависло
        if (data.result_id && data.status === "processing") {
          processingCount++;
          if (processingCount >= PROCESSING_LIMIT && !cancelled) {
            console.warn("[Test] accepting processing result after", processingCount, "polls, id:", data.result_id);
            setResultId(data.result_id);
            return;
          }
        }

        // Если запись не найдена слишком долго — INSERT вероятно упал
        if (data.status === "not_found") {
          notFoundCount++;
          if (notFoundCount >= NOT_FOUND_LIMIT && !cancelled) {
            console.error("[Test] result not_found after", NOT_FOUND_LIMIT, "polls — INSERT likely failed");
            setPhase("question");
            setErrorMessage("Не удалось сохранить результаты. Попробуйте ответить на последний вопрос ещё раз.");
            setTimeout(() => setErrorMessage(null), 8000);
          }
        } else {
          notFoundCount = 0;
        }
      } catch {
        // ignore, retry next interval
      }
    };

    // First request after 2s (give server time for INSERT)
    const firstTimeout = setTimeout(() => {
      if (cancelled) return;
      poll();
      // Then every 3s
      intervalRef = setInterval(poll, 3000);
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(firstTimeout);
      if (intervalRef) clearInterval(intervalRef);
    };
  }, [phase, resultId, chatId]);

  // ── Result ready (from AnalyzingScreen onComplete) ──
  const handleResultReady = useCallback((newResultId: string) => {
    setResultId(newResultId);
    setPhase("complete");
  }, []);

  // ── View results ──
  const handleViewResults = useCallback(() => {
    if (resultId) {
      router.push(`/program/${programSlug}/test/results/${resultId}`);
    }
  }, [resultId, router]);

  // ── Render ──
  const question = testConfig.questions[currentQuestionIndex];
  const scaleKey = question?.scale || scaleOrder[0];
  const scaleName = scaleNames[scaleKey] || "";

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
          <WelcomeScreen onStart={handleStart} isStarting={isStarting} testConfig={testConfig} />
        )}

        {phase === "history" && (
          <HistoryScreen
            results={testResults}
            onRetake={handleRetake}
            isStarting={isStarting}
            programSlug={programSlug}
          />
        )}

        {(phase === "question" || phase === "auth_wall" || phase === "migrating") && question && (
          <QuestionScreen
            question={question}
            questionIndex={currentQuestionIndex}
            totalQuestions={TOTAL_QUESTIONS}
            scaleName={scaleName}
            isLocked={phase !== "question" ? true : isLocked}
            selectedScore={phase === "question" ? selectedScore : null}
            animationClass={phase === "question" ? animationClass : null}
            transitioning={phase === "question" ? transitioning.current : false}
            statusMessage={phase === "question" ? statusMessage : null}
            fallbackActive={phase === "question" ? fallbackActive : false}
            onQuickAnswer={phase === "question" ? handleQuickAnswer : () => {}}
            onTextAnswer={phase === "question" ? handleTextAnswer : async () => {}}
          />
        )}

        {/* Error toast */}
        {errorMessage && (
          <div className="tc-error-toast">
            {errorMessage}
          </div>
        )}

        {phase === "block_transition" && (
          <BlockTransition
            blockIndex={completedBlockIndex}
            completedScaleName={scaleNames[scaleOrder[completedBlockIndex]] || ""}
            nextScaleName={scaleNames[scaleOrder[completedBlockIndex + 1]] || ""}
            insight={blockInsights[completedBlockIndex] || ""}
            onContinue={handleBlockContinue}
          />
        )}

        {phase === "analyzing" && (
          <AnalyzingScreen resultId={resultId} onComplete={handleResultReady} />
        )}

        {phase === "complete" && (
          <CompletionScreen onViewResults={handleViewResults} />
        )}

        {/* Auth wall: мягкий промпт когда AuthSheet закрыт */}
        {phase === "auth_wall" && !authSheetOpen && (
          <div className="tc-auth-soft-prompt">
            <div className="tc-auth-soft-prompt-text">
              Для завершения теста необходима авторизация
            </div>
            {migrateError && (
              <div className="tc-error" style={{ marginBottom: 16 }}>
                {migrateError}
              </div>
            )}
            <button
              className="tc-auth-soft-prompt-btn"
              onClick={() => setAuthSheetOpen(true)}
            >
              Войти
            </button>
          </div>
        )}

        {/* AuthSheet (bottom sheet / modal) */}
        <AuthSheet
          mode="sheet"
          open={authSheetOpen}
          onClose={() => setAuthSheetOpen(false)}
          onSuccess={handleAuthSuccess}
          context="test"
        />

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
