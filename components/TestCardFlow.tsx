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
  ISSP_QUICK_REACTIONS,
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

const TOTAL_QUESTIONS = 35;

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
  const [aiReaction, setAiReaction] = useState<string | null>(null);
  const [isReacting, setIsReacting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [animationClass, setAnimationClass] = useState<"enter" | "exit" | null>("enter");
  const [migrateError, setMigrateError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Block transition state
  const [completedBlockIndex, setCompletedBlockIndex] = useState(0);

  // API state
  const messagesHistory = useRef<{ role: string; content: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const initDone = useRef(false);

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

          const testState = chat.test_state as { current_question?: number } | null;
          const cq = testState?.current_question ?? 0;

          setChatId(chat.id);
          setMode("authenticated");
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

              const testState = chatData?.test_state as { current_question?: number } | null;
              const cq = testState?.current_question ?? 34;

              setChatId(newChatId);
              setMode("authenticated");
              setCurrentQuestionIndex(cq);
              try {
                sessionStorage.removeItem("issp_session_id");
                localStorage.removeItem("issp_session_id");
              } catch { /* ignore */ }
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
          messagesHistory.current = data.messages || [];
          setSessionId(savedSessionId);
          setCurrentQuestionIndex(data.current_question || 0);
          setPhase("question");
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

  // ── SSE Consumer ──
  const consumeSSE = useCallback(async (
    response: Response,
    options?: { streamToReaction?: boolean }
  ): Promise<{
    fullText: string;
    requiresAuth: boolean;
    testComplete: boolean;
    resultId: string | null;
  }> => {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Нет потока ответа");

    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let requiresAuth = false;
    let testComplete = false;
    let gotResultId: string | null = null;

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
            if (options?.streamToReaction) {
              setAiReaction(fullText);
            }
          } else if (data.type === "requires_auth") {
            requiresAuth = true;
          } else if (data.type === "test_complete") {
            testComplete = true;
            gotResultId = data.result_id;
          } else if (data.type === "error") {
            console.error("[TestCardFlow] SSE error:", data.message);
          }
        } catch {
          // skip malformed JSON
        }
      }
    }

    return { fullText, requiresAuth, testComplete, resultId: gotResultId };
  }, []);

  // ── Send to API ──
  const sendToAPI = useCallback(async (
    message: string,
    options?: { streamToReaction?: boolean }
  ) => {
    const body =
      mode === "anonymous"
        ? {
            message,
            test_slug: "issp",
            session_id: sessionId,
            messages: messagesHistory.current,
          }
        : {
            message,
            test_slug: "issp",
            chat_id: chatId,
          };

    const controller = new AbortController();
    abortRef.current = controller;

    const response = await fetch("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.error || `Ошибка сервера: ${response.status}`);
    }

    const result = await consumeSSE(response, options);

    // Update messages history
    messagesHistory.current = [
      ...messagesHistory.current,
      { role: "user", content: message },
      { role: "assistant", content: result.fullText },
    ];

    abortRef.current = null;
    return result;
  }, [mode, sessionId, chatId, consumeSSE]);

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

    // Send first message to create the session
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

      messagesHistory.current = [
        { role: "user", content: "Готов, начнём" },
        { role: "assistant", content: result.fullText },
      ];

      setCurrentQuestionIndex(0);
      setAnimationClass("enter");
      setPhase("question");
    } catch (err) {
      console.error("[TestCardFlow] Start error:", err);
      setIsStarting(false);
    }
  }, [isStarting, consumeSSE]);

  // ── Advance to next question ──
  const advanceQuestion = useCallback((nextIndex: number, hasRequiresAuth: boolean) => {
    if (hasRequiresAuth) {
      // Auth wall
      handleRequiresAuth();
      return;
    }

    const currentBlock = Math.floor((nextIndex - 1) / 5);
    const nextBlock = Math.floor(nextIndex / 5);
    const isBlockBoundary = nextIndex < TOTAL_QUESTIONS && nextBlock > currentBlock;

    if (isBlockBoundary) {
      setCompletedBlockIndex(currentBlock);
      setPhase("block_transition");
      return;
    }

    if (nextIndex >= TOTAL_QUESTIONS) {
      // This shouldn't happen — test_complete should've fired
      return;
    }

    // Animate transition
    setAnimationClass("exit");
    setTimeout(() => {
      setCurrentQuestionIndex(nextIndex);
      setAiReaction(null);
      setIsReacting(false);
      setIsLocked(false);
      setSelectedScore(null);
      setAnimationClass("enter");
    }, 300);
  }, []);

  // ── Handle Quick Answer ──
  // TODO: оптимизировать quick-ответы — шаг 3, отдельный API-режим без Gemini
  const handleQuickAnswer = useCallback(async (score: number) => {
    if (isLocked) return;

    setSelectedScore(score);
    setIsLocked(true);
    setIsReacting(true);

    // Show local reaction after typing dots delay
    const reactions = ISSP_QUICK_REACTIONS[score];
    const reaction = reactions[Math.floor(Math.random() * reactions.length)];

    setTimeout(() => {
      setAiReaction(reaction);
    }, 600 + Math.random() * 400);

    // Send to server in parallel
    try {
      const result = await sendToAPI(String(score));

      if (result.testComplete && result.resultId) {
        setResultId(result.resultId);
        // Small delay for reaction to be seen
        setTimeout(() => setPhase("analyzing"), 1000);
        return;
      }

      // Wait for reaction to be visible
      setTimeout(() => {
        advanceQuestion(currentQuestionIndex + 1, result.requiresAuth);
      }, 1600);
    } catch (err) {
      console.error("[TestCardFlow] Quick answer error:", err);
      setIsLocked(false);
      setIsReacting(false);
      setAiReaction(null);
      setSelectedScore(null);
    }
  }, [isLocked, currentQuestionIndex, sendToAPI, advanceQuestion]);

  // ── Handle Text Answer ──
  const handleTextAnswer = useCallback(async (text: string) => {
    if (isLocked) return;

    setIsLocked(true);
    setIsReacting(true);

    try {
      const result = await sendToAPI(text, { streamToReaction: true });

      if (result.testComplete && result.resultId) {
        setResultId(result.resultId);
        setTimeout(() => setPhase("analyzing"), 1000);
        return;
      }

      // Wait for reaction to be visible
      setTimeout(() => {
        advanceQuestion(currentQuestionIndex + 1, result.requiresAuth);
      }, 1600);
    } catch (err) {
      console.error("[TestCardFlow] Text answer error:", err);
      setIsLocked(false);
      setIsReacting(false);
      setAiReaction(null);
    }
  }, [isLocked, currentQuestionIndex, sendToAPI, advanceQuestion]);

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
      setAiReaction(null);
      setIsReacting(false);
      setIsLocked(false);
      setSelectedScore(null);
      setCurrentQuestionIndex(TOTAL_QUESTIONS - 1);
      setAnimationClass("enter");
      setPhase("question");
    } catch (err) {
      setMigrateError((err as Error).message);
      setPhase("auth_wall");
    }
  }

  // ── Block transition continue ──
  const handleBlockContinue = useCallback(() => {
    const nextIndex = (completedBlockIndex + 1) * 5;
    setCurrentQuestionIndex(nextIndex);
    setAiReaction(null);
    setIsReacting(false);
    setIsLocked(false);
    setSelectedScore(null);
    setAnimationClass("enter");
    setPhase("question");
  }, [completedBlockIndex]);

  // ── Analyzing complete ──
  const handleAnalyzingComplete = useCallback(() => {
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
  const currentBlock = Math.floor(currentQuestionIndex / 5);

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
            aiReaction={aiReaction}
            isReacting={isReacting}
            isLocked={isLocked}
            selectedScore={selectedScore}
            animationClass={animationClass}
            onQuickAnswer={handleQuickAnswer}
            onTextAnswer={handleTextAnswer}
          />
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
          <AnalyzingScreen onComplete={handleAnalyzingComplete} />
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
