"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { TestChat, type TestMessage } from "@/components/TestChat";
import { InChatAuth } from "@/components/InChatAuth";

type Phase =
  | "loading"
  | "welcome"
  | "in_progress"
  | "auth_wall"
  | "migrating"
  | "final_q"
  | "complete";

export default function ISSPTestPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [sessionId, setSessionId] = useState<string>("");
  const [chatId, setChatId] = useState<string>("");
  const [initialMessages, setInitialMessages] = useState<TestMessage[]>([]);
  const [migrateError, setMigrateError] = useState<string | null>(null);
  const startingRef = useRef(false);

  // Initialize: check session / auth state
  useEffect(() => {
    async function init() {
      const supabase = createClient();

      // 1. Check if user is authenticated
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Check for active test chat
        const { data: chat } = await supabase
          .from("chats")
          .select("id")
          .eq("chat_type", "test")
          .eq("status", "active")
          .maybeSingle();

        if (chat) {
          // Load messages for this chat
          const { data: dbMessages } = await supabase
            .from("messages")
            .select("role, content")
            .eq("chat_id", chat.id)
            .order("created_at", { ascending: true });

          const msgs: TestMessage[] = (dbMessages || []).map((m, i) => ({
            id: `db-${i}`,
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

          setChatId(chat.id);
          setInitialMessages(msgs);
          setPhase("final_q");
          return;
        }
      }

      // 2. Check sessionStorage for anonymous session
      try {
        const savedSessionId = sessionStorage.getItem("issp_session_id");
        if (savedSessionId) {
          const res = await fetch(
            `/api/test?session_id=${encodeURIComponent(savedSessionId)}`
          );
          if (res.ok) {
            const data = await res.json();
            const msgs: TestMessage[] = (data.messages || []).map(
              (m: { role: string; content: string }, i: number) => ({
                id: `restored-${i}`,
                role: m.role as "user" | "assistant",
                content: m.content,
              })
            );

            setSessionId(savedSessionId);
            setInitialMessages(msgs);
            setPhase("in_progress");
            return;
          } else {
            // Session not found or completed — clean up
            sessionStorage.removeItem("issp_session_id");
          }
        }
      } catch {
        // sessionStorage unavailable
      }

      // 3. Show welcome
      setPhase("welcome");
    }

    init();
  }, []);

  function handleStart() {
    if (startingRef.current) return;
    startingRef.current = true;

    const newSessionId = crypto.randomUUID();
    try {
      sessionStorage.setItem("issp_session_id", newSessionId);
    } catch {
      // ignore
    }
    setSessionId(newSessionId);
    setInitialMessages([]);
    setPhase("in_progress");
  }

  async function handleRequiresAuth() {
    // Check if user is already logged in
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Already authenticated — skip auth wall, go straight to migration
      await doMigrate();
    } else {
      setPhase("auth_wall");
    }
  }

  async function handleAuthSuccess() {
    await doMigrate();
  }

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

      try {
        sessionStorage.removeItem("issp_session_id");
      } catch {
        // ignore
      }

      setPhase("final_q");
    } catch (err) {
      setMigrateError((err as Error).message);
      setPhase("auth_wall"); // let them retry
    }
  }

  function handleTestComplete(resultId: string) {
    setPhase("complete");
    router.push(`/test/results/${resultId}`);
  }

  // Loading state
  if (phase === "loading") {
    return (
      <div className="test-page">
        <div className="test-migrating">
          <div className="test-spinner" />
        </div>
      </div>
    );
  }

  // Welcome screen
  if (phase === "welcome") {
    return (
      <div className="test-page">
        <div className="test-welcome">
          <div className="test-welcome-badge">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
            Диагностика
          </div>

          <h1>
            Индекс Синдрома
            <br />
            <span>Славного Парня</span>
          </h1>

          <p className="test-welcome-desc">
            Ответь на вопросы — AI-терапевт определит, насколько выражен синдром
            и в каких сферах жизни он проявляется сильнее всего.
          </p>

          <div className="test-welcome-stats">
            <div className="test-welcome-stat">
              <span className="num">35</span>
              <span className="label">вопросов</span>
            </div>
            <div className="test-welcome-stat">
              <span className="num">~15</span>
              <span className="label">минут</span>
            </div>
            <div className="test-welcome-stat">
              <span className="num">7</span>
              <span className="label">сфер жизни</span>
            </div>
          </div>

          <div className="test-welcome-divider" />

          <button
            className="test-btn-primary"
            onClick={handleStart}
            disabled={startingRef.current}
          >
            Начать тест
          </button>

          <div className="test-meta-line">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            Результаты конфиденциальны. Правильных ответов нет.
          </div>
        </div>
      </div>
    );
  }

  // Complete — redirect in progress
  if (phase === "complete") {
    return (
      <div className="test-page">
        <div className="test-migrating">
          <div className="test-spinner" />
          <span>Загружаем результаты...</span>
        </div>
      </div>
    );
  }

  // Chat phases: in_progress, auth_wall, migrating, final_q
  const isAnonymous = phase === "in_progress" || phase === "auth_wall";
  const showAuthOverlay = phase === "auth_wall";
  const showMigrating = phase === "migrating";

  return (
    <div className="test-page">
      <TestChat
        mode={isAnonymous ? "anonymous" : "authenticated"}
        sessionId={isAnonymous ? sessionId : undefined}
        chatId={!isAnonymous ? chatId : undefined}
        initialMessages={initialMessages}
        autoSendFirst={
          initialMessages.length === 0 && phase === "in_progress"
            ? "Готов, начнём"
            : undefined
        }
        onRequiresAuth={handleRequiresAuth}
        onTestComplete={handleTestComplete}
      />

      {/* Auth overlay */}
      {showAuthOverlay && (
        <div className="test-auth-overlay">
          <div className="test-auth-overlay-text">
            <strong>Остался 1 вопрос</strong>
            <br />
            Авторизуйся, чтобы сохранить результаты
          </div>
          {migrateError && (
            <div className="test-error" style={{ marginBottom: 16 }}>
              {migrateError}
            </div>
          )}
          <InChatAuth onAuthSuccess={handleAuthSuccess} />
        </div>
      )}

      {/* Migrating overlay */}
      {showMigrating && (
        <div className="test-auth-overlay">
          <div className="test-migrating">
            <div className="test-spinner" />
            <span>Сохраняем прогресс...</span>
          </div>
        </div>
      )}
    </div>
  );
}
