"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { InChatAuth } from "@/components/InChatAuth";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AnonymousChatProps {
  programSlug: string;
  welcomeMessage: string;
  quickReplies: string[];
  scrollToSectionId?: string;
}

export function AnonymousChat({
  programSlug,
  welcomeMessage,
  quickReplies,
  scrollToSectionId,
}: AnonymousChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [mounted, setMounted] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isUserScrolledUp = useRef(false);
  const sessionIdRef = useRef<string>("");

  const storageKeyMessages = `anon_chat_${programSlug}_messages`;
  const storageKeySession = `anon_chat_${programSlug}_session_id`;

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(storageKeySession);
      if (savedSession) {
        sessionIdRef.current = savedSession;
      } else {
        const newId = crypto.randomUUID();
        sessionIdRef.current = newId;
        localStorage.setItem(storageKeySession, newId);
      }

      const savedMessages = localStorage.getItem(storageKeyMessages);
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages) as Message[];
        if (parsed.length > 0) {
          setMessages(parsed);
          setShowQuickReplies(false);
        }
      }
    } catch {
      sessionIdRef.current = crypto.randomUUID();
    }
    setMounted(true);
  }, [storageKeyMessages, storageKeySession]);

  // Save messages to localStorage on change
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(storageKeyMessages, JSON.stringify(messages));
    } catch {
      // localStorage full or unavailable
    }
  }, [messages, mounted, storageKeyMessages]);

  const scrollToBottom = useCallback(() => {
    if (messagesRef.current && !isUserScrolledUp.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      // On landing: scroll page to chat section if it's not visible
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
      sendMessage();
    }
  }

  async function sendMessage(text?: string) {
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

    const userMsg: Message = { role: "user", content: msgText };
    const aiMsg: Message = { role: "assistant", content: "" };

    const updatedMessages = [...messages, userMsg];

    setMessages([...updatedMessages, aiMsg]);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat/anonymous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          messages: updatedMessages,
          program_slug: programSlug,
        }),
      });

      if (response.status === 429) {
        const data = await response.json();
        if (data.requiresAuth) {
          setRequiresAuth(true);
          // Remove the empty AI message
          setMessages(updatedMessages);
          return;
        }
      }

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
            if (data.type === "delta") {
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
      console.error("Anonymous chat error:", error);
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
    const lastUserIdx = messages.findLastIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;
    const lastUserText = messages[lastUserIdx].content;
    setMessages((prev) => prev.slice(0, -1));
    sendMessage(lastUserText);
  }

  function isErrorMessage(content: string) {
    return /Ошибка|Недостаточно/.test(content);
  }

  async function handleAuthSuccess() {
    try {
      const res = await fetch("/api/chat/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_slug: programSlug,
          messages,
          session_id: sessionIdRef.current,
        }),
      });

      // Clear localStorage regardless of migration result
      try {
        localStorage.removeItem(storageKeyMessages);
        localStorage.removeItem(storageKeySession);
      } catch { /* ignore */ }

      if (res.ok) {
        window.location.href = `/program/${programSlug}/chat`;
      } else {
        // Migration failed but user is authenticated — redirect anyway
        window.location.href = `/program/${programSlug}/chat`;
      }
    } catch {
      // Network error — user is authenticated, just redirect
      window.location.href = `/program/${programSlug}/chat`;
    }
  }

  // Don't render until mounted (avoid hydration mismatch with localStorage)
  if (!mounted) return null;

  return (
    <div className="chat-zone">
      <div className="chat-messages" ref={messagesRef} onScroll={handleScroll}>
        <div className="chat-inner">
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
                  {isAi ? "НС" : "?"}
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

          {requiresAuth && (
            <InChatAuth onAuthSuccess={handleAuthSuccess} />
          )}
        </div>
      </div>

      <div className="chat-input-wrap">
        <div className="chat-input-inner">
          <div className="chat-input-row">
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
            <button
              className="send-btn"
              onClick={() => sendMessage()}
              disabled={isStreaming || !input.trim() || requiresAuth}
            >
              {"↑"}
            </button>
          </div>
          <div className="input-privacy">
            {"🔒 Анонимный чат. Данные не сохраняются на сервере."}
          </div>
        </div>
      </div>
    </div>
  );
}
