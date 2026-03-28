import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { CardPhase } from "./types";
import type { MutableRefObject } from "react";

interface UseAuthFlowParams {
  sessionId: string;
  totalQuestions: number;
  lastAnswerPromiseRef: MutableRefObject<Promise<void> | null>;
  setPhase: (phase: CardPhase) => void;
  setMode: (mode: "anonymous" | "authenticated") => void;
  setSessionId: (id: string) => void;
  setChatId: (id: string | null) => void;
  setCurrentQuestionIndex: (idx: number) => void;
  setIsLocked: (locked: boolean) => void;
  setSelectedScore: (score: number | null) => void;
  setStatusMessage: (msg: null) => void;
  setFallbackActive: (active: boolean) => void;
  setAnimationClass: (cls: "enter" | "exit" | null) => void;
  setAuthSheetOpen: (open: boolean) => void;
}

export function useAuthFlow({
  sessionId,
  totalQuestions,
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
}: UseAuthFlowParams) {
  const router = useRouter();
  const migratingRef = useRef(false);
  const [migrateError, setMigrateError] = useState<string | null>(null);

  const doMigrate = useCallback(async () => {
    if (migratingRef.current) return;
    migratingRef.current = true;

    setPhase("migrating");
    setMigrateError(null);
    setAuthSheetOpen(false);

    try {
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

      const cq = typeof data.current_question === "number" ? data.current_question : totalQuestions - 1;
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
    router.refresh();
  }, [doMigrate, router]);

  return { migrateError, doMigrate, handleRequiresAuth, handleAuthSuccess };
}
