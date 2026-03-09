"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import { InChatAuth } from "@/components/InChatAuth";
import type { UIMessage } from "ai";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { VoiceButton } from "@/components/VoiceButton";
import { VoiceOverlay } from "@/components/VoiceOverlay";

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
  const [input, setInput] = useState("");
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [mounted, setMounted] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  const voiceInput = useVoiceInput({
    lang: "ru-RU",
    maxDuration: 300,
    onTranscript: (text) => {
      handleSend(text);
    },
    paidFallbackEnabled: false,
  });

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

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 100) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Enter during voice recording (textarea is replaced by overlay, so use document listener)
  useEffect(() => {
    if (voiceInput.state !== "recording" && voiceInput.state !== "locked") return;

    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        voiceInput.stopRecording();
      }
    }

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [voiceInput.state, voiceInput.stopRecording]);

  function handleSend(text?: string) {
    const msgText = (text || input).trim();
    if (!msgText || isStreaming || requiresAuth) return;

    if (!text) {
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }

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

          {requiresAuth && <InChatAuth onAuthSuccess={handleAuthSuccess} />}
        </div>
      </div>

      <div className="chat-input-wrap">
        <div className="chat-input-inner">
          <div className="chat-input-row">
            {voiceInput.state !== "idle" ? (
              <VoiceOverlay
                voiceInput={voiceInput}
                onCancel={() => voiceInput.cancelRecording()}
              />
            ) : (
              <textarea
                ref={textareaRef}
                className="chat-input"
                placeholder="Напиши сообщение..."
                rows={1}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                disabled={isStreaming || requiresAuth}
              />
            )}
            <VoiceButton
              voiceInput={voiceInput}
              hasText={!!input.trim()}
              isStreaming={isStreaming}
              disabled={requiresAuth}
              onSend={() => handleSend()}
            />
          </div>
          <div className="input-privacy">
            {"🔒 Анонимный чат. Данные не сохраняются на сервере."}
          </div>
        </div>
      </div>
    </div>
  );
}
