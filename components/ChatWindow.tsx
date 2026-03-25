"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import type { UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";
import InputBar from "@/components/InputBar/InputBar";
import { ChatHeader } from "@/components/ChatHeader";
import { useChatListRefresh } from "@/contexts/ChatListContext";
import { useWelcomeAnimation } from "@/hooks/useWelcomeAnimation";
import { isTelegramWebView } from "@/lib/detect-browser";

interface ChatWindowProps {
  initialMessages: UIMessage[];
  chatId: string | null;
  programId: string;
  exerciseId?: string;
  chatType?: string;
  userInitial: string;
  avatarUrl?: string | null;
  welcomeMessage?: string;
  quickReplies?: string[];
  children?: React.ReactNode;
  programTitle?: string;
  coverUrl?: string;
  balance?: number;
  slug?: string;
  currentModeKey?: string;
}

const MODE_NAMES: Record<string, string> = {
  free_chat: "Свободный чат",
  author_chat: "Разговор с автором",
  exercises: "Упражнения с психологом",
  ng_my_syndrome: "Мой синдром",
  ng_relationships: "Мои отношения",
  ng_parents: "Мои родители и я",
  ng_boundaries: "Тренировка границ",
  ng_quiz: "Славный парень или нет?",
  ng_theory: "Теория книги",
};

/**
 * Извлекает «кавычки-ёлочки» из конца текста как быстрые ответы.
 * Паттерн: строки вида «Текст» в конце сообщения (каждая на отдельной строке).
 */
function parseQuickReplies(text: string): { cleanText: string; replies: string[] } {
  // Ищем блок строк «...» в конце текста
  const lines = text.trimEnd().split("\n");
  const replies: string[] = [];
  let i = lines.length - 1;

  // Собираем строки с «кавычками» с конца
  while (i >= 0) {
    const line = lines[i].trim();
    if (!line) { i--; continue; } // пропускаем пустые строки
    const match = line.match(/^[«""](.+?)[»""]$/);
    if (match) {
      replies.unshift(match[1]);
      i--;
    } else {
      break;
    }
  }

  if (replies.length === 0) return { cleanText: text, replies: [] };

  const cleanText = lines.slice(0, i + 1).join("\n").trimEnd();
  return { cleanText, replies };
}

function classifyError(content: string): "limit" | "ai" {
  if (/Недостаточно|лимит|закончились/i.test(content)) return "limit";
  return "ai";
}

