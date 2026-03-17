"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import { AuthSheet } from "@/components/AuthSheet";
import type { UIMessage } from "ai";
import InputBar from "@/components/InputBar/InputBar";

interface AnonymousChatProps {
  programSlug: string;
  welcomeMessage: string;
  quickReplies: string[];
  scrollToSectionId?: string;
  headerTitle?: string;
  headerSubtitle?: string;
}

export function AnonymousChat({
  programSlug,
  welcomeMessage,
  quickReplies,
  scrollToSectionId,
  headerTitle,
  headerSubtitle,
}: AnonymousChatProps) {
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);
  const sessionIdRef = useRef<string>("");

  const storageKeyMessages = `anon_chat_${programSlug}_messages`;
  const storageKeySession = `anon_chat_${programSlug}_session_id`;

  // Инициализируем session ID синхронно при рендере (до создания транспорта)
  if (!sessionIdRef.current && typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(storageKeySession);
      if (saved) {
        sessionIdRef.current = saved;
      } else {
        const newId = crypto.randomUUID();
        sessionIdRef.current = newId;
        localStorage.setItem(storageKeySession, newId);
      }
    } catch {
      sessionIdRef.current = crypto.randomUUID();
    }
  }

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat/anonymous",
      body: {
        session_id: sessionIdRef.current,
        program_slug: programSlug,
      },
      fetch: async (url, options) => {
        const response = await globalThis.fetch(
          url as string | URL | Request,
          options as RequestInit
        );
        if (response.status === 429) {
          const data = await response.clone().json();
          if (data.requiresAuth) {
            throw new Error("AUTH_REQUIRED");
          }
        }
        return response;
      },
    }),
    onError: (err) => {
      if (err.message === "AUTH_REQUIRED") {
        setRequiresAuth(true);
        setAuthSheetOpen(true);
      } else {
        console.error("[anon-chat] Error:", err.message);
      }
    },
  });

  // Загружаем сохранённые сообщения из localStorage при маунте
  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem(storageKeyMessages);
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages) as Array<{
          role: string;
          content: string;
        }>;
        if (parsed.length > 0) {
          const uiMessages: UIMessage[] = parsed.map((msg, i) => ({
            id: `saved-${i}`,
            role: msg.role as "user" | "assistant",
            parts: [{ type: "text" as const, text: msg.content }],
          }));
          setMessages(uiMessages);
          setShowQuickReplies(false);
        }
      }
    } catch {
      /* ignore */
    }
    setMounted(true);
  }, [storageKeyMessages, setMessages]);

  // Сохраняем сообщения в localStorage после завершения стриминга
  useEffect(() => {
    if (messages.length > 0 && status === "ready") {
      try {
        const simplified = messages.map((m) => ({
          role: m.role,
          content: m.parts
            .filter(
              (p): p is { type: "text"; text: string } => p.type === "text"
            )
            .map((p) => p.text)
            .join(""),
        }));
        localStorage.setItem(storageKeyMessages, JSON.stringify(simplified));
      } catch {
        /* localStorage full */
      }
    }
  }, [messages, status, storageKeyMessages]);

  const isStreaming = status === "streaming" || status === "submitted";

  // --- Scroll (включая landing page scroll) ---
  const scrollToBottom = useCallback(() => {
    if (messagesRef.current && !isUserScrolledUp.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      if (scrollToSectionId) {
        const section = document.getElementById(scrollToSectionId);
        if (section) {
          const rect = section.getBoundingClientRect();
          if (rect.top > window.innerHeight || rect.bottom < 0) {
            section.scrollIntoView({ behavior: "smooth" });
          }
        }
      }
    }
  }, [scrollToSectionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  function handleScroll() {
    const el = messagesRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    isUserScrolledUp.current = !atBottom;
  }

  function handleSend(text: string) {
    const msgText = text.trim();
    if (!msgText || isStreaming || requiresAuth) return;

    setShowQuickReplies(false);
    isUserScrolledUp.current = false;
    sendMessage({ text: msgText });
  }

  function getMessageText(msg: UIMessage): string {
    return msg.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
  }

  function renderContent(content: string, isAi: boolean) {
    if (!content) return null;
    if (isAi) return <ReactMarkdown>{content}</ReactMarkdown>;
    return content.split("\n\n").map((paragraph, i) => <p key={i}>{paragraph}</p>);
  }

  async function handleAuthSuccess() {
    try {
      // Конвертируем UIMessage → простой формат для миграции
      const simplifiedMessages = messages.map((m) => ({
        role: m.role,
        content: getMessageText(m),
      }));

      await fetch("/api/chat/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_slug: programSlug,
          messages: simplifiedMessages,
          session_id: sessionIdRef.current,
        }),
      });
    } catch {
      /* ignore */
    }

    try {
      localStorage.removeItem(storageKeyMessages);
      localStorage.removeItem(storageKeySession);
    } catch {
      /* ignore */
    }

    window.location.href = `/program/${programSlug}/chat`;
  }

  if (!mounted) return null;

  return (
    <div className="chat-zone">
      <div
        className="chat-messages"
        ref={messagesRef}
        onScroll={handleScroll}
      >
        <div className="chat-inner">
          {headerTitle && (
            <div className="chat-section-header">
              <h2>{headerTitle}</h2>
              {headerSubtitle && <p>{headerSubtitle}</p>}
            </div>
          )}

          {messages.length === 0 && (
            <div className="msg msg-ai">
              <div className="msg-avatar ai">НС</div>
              <div className="msg-bubble">
                <ReactMarkdown>{welcomeMessage}</ReactMarkdown>
              </div>
            </div>
          )}

          {showQuickReplies && quickReplies.length > 0 && (
            <div className="quick-replies">
              {quickReplies.map((text, i) => (
                <button
                  key={i}
                  className="quick-reply-btn"
                  onClick={() => handleSend(text)}
                  disabled={isStreaming}
                >
                  {text}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg) => {
            const isAi = msg.role === "assistant";
            const text = getMessageText(msg);
            const isLast = msg.id === messages[messages.length - 1]?.id;
            const isThinking =
              status === "submitted" && isLast && isAi && !text;
            if (isThinking) return null;

            return (
              <div
                key={msg.id}
                className={`msg ${isAi ? "msg-ai" : "msg-user"}`}
              >
                <div className={`msg-avatar ${isAi ? "ai" : "user"}`}>
                  {isAi ? "НС" : "?"}
                </div>
                <div className="msg-bubble">
                  {renderContent(text, isAi)}
                  {status === "streaming" && isLast && isAi && (
                    <span className="streaming-cursor">{"▊"}</span>
                  )}
                </div>
              </div>
            );
          })}

          {status === "submitted" && messages.length > 0 && (
            <div className="thinking-indicator">
              думаю
              <span className="thinking-dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </div>
          )}

          {error && !requiresAuth && (
            <div className="msg msg-ai">
              <div className="msg-avatar ai">НС</div>
              <div className="msg-bubble">
                <p>{error.message || "Произошла ошибка"}</p>
              </div>
            </div>
          )}

        </div>
      </div>

      <div className="chat-input-wrap">
        <div className="chat-input-inner">
          <InputBar
            mode="chat"
            disabled={isStreaming || requiresAuth}
            onSend={handleSend}
            footer={
              <div className="input-privacy">
                {"🔒 Анонимный чат. Данные не сохраняются на сервере."}
              </div>
            }
          />
          {requiresAuth && !authSheetOpen && (
            <button
              className="anon-chat-auth-prompt"
              onClick={() => setAuthSheetOpen(true)}
            >
              Войди чтобы продолжить →
            </button>
          )}
        </div>
      </div>

      <AuthSheet
        mode="sheet"
        context="chat"
        open={authSheetOpen}
        onSuccess={handleAuthSuccess}
        onClose={() => setAuthSheetOpen(false)}
      />
    </div>
  );
}
