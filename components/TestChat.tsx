"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

export type TestMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

interface TestChatProps {
  mode: "anonymous" | "authenticated";
  sessionId?: string;
  chatId?: string;
  initialMessages?: TestMessage[];
  autoSendFirst?: string;
  onRequiresAuth: () => void;
  onTestComplete: (resultId: string) => void;
}

const QUICK_LABELS = [
  "Совсем нет",
  "Скорее нет",
  "Когда как",
  "Скорее да",
  "Точно да",
];

export function TestChat({
  mode,
  sessionId,
  chatId,
  initialMessages,
  autoSendFirst,
  onRequiresAuth,
  onTestComplete,
}: TestChatProps) {
  const [messages, setMessages] = useState<TestMessage[]>(
    initialMessages || []
  );
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashBtn, setFlashBtn] = useState<number | null>(null);
  const [locked, setLocked] = useState(false); // auth wall lock

  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isUserScrolledUp = useRef(false);
  const autoSentRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Track current messages for SSE callback closure
  const messagesLive = useRef(messages);
  messagesLive.current = messages;

  // Unlock when switching to authenticated mode (after migration)
  useEffect(() => {
    if (mode === "authenticated") {
      setLocked(false);
    }
  }, [mode]);

  // Auto-send first message
  useEffect(() => {
    if (autoSendFirst && !autoSentRef.current && messages.length === 0) {
      autoSentRef.current = true;
      sendMessage(autoSendFirst);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSendFirst]);

  // Auto-scroll
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

  // Estimate progress: count user messages minus the first "start" message
  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const answeredCount = Math.max(0, userMsgCount - 1);

  const inputDisabled = isStreaming || locked;

  // SSE streaming
  async function sendMessage(text: string) {
    if (isStreaming || locked) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    setError(null);
    setIsStreaming(true);
    isUserScrolledUp.current = false;

    const userMsg: TestMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    const prevMessages = [...messagesLive.current, userMsg];
    setMessages(prevMessages);

    const assistantId = `ai-${Date.now()}`;

    // Build request body
    const body =
      mode === "anonymous"
        ? {
            message: trimmed,
            test_slug: "issp",
            session_id: sessionId,
            messages: prevMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }
        : {
            message: trimmed,
            test_slug: "issp",
            chat_id: chatId,
          };

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch("/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Ошибка сервера: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Нет потока ответа");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let gotRequiresAuth = false;

      // Add empty assistant message
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(trimmedLine.slice(6));

            if (data.type !== "delta") {
              console.log("[TestChat SSE]", data.type, data);
            }

            if (data.type === "delta") {
              fullText += data.content;
              const captured = fullText;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: captured } : m
                )
              );
            } else if (data.type === "requires_auth") {
              gotRequiresAuth = true;
              setLocked(true);
            } else if (data.type === "test_complete") {
              onTestComplete(data.result_id);
            } else if (data.type === "error") {
              setError(data.message || "Ошибка");
            }
          } catch {
            // skip malformed JSON
          }
        }
      }

      // Notify requires_auth after stream ends
      if (gotRequiresAuth) {
        onRequiresAuth();
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message || "Ошибка соединения");
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function handleSend(text?: string) {
    const msgText = (text || input).trim();
    if (!msgText || isStreaming) return;
    if (!text) {
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
    sendMessage(msgText);
  }

  function handleQuickBtn(value: number) {
    if (isStreaming) return;
    setFlashBtn(value);
    setTimeout(() => setFlashBtn(null), 200);
    handleSend(String(value));
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleRetry() {
    setError(null);
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      // Remove the last user message and any empty assistant after it
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === lastUserMsg.id);
        return idx >= 0 ? prev.slice(0, idx) : prev;
      });
      setTimeout(() => sendMessage(lastUserMsg.content), 100);
    }
  }

  const hasInput = input.trim().length > 0;

  // Progress bar: 7 segments (5 questions each)
  const segments = Array.from({ length: 7 }, (_, i) => {
    const segStart = i * 5;
    const segEnd = segStart + 5;
    const filled = Math.min(Math.max(answeredCount - segStart, 0), 5);
    return (filled / 5) * 100;
  });

  return (
    <div className="test-chat-zone">
      {/* Progress bar */}
      {answeredCount > 0 && (
        <div className="test-progress">
          <div className="test-progress-info">
            <strong>{Math.min(answeredCount, 35)}</strong> из 35
          </div>
          <div className="test-progress-segments">
            {segments.map((pct, i) => (
              <div key={i} className="test-progress-seg">
                <div
                  className="test-progress-seg-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        className="test-chat-messages"
        ref={messagesRef}
        onScroll={handleScroll}
      >
        {messages.map((msg) => {
          const isAi = msg.role === "assistant";
          return (
            <div
              key={msg.id}
              className={`msg ${isAi ? "msg-ai" : "msg-user"}`}
            >
              <div className={`msg-avatar ${isAi ? "ai" : "user"}`}>
                {isAi ? "НС" : "?"}
              </div>
              <div className="msg-bubble">
                {isAi ? (
                  <>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    {isStreaming &&
                      msg.id === messages[messages.length - 1]?.id &&
                      msg.content && (
                        <span className="streaming-cursor">{"▊"}</span>
                      )}
                  </>
                ) : (
                  msg.content
                    .split("\n\n")
                    .map((p, i) => <p key={i}>{p}</p>)
                )}
              </div>
            </div>
          );
        })}

        {isStreaming &&
          messages.length > 0 &&
          messages[messages.length - 1]?.role === "user" && (
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
          <div className="test-error">
            {error}
            <button onClick={handleRetry}>Повторить</button>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="test-chat-input-area">
        <div className="test-chat-input-row">
          <textarea
            ref={textareaRef}
            className="test-chat-input"
            placeholder="Напиши ответ..."
            rows={1}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={inputDisabled}
          />
          <button
            className={`test-chat-send-btn ${hasInput ? "active" : ""}`}
            onClick={() => handleSend()}
            disabled={inputDisabled || !hasInput}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>

        {/* Quick reply buttons */}
        <div className="test-divider-or">
          <span>или быстрый ответ</span>
        </div>
        <div className="test-quick-buttons">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={`test-quick-btn${flashBtn === n ? " flash" : ""}`}
              onClick={() => handleQuickBtn(n)}
              disabled={inputDisabled}
            >
              <span className="qb-num">{n}</span>
              <span className="qb-label">{QUICK_LABELS[n - 1]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
