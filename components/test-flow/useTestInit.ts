import { useEffect, type MutableRefObject } from "react";
import { createClient } from "@/lib/supabase";
import type { TestConfig } from "@/lib/test-config";
import type { TestResultSummary } from "@/components/test/HistoryScreen";
import type { CardPhase } from "./types";

interface UseTestInitParams {
  testConfig: TestConfig;
  storageKey: string;
  totalQuestions: number;
  authWallQuestion: number | null;
  initDone: MutableRefObject<boolean>;
  messagesHistory: MutableRefObject<{ role: string; content: string }[]>;
  setPhase: (phase: CardPhase) => void;
  setMode: (mode: "anonymous" | "authenticated") => void;
  setSessionId: (id: string) => void;
  setChatId: (id: string | null) => void;
  setCurrentQuestionIndex: (idx: number) => void;
  setTestResults: (results: TestResultSummary[]) => void;
  setAuthSheetOpen: (open: boolean) => void;
}

export function useTestInit({
  testConfig,
  storageKey,
  totalQuestions,
  authWallQuestion,
  initDone,
  messagesHistory,
  setPhase,
  setMode,
  setSessionId,
  setChatId,
  setCurrentQuestionIndex,
  setTestResults,
  setAuthSheetOpen,
}: UseTestInitParams) {
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

        // Active chat with real progress → restore
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

          if (cq >= totalQuestions || testState?.status === "completed") {
            setPhase("analyzing");
            return;
          }

          setCurrentQuestionIndex(cq);
          setPhase("question");
          return;
        }

        // Completed results exist → show history
        if (existingResults && existingResults.length > 0) {
          setTestResults(existingResults);
          setPhase("history");
          return;
        }
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
        // Authenticated + session_id → auto-migrate
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

              const supabase2 = createClient();
              const { data: dbMessages } = await supabase2
                .from("messages")
                .select("role, content")
                .eq("chat_id", newChatId)
                .order("created_at", { ascending: true });

              messagesHistory.current = (dbMessages || []).map((m) => ({
                role: m.role,
                content: m.content,
              }));

              const { data: chatData } = await supabase2
                .from("chats")
                .select("test_state")
                .eq("id", newChatId)
                .single();

              const ts = chatData?.test_state as { current_question?: number; status?: string } | null;
              const cq = ts?.current_question ?? 34;

              setChatId(newChatId);
              setMode("authenticated");
              try {
                sessionStorage.removeItem(storageKey);
                localStorage.removeItem(storageKey);
                sessionStorage.removeItem("issp_session_id");
                localStorage.removeItem("issp_session_id");
              } catch { /* ignore */ }

              if (cq >= totalQuestions || ts?.status === "completed") {
                setPhase("analyzing");
                return;
              }

              setCurrentQuestionIndex(cq);
              setPhase("question");
              return;
            }
          } catch {
            // Migration failed — fall through
          }
        }

        // Restore anonymous session
        const res = await fetch(
          `/api/test?session_id=${encodeURIComponent(savedSessionId)}`,
        );
        if (res.ok) {
          const data = await res.json();

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

          if (authWallQuestion !== null && cq >= authWallQuestion) {
            setPhase("auth_wall");
            setAuthSheetOpen(true);
            return;
          }

          if (cq === 0 && (!data.messages || data.messages.length === 0)) {
            setPhase("welcome");
          } else {
            setPhase("question");
          }
          return;
        } else if (res.status === 404) {
          try {
            sessionStorage.removeItem("issp_session_id");
            localStorage.removeItem("issp_session_id");
          } catch { /* ignore */ }
        } else {
          console.warn("[Test] Failed to restore session (status:", res.status, "), keeping storage for retry");
        }
      }

      setPhase("welcome");
    }

    init();
  }, []);
}