function getSlugFromPath(): string {
  const match = window.location.pathname.match(/\/program\/([^/]+)/);
  return match ? match[1] : DEFAULT_PROGRAM_SLUG;
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
  programTitle,
  coverUrl,
  balance,
  slug,
  currentModeKey,
}: ChatWindowProps) {
  const router = useRouter();
  const [currentChatId, setCurrentChatId] = useState<string | null>(initialChatId);
  const chatIdRef = useRef<string | null>(initialChatId);
  const { refreshChatList } = useChatListRefresh();
  const [showQuickReplies, setShowQuickReplies] = useState(initialMessages.length === 0);
  const chatZoneRef = useRef<HTMLDivElement>(null);
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

    if (animActive) skipWelcome();
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

  // Parse quick replies from welcome message (if not provided via props)
  const parsedWelcome = welcomeMessage ? parseQuickReplies(welcomeMessage) : null;
  const effectiveWelcomeMessage = parsedWelcome?.cleanText || welcomeMessage;
  const effectiveQuickReplies = quickReplies && quickReplies.length > 0
    ? quickReplies
    : parsedWelcome?.replies || [];

  // Parse quick replies from last AI message (inline «кавычки»)
  const lastMsg = messages[messages.length - 1];
  const lastAiText = lastMsg?.role === "assistant" ? getMessageText(lastMsg) : "";
  const parsedLastAi = lastAiText ? parseQuickReplies(lastAiText) : null;
  const inlineReplies = parsedLastAi?.replies || [];
  const showInlineReplies = !isStreaming && inlineReplies.length > 0 && messages.length > 0;

  // Welcome animation (first visit only)
  const shouldAnimate = Boolean(showWelcome) &&
    (typeof window === "undefined" || !localStorage.getItem("welcome_anim_done"));

  const {
    phase: welcomePhase,
    streamedText,
    showCursor,
    quickReplyStaggerIndex,
    inputPulseActive,
    skipToEnd: skipWelcome,
  } = useWelcomeAnimation({
    welcomeMessage: effectiveWelcomeMessage || "",
    enabled: shouldAnimate,
    storageKey: "welcome_anim_done",
    storageType: "local",
  });

  // Input pulse via DOM (InputBar doesn't accept className)
  useEffect(() => {
    if (!inputPulseActive) return;
    const el = chatZoneRef.current?.querySelector(".input-container");
    if (!el) return;
    el.classList.add("input-pulse");
    return () => el.classList.remove("input-pulse");
  }, [inputPulseActive]);

  // Telegram WebView на iOS неправильно позиционирует scroll — сбрасываем
  useEffect(() => {
    if (isTelegramWebView()) {
      window.scrollTo(0, 0);
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    }
  }, []);

  const animActive = shouldAnimate && welcomePhase !== "done";

  return (
    <div className="chat-zone" ref={chatZoneRef}>
      {programTitle && coverUrl && (
        <ChatHeader
          programTitle={programTitle}
          coverUrl={coverUrl}
          currentMode={MODE_NAMES[currentModeKey ?? ""] ?? "Свободный чат"}
          currentModeKey={currentModeKey}
          balance={balance}
          onBack={() => router.back()}
          slug={slug}
        />
      )}
      <div className="chat-messages" ref={messagesRef} onScroll={handleScroll} role="log" aria-live="polite">
        <div className="chat-inner">
          {children}

          {/* Thinking indicator during welcome animation */}
          {showWelcome && welcomePhase === "thinking" && (
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
          {showWelcome && welcomePhase !== "idle" && welcomePhase !== "thinking" && (
            <div className={`msg msg-ai${animActive ? " msg-welcome-enter" : ""}`} role="article">
              <div className="msg-avatar ai" />
              <div className="msg-bubble">
                <ReactMarkdown>{animActive ? streamedText : effectiveWelcomeMessage}</ReactMarkdown>
                {showCursor && <span className="streaming-cursor">{"▊"}</span>}
              </div>
            </div>
          )}

          {/* Quick replies (from props, welcome message, or parsed from welcome text) */}
          {showQuickReplies && effectiveQuickReplies.length > 0 &&
            (!animActive || welcomePhase === "quick-replies" || welcomePhase === "input-pulse") && (
            <div className="quick-replies">
              {initialMessages.length === 0 && (
                <div className="quick-reply-label">Выбери вариант или напиши своё</div>
              )}
              {effectiveQuickReplies.map((text, i) => {
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

            // Для последнего AI-сообщения: убираем «кавычки» из текста, показываем как кнопки ниже
            const displayText = (isAi && isLast && !isStreaming && parsedLastAi?.cleanText)
              ? parsedLastAi.cleanText
              : text;

            return (
              <div key={msg.id} className={`msg ${isAi ? "msg-ai" : "msg-user"}`} role="article" aria-busy={isAi && isLast && isStreaming ? true : undefined}>
                {isAi
                  ? <div className="msg-avatar ai" />
                  : renderUserAvatar()}
                <div className="msg-bubble">
                  {renderContent(displayText, isAi)}
                  {status === "streaming" && isLast && isAi && (
                    <span className="streaming-cursor">{"▊"}</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Inline quick replies parsed from last AI message */}
          {showInlineReplies && (
            <div className="quick-replies">
              <div className="quick-reply-label">Выбери вариант или напиши своё</div>
              {inlineReplies.map((text, i) => (
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

      <div className="chat-input-wrap" onFocusCapture={animActive ? skipWelcome : undefined}>
        <button
          className={`scroll-fab ${showScrollFab ? "visible" : ""}`}
          onClick={scrollToBottomForced}
          aria-label="Прокрутить вниз"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </button>
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
