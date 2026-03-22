"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import type { UIMessage } from "ai";
import type { WelcomeConfig } from "@/types/welcome";
import { ArrowRightIcon } from "@/components/icons/hub-icons";
import { useChatListRefresh } from "@/contexts/ChatListContext";
import InputBar from "@/components/InputBar/InputBar";

interface NewChatScreenProps {
  slug: string;
  programId: string;
  coverUrl: string | null;
  welcome: WelcomeConfig;
  topic?: string;
  tool?: string;
  initialMessage?: string;
}

export function NewChatScreen({
  slug,
  programId,
  coverUrl,
  welcome,
  topic,
  tool,
  initialMessage,
}: NewChatScreenProps) {
  const router = useRouter();
  const { refreshChatList } = useChatListRefresh();
  const [showWelcome, setShowWelcome] = useState(true);
  const [showReplies, setShowReplies] = useState(true);
  const [chatId, setChatId] = useState<string | null>(null);
  const chatIdRef = useRef<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [retryText, setRetryText] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const initialMessageSent = useRef(false);

  const chatType = welcome.chatType || "free";
  const topicContext = topic
    ? welcome.systemContext || `Тема: ${welcome.title}`
    : undefined;

  const {
    messages,
    sendMessage,
    status,
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        chatId: chatIdRef.current,
        programId,
        chatType,
        topicKey: topic,
        toolKey: tool,
        topicContext,
        chatTitle: welcome.title,
      }),
    }),
    onFinish: ({ message }) => {
      const meta = message as UIMessage & { metadata?: Record<string, unknown> };
      if (meta.metadata?.chatId) {
        const newId = meta.metadata.chatId as string;
        chatIdRef.current = newId;
        if (!chatId) {
          setChatId(newId);
          // Тихо обновить URL
          window.history.replaceState(
            null,
            "",
            `/program/${slug}/chat/${newId}`,
          );
        }
      }
      refreshChatList();
    },
    onError: (err) => {
      console.error("[NewChat] Stream error:", err);
      setErrorText("Не удалось отправить сообщение. Попробуй ещё раз.");
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-send initial message from Hub input bar
  useEffect(() => {
    if (initialMessage && !initialMessageSent.current) {
      initialMessageSent.current = true;
      handleFirstMessage(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  function handleFirstMessage(text: string) {
    if (isStreaming) return;
    setErrorText(null);
    setRetryText(text);

    // Анимация: скрыть replies (welcome card остаётся)
    setShowReplies(false);

    // Отправить через useChat — стриминг автоматический
    sendMessage({ text: text.trim() });
  }

  function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    if (messages.length === 0) {
      handleFirstMessage(trimmed);
    } else {
      setErrorText(null);
      sendMessage({ text: trimmed });
    }
  }

  function handleRetry() {
    if (retryText) {
      setErrorText(null);
      sendMessage({ text: retryText.trim() });
    }
  }

  // Helper: extract text from UIMessage
  function getMessageText(msg: UIMessage): string {
    return msg.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
  }

  return (
    <div className="nc-screen">
      {/* Header */}
      <div className="nc-header">
        <button
          className="nc-back"
          onClick={() => router.push(`/program/${slug}/hub`)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="nc-header-info">
          <span className="nc-header-title">{welcome.title}</span>
          <span className="nc-header-sub">{welcome.modeLabel}</span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="nc-scroll" ref={messagesRef}>
        {/* Welcome card — fades out */}
        <div className={`wc${showWelcome ? "" : " wc-exit"}`}>
          {coverUrl && (
            <div className="wc-book">
              <img src={coverUrl} alt="" />
            </div>
          )}
          <div className="wc-mode">{welcome.modeLabel}</div>
          <div className="wc-title">{welcome.title}</div>
          <div className="wc-sub">{welcome.subtitle}</div>
        </div>

        {/* Welcome AI message — always visible */}
        <div className="nc-ai-msg">
          <div className="nc-ai-avatar" />
          <div className="nc-ai-text">{welcome.aiMessage}</div>
        </div>

        {/* Quick replies — fade out after first message */}
        {showReplies && (
          <div className={`nc-replies${messages.length > 0 ? " nc-replies-exit" : ""}`}>
            {welcome.replies.map((reply) => (
              <button
                key={reply.text}
                className={`nc-reply${reply.type === "exit" ? " nc-reply-exit" : ""}`}
                onClick={() => handleFirstMessage(reply.text)}
                disabled={isStreaming}
              >
                {reply.text}
                <ArrowRightIcon size={14} />
              </button>
            ))}
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg) => {
          const text = getMessageText(msg);
          if (!text) return null;

          if (msg.role === "user") {
            return (
              <div key={msg.id} className="nc-msg nc-msg-user">
                <div className="nc-bubble nc-bubble-user">{text}</div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="nc-msg nc-msg-ai">
              <div className="nc-ai-avatar" />
              <div className="nc-bubble nc-bubble-ai">
                <ReactMarkdown>{text}</ReactMarkdown>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isStreaming && messages.length > 0 && !getMessageText(messages[messages.length - 1]) && (
          <div className="nc-msg nc-msg-ai">
            <div className="nc-ai-avatar" />
            <div className="nc-bubble nc-bubble-ai nc-typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        {/* Error card */}
        {errorText && (
          <div className="nc-error">
            <p>{errorText}</p>
            <button className="nc-error-btn" onClick={handleRetry}>
              ↻ Повторить
            </button>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="nc-input-wrap">
        <InputBar
          mode="chat"
          placeholder={messages.length > 0 ? "Сообщение..." : "Или напиши своё..."}
          disabled={isStreaming}
          onSend={handleSend}
        />
      </div>
    </div>
  );
}
