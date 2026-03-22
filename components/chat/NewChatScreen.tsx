"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { WelcomeConfig } from "@/lib/welcome-config";
import { ArrowRightIcon } from "@/components/icons/hub-icons";

interface NewChatScreenProps {
  slug: string;
  programId: string;
  coverUrl: string | null;
  welcome: WelcomeConfig;
  topic?: string;
  tool?: string;
}

export function NewChatScreen({
  slug,
  programId,
  coverUrl,
  welcome,
  topic,
  tool,
}: NewChatScreenProps) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const sendMessage = useCallback(
    async (text: string) => {
      if (sending || !text.trim()) return;
      setSending(true);

      try {
        // Create chat via API — sends first message
        const chatType = welcome.chatType || "free";
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ parts: [{ type: "text", text: text.trim() }] }],
            programId,
            chatType,
            topicKey: topic,
            toolKey: tool,
          }),
        });

        if (!res.ok) {
          console.error("[NewChat] API error:", res.status);
          setSending(false);
          return;
        }

        // Extract chatId from stream metadata
        const reader = res.body?.getReader();
        if (!reader) {
          setSending(false);
          return;
        }

        const decoder = new TextDecoder();
        let chatId: string | null = null;

        // Read stream to find chatId in metadata
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          // Parse metadata from UI message stream
          const metaMatch = chunk.match(/"chatId"\s*:\s*"([^"]+)"/);
          if (metaMatch) {
            chatId = metaMatch[1];
            break;
          }
        }

        // Cancel the rest of the stream — we just needed the chatId
        await reader.cancel();

        if (chatId) {
          // Replace URL so back button goes to Hub, not back to welcome
          router.replace(`/program/${slug}/chat/${chatId}`);
        } else {
          console.error("[NewChat] No chatId in stream response");
          setSending(false);
        }
      } catch (err) {
        console.error("[NewChat] Error:", err);
        setSending(false);
      }
    },
    [sending, programId, welcome.chatType, topic, tool, slug, router],
  );

  const handleReply = (text: string) => {
    sendMessage(text);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  return (
    <div className="nc-screen">
      {/* Back button — mobile only */}
      <div className="nc-header mobile-only">
        <button
          className="nc-back"
          onClick={() => router.push(`/program/${slug}/hub`)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="nc-header-title">{welcome.modeLabel}</span>
      </div>

      {/* Scrollable content */}
      <div className="nc-scroll">
        {/* Welcome card */}
        <div className="wc">
          {coverUrl && (
            <div className="wc-book">
              <img src={coverUrl} alt="" />
            </div>
          )}
          <div className="wc-mode">{welcome.modeLabel}</div>
          <div className="wc-title">{welcome.title}</div>
          <div className="wc-sub">{welcome.subtitle}</div>
        </div>

        {/* AI message */}
        <div className="nc-ai-msg">
          <div className="nc-ai-avatar" />
          <div className="nc-ai-text">{welcome.aiMessage}</div>
        </div>

        {/* Quick replies */}
        {!sending && (
          <div className="nc-replies">
            {welcome.replies.map((reply) => (
              <button
                key={reply.text}
                className={`nc-reply${reply.type === "exit" ? " nc-reply-exit" : ""}`}
                onClick={() => handleReply(reply.text)}
                disabled={sending}
              >
                {reply.text}
                <ArrowRightIcon size={14} />
              </button>
            ))}
          </div>
        )}

        {/* Loading state */}
        {sending && (
          <div className="nc-sending">
            <div className="nc-sending-dot" />
            <span>Создаю чат...</span>
          </div>
        )}
      </div>

      {/* Input bar */}
      <form className="nc-input-wrap" onSubmit={handleSubmit}>
        <div className="nc-input-bar">
          <input
            type="text"
            placeholder="Или напиши своё..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={sending}
          />
          <button
            type="submit"
            className="nc-input-send"
            disabled={sending || !inputValue.trim()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
