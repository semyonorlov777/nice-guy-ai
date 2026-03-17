"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import type { UIMessage } from "ai";
import InputBar from "@/components/InputBar/InputBar";
import { useChatListRefresh } from "@/contexts/ChatListContext";

interface ChatWindowProps {
  initialMessages: UIMessage[];
  chatId: string | null;
  programId: string;
  exerciseId?: string;
  chatType?: "exercise" | "free" | "author";
  userInitial: string;
  avatarUrl?: string | null;
  welcomeMessage?: string;
  quickReplies?: string[];
  children?: React.ReactNode;
}

function classifyError(content: string): "limit" | "ai" {
  if (/Недостаточно|лимит|закончились/i.test(content)) return "limit";
  return "ai";
}

function getSlugFromPath(): string {
  const match = window.location.pathname.match(/\/program\/([^/]+)/);
  return match ? match[1] : "nice-guy";
}

export function ChatWindow({
  initialMessages,
  chatId: initialChatId,
  programId,
  exerciseId,
  chatType,
  userInitial,
  avatarUrl,
  welcomeMessage,
  quickReplies,
  children,
}: ChatWindowProps) {
  const [currentChatId, setCurrentChatId] = useState<string | null>(initialChatId);
  const chatIdRef = useRef<string | null>(initialChatId);
  const { refreshChatList } = useChatListRefresh();
  const [showQuickReplies, setShowQuickReplies] = useState(initialMessages.length === 0);
  const [validationHint, setValidationHint] = useState<string | null>(null);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);

  const {
    messages,
    sendMessage,
    status,
    error,
    regenerate,
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        chatId: chatIdRef.current,
        programId,
        exerciseId,
        chatType,
      }),
    }),
    messages: initialMessages,
    onFinish: ({ message }) => {
      // Получаем chatId из metadata ответа
      const meta = message as UIMessage & { metadata?: Record<string, unknown> };
      if (meta.metadata?.chatId) {
        const newId = meta.metadata.chatId as string;
        chatIdRef.current = newId; // Ref — мгновенно, для следующего запроса
        if (!currentChatId) {
          setCurrentChatId(newId);
          // URL update: /chat → /chat/newId, /exercise/N → /exercise/N/newId
          const path = window.location.pathname;
          if (path.endsWith("/chat") || path.endsWith("/author-chat") || /\/exercise\/\d+$/.test(path)) {
            window.history.replaceState(null, "", `${path}/${newId}`);
          }
        } else {
          setCurrentChatId(newId);
        }
      }
      // Обновляем список чатов в sidebar (новый чат / обновление preview)
      refreshChatList();
    },
    onError: (err) => {
      console.error("Chat error:", err);
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // --- Scroll logic ---
  const scrollToBottom = useCallback(() => {
    if (messagesRef.current && !isUserScrolledUp.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  function handleScroll() {
    const el = messagesRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 50;
    isUserScrolledUp.current = !atBottom;
    setShowScrollFab(distanceFromBottom > 200);
  }

  function scrollToBottomForced() {
    if (messagesRef.current) {
      messagesRef.current.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
      isUserScrolledUp.current = false;
      setShowScrollFab(false);
    }
  }

  // --- Send ---
  function handleSend(text: string) {
    const msgText = text.trim();
    if (!msgText || isStreaming) return;

    setValidationHint(null);
    setShowQuickReplies(false);
    isUserScrolledUp.current = false;

    sendMessage({
      text: msgText,
    });
  }

  // --- Render helpers ---
  function getMessageText(msg: UIMessage): string {
    return msg.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
  }

  function renderContent(content: string, isAi: boolean) {
    if (!content) return null;
    if (isAi) {
      return <ReactMarkdown>{content}</ReactMarkdown>;
    }
    return content.split("\n\n").map((paragraph, i) => (
      <p key={i}>{paragraph}</p>
    ));
  }

  function isErrorMessage(content: string) {
    return /Ошибка|Недостаточно/.test(content);
  }

  function renderErrorCard(text: string, onRetry: () => void) {
    const type = classifyError(text);
    return (
      <div className="error-card">
        <div className="msg-avatar ai" />
        <div className="error-card-bubble" role="alert">
          <p>{text}</p>
          {type === "limit" ? (
            <a className="error-link-btn" href={`/program/${getSlugFromPath()}/balance`}>
              Перейти к тарифам →
            </a>
          ) : (
            <button className="error-retry-btn" onClick={onRetry}>
              ↻ Повторить
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderUserAvatar() {
    return (
      <div className="msg-avatar user">
        {avatarUrl
          ? <img src={avatarUrl} alt="" className="msg-avatar-img" />
          : "Я"}
      </div>
    );
  }

  // Show welcome AI message when no history exists
  const showWelcome = welcomeMessage && initialMessages.length === 0;

  return (
    <div className="chat-zone">
      <div className="chat-messages" ref={messagesRef} onScroll={handleScroll} role="log" aria-live="polite">
        <div className="chat-inner">
          {children}

          {showWelcome && (
            <div className="msg msg-ai" role="article">
              <div className="msg-avatar ai" />
              <div className="msg-bubble">
                <ReactMarkdown>{welcomeMessage}</ReactMarkdown>
              </div>
            </div>
          )}

          {showQuickReplies && quickReplies && quickReplies.length > 0 && (
            <div className="quick-replies">
              {initialMessages.length === 0 && (
                <div className="quick-reply-label">Выбери вариант или напиши своё</div>
              )}
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
            const isThinking = status === "submitted" && isLast && isAi && !text;

            if (isThinking) return null;

            // Error message → ErrorCard
            if (isAi && !isStreaming && isLast && isErrorMessage(text)) {
              return (
                <div key={msg.id} role="article">
                  {renderErrorCard(text, () => regenerate())}
                </div>
              );
            }

            return (
              <div key={msg.id} className={`msg ${isAi ? "msg-ai" : "msg-user"}`} role="article">
                {isAi
                  ? <div className="msg-avatar ai" />
                  : renderUserAvatar()}
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
              <div className="msg-avatar ai" />
              <div className="thinking-bubble">
                <div className="thinking-dot" />
                <div className="thinking-dot" />
                <div className="thinking-dot" />
              </div>
            </div>
          )}

          {error && renderErrorCard(
            error.message || "Произошла ошибка. Давай попробуем ещё раз?",
            () => regenerate()
          )}
        </div>
      </div>

      <button
        className={`scroll-fab ${showScrollFab ? "visible" : ""}`}
        onClick={scrollToBottomForced}
        aria-label="Прокрутить вниз"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
      </button>

      <div className="chat-input-wrap">
        <div className="chat-input-inner">
          <InputBar
            mode={exerciseId ? "exercise" : "chat"}
            disabled={isStreaming}
            onSend={handleSend}
            footer={
              <>
                {validationHint && (
                  <div className="input-validation-hint">{validationHint}</div>
                )}
                <div className="input-privacy">
                  {"🔒 Всё, что ты напишешь, остаётся между нами"}
                </div>
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}
