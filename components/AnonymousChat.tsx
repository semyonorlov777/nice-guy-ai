"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { AuthSheet } from "@/components/AuthSheet";
import type { UIMessage } from "ai";
import InputBar from "@/components/InputBar/InputBar";
import { useWelcomeAnimation } from "@/hooks/useWelcomeAnimation";
import { isTelegramWebView } from "@/lib/detect-browser";

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
  const [chatZoneEl, setChatZoneEl] = useState<HTMLDivElement | null>(null);
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

  // Check for saved messages synchronously (before mount) for animation decision
  const hasSavedMessages = useRef(false);
  if (typeof window !== "undefined" && !hasSavedMessages.current) {
    try {
      const saved = localStorage.getItem(storageKeyMessages);
      if (saved && JSON.parse(saved).length > 0) hasSavedMessages.current = true;
    } catch { /* ignore */ }
  }

  const {
    phase: welcomePhase,
    streamedText,
    showCursor,
    quickReplyStaggerIndex,
    inputPulseActive,
    skipToEnd: skipWelcome,
  } = useWelcomeAnimation({
    welcomeMessage,
    enabled: !hasSavedMessages.current,
    storageKey: "welcome_anim_anon_done",
    storageType: "session",
    triggerOnVisible: true,
    containerEl: chatZoneEl,
  });

  const animActive = !hasSavedMessages.current && welcomePhase !== "done";

  // Input pulse via DOM
  useEffect(() => {
    if (!inputPulseActive) return;
    const el = chatZoneEl?.querySelector(".input-container");
    if (!el) return;
    el.classList.add("input-pulse");
    return () => el.classList.remove("input-pulse");
  }, [inputPulseActive, chatZoneEl]);

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
  const hasScrolledToSection = useRef(false);

  // --- Scroll: chat-level only (no page scroll here) ---
  const scrollToBottom = useCallback(() => {
    if (messagesRef.current && !isUserScrolledUp.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, []);

  // Page-level scroll к секции чата — только при первом взаимодействии
  const scrollToSection = useCallback(() => {
    if (scrollToSectionId && !hasScrolledToSection.current) {
      hasScrolledToSection.current = true;
      document.getElementById(scrollToSectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [scrollToSectionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Telegram WebView на iOS неправильно позиционирует scroll — сбрасываем
  useEffect(() => {
    if (isTelegramWebView()) {
      window.scrollTo(0, 0);
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    }
  }, []);

  function handleScroll() {
    const el = messagesRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    isUserScrolledUp.current = !atBottom;
  }

  function handleSend(text: string) {
    const msgText = text.trim();
    if (!msgText || isStreaming || requiresAuth) return;

    if (animActive) skipWelcome();

    // Page-level scroll при первом сообщении (до отправки, чтобы не дёргало)
    scrollToSection();

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

  function renderUserContent(content: string) {
    if (!content) return null;
    return content.split("\n\n").map((paragraph, i) => <p key={i}>{paragraph}</p>);
  }

  async function handleAuthSuccess() {
    try {
      // Конвертируем UIMessage → простой формат для миграции
      const simplifiedMessages = messages.map((m) => ({
        role: m.role,
        content: getMessageText(m),
      }));

      if (simplifiedMessages.length > 0) {
        await fetch("/api/chat/migrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            program_slug: programSlug,
            messages: simplifiedMessages,
            session_id: sessionIdRef.current,
          }),
        });
      }
    } catch {
      /* При ошибке — redirect на чистый чат */
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
    <div className="chat-zone" ref={setChatZoneEl}>
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

          {/* Thinking indicator during welcome animation */}
          {messages.length === 0 && welcomePhase === "thinking" && (
            <div className="thinking-indicator">
              <div className="msg-avatar ai" />
              <div className="thinking-bubble">
                <div className="thinking-dot" />
                <div className="thinking-dot" />
                <div className="thinking-dot" />
              </div>
            </div>
          )}

          {/* Welcome AI message */}
          {messages.length === 0 && welcomePhase !== "idle" && welcomePhase !== "thinking" && (
            <div className={`msg msg-ai${animActive ? " msg-welcome-enter" : ""}`}>
              <div className="msg-avatar ai">НС</div>
              <div className="msg-bubble">
                <ReactMarkdown remarkPlugins={[remarkBreaks]}>{animActive ? streamedText : welcomeMessage}</ReactMarkdown>
                {showCursor && <span className="streaming-cursor">{"▊"}</span>}
              </div>
            </div>
          )}

          {/* Quick replies */}
          {showQuickReplies && quickReplies.length > 0 &&
            (!animActive || welcomePhase === "quick-replies" || welcomePhase === "input-pulse") && (
            <div className="quick-replies">
              {quickReplies.map((text, i) => {
                if (animActive && i >= quickReplyStaggerIndex) return null;
                return (
                  <button
                    key={i}
                    className={`quick-reply-btn${animActive ? " quick-reply-enter" : ""}`}
                    onClick={() => handleSend(text)}
                    disabled={isStreaming}
                  >
                    {text}
                  </button>
                );
              })}
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
                {isAi ? (
                  <ChatMessage
                    text={text}
                    isStreaming={status === "streaming" && isLast}
                    onReplyClick={
                      isLast && status !== "streaming" && status !== "submitted" && !requiresAuth
                        ? handleSend
                        : undefined
                    }
                    disabled={isStreaming || requiresAuth}
                    showReplyLabel={false}
                    classNames={{
                      bubble: "msg-bubble",
                      repliesContainer: "quick-replies",
                      replyButton: "quick-reply-btn",
                      replyButtonExit: "quick-reply-btn quick-reply-btn-exit",
                    }}
                    bubbleSuffix={
                      status === "streaming" && isLast ? (
                        <span className="streaming-cursor">{"▊"}</span>
                      ) : undefined
                    }
                  />
                ) : (
                  <div className="msg-bubble">{renderUserContent(text)}</div>
                )}
              </div>
            );
          })}

          {status === "submitted" && messages.length > 0 && (
            <div className="thinking-indicator">
              <div className="msg-avatar ai" />
              <div className="thinking-bubble">
                <div className="thinking-dot" />
                <div className="thinking-dot" />
                <div className="thinking-dot" />
              </div>
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

      <div className="chat-input-wrap" onFocusCapture={animActive ? skipWelcome : undefined}>
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
