"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatWindowProps {
  initialMessages: Message[];
  chatId: string | null;
  programId: string;
  exerciseId?: string;
  userInitial: string;
  welcomeMessage?: string;
  quickReplies?: string[];
  children?: React.ReactNode;
}

export function ChatWindow({
  initialMessages,
  chatId: initialChatId,
  programId,
  exerciseId,
  userInitial,
  welcomeMessage,
  quickReplies,
  children,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatId, setChatId] = useState<string | null>(initialChatId);
  const [showQuickReplies, setShowQuickReplies] = useState(
    initialMessages.length === 0
  );
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isUserScrolledUp = useRef(false);

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

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 100) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function sendMessage(text?: string) {
    const msgText = (text || input).trim();
    if (!msgText || isStreaming) return;

    if (!text) {
      // Only clear input if not a quick reply
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }

    setShowQuickReplies(false);
    isUserScrolledUp.current = false;

    // Add user message + empty AI message for streaming
    setMessages((prev) => [
      ...prev,
      { role: "user", content: msgText },
      { role: "assistant", content: "" },
    ]);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msgText,
          chatId,
          programId,
          exerciseId,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Ошибка сервера");
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "chat_id") {
              setChatId(data.chatId);
            } else if (data.type === "delta") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + data.content,
                };
                return updated;
              });
            } else if (data.type === "error") {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: data.message || "Произошла ошибка",
                };
                return updated;
              });
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg =
        error instanceof Error ? error.message : "Произошла ошибка";
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant" && !last.content) {
          updated[updated.length - 1] = {
            role: "assistant",
            content: errorMsg,
          };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
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

  function handleRetry() {
    // Find the last user message
    const lastUserIdx = messages.findLastIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;
    const lastUserText = messages[lastUserIdx].content;
    // Remove the last AI message
    setMessages((prev) => prev.slice(0, -1));
    sendMessage(lastUserText);
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
                {renderContent(welcomeMessage, true)}
              </div>
            </div>
          )}

          {showQuickReplies && quickReplies && quickReplies.length > 0 && (
            <div className="quick-replies">
              {quickReplies.map((text, i) => (
                <button
                  key={i}
                  className="quick-reply-btn"
                  onClick={() => sendMessage(text)}
                  disabled={isStreaming}
                >
                  {text}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg, i) => {
            const isAi = msg.role === "assistant";
            const isLast = i === messages.length - 1;
            const isThinking = isStreaming && isLast && isAi && !msg.content;
            if (isThinking) return null;
            return (
              <div
                key={i}
                className={`msg ${isAi ? "msg-ai" : "msg-user"}`}
              >
                <div className={`msg-avatar ${isAi ? "ai" : "user"}`}>
                  {isAi ? "НС" : userInitial}
                </div>
                <div className="msg-bubble">
                  {renderContent(msg.content, isAi)}
                  {isStreaming && isLast && isAi && (
                    <span className="streaming-cursor">{"▊"}</span>
                  )}
                  {!isStreaming && isLast && isAi && isErrorMessage(msg.content) && (
                    <button className="retry-btn" onClick={handleRetry}>
                      Повторить
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {isStreaming &&
            messages.length > 0 &&
            messages[messages.length - 1]?.content === "" && (
              <div className="thinking-indicator">
                думаю
                <span className="thinking-dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </div>
            )}
        </div>
      </div>

      <div className="chat-input-wrap">
        <div className="chat-input-inner">
          <div className="chat-input-row">
            <textarea
              ref={textareaRef}
              className="chat-input"
              placeholder="Или напиши своими словами..."
              rows={1}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
            />
            <button
              className="send-btn"
              onClick={() => sendMessage()}
              disabled={isStreaming || !input.trim()}
            >
              {"↑"}
            </button>
          </div>
          <div className="input-privacy">
            {"🔒 Всё, что ты напишешь, остаётся между нами"}
          </div>
        </div>
      </div>
    </div>
  );
}
