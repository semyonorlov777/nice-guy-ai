"use client";

import { useState, useRef, useCallback } from "react";
import { useSearchParams, usePathname } from "next/navigation";
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
import type { CardPhase, StatusMessage, DebugLogEntry } from "@/components/test-flow/types";
import { useTestInit } from "@/components/test-flow/useTestInit";
import { useTestSession } from "@/components/test-flow/useTestSession";
import { useAuthFlow } from "@/components/test-flow/useAuthFlow";
import { useTestAnswers } from "@/components/test-flow/useTestAnswers";
import { useResultPolling } from "@/components/test-flow/useResultPolling";

export function TestCardFlow({ testConfig }: { testConfig: TestConfig }) {
  // Derived from config
  const TOTAL_QUESTIONS = testConfig.total_questions;
  const AUTH_WALL_QUESTION = testConfig.ui_config.auth_wall_question;
  const QUESTIONS_PER_BLOCK = testConfig.ui_config.questions_per_block;
  const scaleOrder = getScaleOrder(testConfig);
  const scaleNames = getScaleNames(testConfig);
  const blockInsights = testConfig.ui_config.block_insights;
  const storageKey = `test_session_${testConfig.slug}`;
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
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
  const [fallbackActive, setFallbackActive] = useState(false);
  const [completedBlockIndex, setCompletedBlockIndex] = useState(0);
  const [testResults, setTestResults] = useState<TestResultSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs
  const transitioning = useRef(false);
  const messagesHistory = useRef<{ role: string; content: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const initDone = useRef(false);
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const startFailedRef = useRef(false);
  const lastAnswerPromiseRef = useRef<Promise<void> | null>(null);
  const debugLogRef = useRef<DebugLogEntry[]>([]);

  // ── Hooks ──

  useTestInit({
    testConfig,
    programId: testConfig.program_id,
    storageKey,
    totalQuestions: TOTAL_QUESTIONS,
    authWallQuestion: AUTH_WALL_QUESTION,
    initDone,
    messagesHistory,
    setPhase,
    setMode,
    setSessionId,
    setChatId,
    setCurrentQuestionIndex,
    setTestResults,
    setAuthSheetOpen,
  });

  const { isStarting, handleStart, handleRetake } = useTestSession({
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
  });

  const { migrateError, handleRequiresAuth, handleAuthSuccess } = useAuthFlow({
    sessionId,
    storageKey,
    totalQuestions: TOTAL_QUESTIONS,
    lastAnswerPromiseRef,
    setPhase,
    setMode,
    setSessionId,
    setChatId,
    setCurrentQuestionIndex,
    setIsLocked,
    setSelectedScore,
    setStatusMessage,
    setFallbackActive,
    setAnimationClass,
    setAuthSheetOpen,
  });

  const { handleQuickAnswer, handleTextAnswer } = useTestAnswers({
    testConfig,
    storageKey,
    mode,
    sessionId,
    chatId,
    isLocked,
    fallbackActive,
    currentQuestionIndex,
    totalQuestions: TOTAL_QUESTIONS,
    questionsPerBlock: QUESTIONS_PER_BLOCK,
    authWallQuestion: AUTH_WALL_QUESTION,
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
  });

  const { handleResultReady, handleViewResults } = useResultPolling({
    phase,
    resultId,
    chatId,
    isDebug,
    debugLogRef,
    setPhase,
    setResultId,
    setErrorMessage,
  });

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
            testConfig={testConfig}
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
          <AnalyzingScreen resultId={resultId} onComplete={handleResultReady} stages={testConfig.ui_config.analyzing_stages} />
        )}

        {phase === "complete" && (
          <CompletionScreen onViewResults={handleViewResults} />
        )}

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

        <AuthSheet
          mode="sheet"
          open={authSheetOpen}
          onClose={() => setAuthSheetOpen(false)}
          onSuccess={handleAuthSuccess}
          context="test"
        />

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
