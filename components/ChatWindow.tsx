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
  chatType?: "exercise" | "free" | "test";
  userInitial: string;
  welcomeMessage?: string;
  quickReplies?: string[];
  testResultId?: string | null;
  children?: React.ReactNode;
}

export function ChatWindow({
  initialMessages,
  chatId: initialChatId,
  programId,
  exerciseId,
  chatType,
  userInitial,
  welcomeMessage,
  quickReplies,
  testResultId: initialTestResultId,
  children,
}: ChatWindowProps) {
  const [currentChatId, setCurrentChatId] = useState<string | null>(initialChatId);
  const chatIdRef = useRef<string | null>(initialChatId);
  const { refreshChatList } = useChatListRefresh();
  const [showQuickReplies, setShowQuickReplies] = useState(initialMessages.length === 0);
  const [testResultId, setTestResultId] = useState<string | null>(initialTestResultId ?? null);
  const [validationHint, setValidationHint] = useState<string | null>(null);
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
          if (path.endsWith("/chat") || /\/exercise\/\d+$/.test(path)) {
            window.history.replaceState(null, "", `${path}/${newId}`);
          }
        } else {
          setCurrentChatId(newId);
        }
      }
      // Ссылка на результаты теста ИССП
      if (meta.metadata?.testResultId) {
        setTestResultId(meta.metadata.testResultId as string);
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
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    isUserScrolledUp.current = !atBottom;
  }

  // --- Send ---
  function handleSend(text: string) {
    const msgText = text.trim();
    if (!msgText || isStreaming) return;

    // Клиентская валидация для ИССП-теста: числа вне 1-5 не отправляем
    if (chatType === "test" && /^\d+$/.test(msgText) && !/^[1-5]$/.test(msgText)) {
      setValidationHint("Введи число от 1 до 5 или ответь своими словами");
      return;
    }
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

  // Show welcome AI message when no history exists
  const showWelcome = welcomeMessage && initialMessages.length === 0;

  return (
    <div className="chat-zone">
      <div className="chat-messages" ref={messagesRef} onScroll={handleScroll}>
        <div className="chat-inner">
          {children}

          {showWelcome && (
            <div className="msg msg-ai">
              <div className="msg-avatar ai">НС</div>
              <div className="msg-bubble">
                <ReactMarkdown>{welcomeMessage}</ReactMarkdown>
              </div>
            </div>
          )}

          {showQuickReplies && quickReplies && quickReplies.length > 0 && (
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
            const isThinking = status === "submitted" && isLast && isAi && !text;

            if (isThinking) return null;

            return (
              <div key={msg.id} className={`msg ${isAi ? "msg-ai" : "msg-user"}`}>
                <div className={`msg-avatar ${isAi ? "ai" : "user"}`}>
                  {isAi ? "НС" : userInitial}
                </div>
                <div className="msg-bubble">
                  {renderContent(text, isAi)}
                  {status === "streaming" && isLast && isAi && (
                    <span className="streaming-cursor">{"▊"}</span>
                  )}
                  {!isStreaming && isLast && isAi && isErrorMessage(text) && (
                    <button className="retry-btn" onClick={() => regenerate()}>
                      Повторить
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {testResultId && !isStreaming && (
            <div style={{ textAlign: "center", margin: "20px 0" }}>
              <a
                href={`/test/results/${testResultId}`}
                style={{
                  display: "inline-block",
                  background: "#c9a84c",
                  color: "#1a1a1a",
                  fontWeight: 600,
                  fontSize: "1rem",
                  padding: "14px 32px",
                  borderRadius: "12px",
                  textDecoration: "none",
                }}
              >
                Посмотреть подробные результаты
              </a>
            </div>
          )}

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

          {error && (
            <div className="msg msg-ai">
              <div className="msg-avatar ai">НС</div>
              <div className="msg-bubble">
                <p>{error.message || "Произошла ошибка"}</p>
                <button className="retry-btn" onClick={() => regenerate()}>
                  Повторить
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

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
