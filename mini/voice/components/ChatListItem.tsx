"use client";

import Link from "next/link";
import type { ChatWithLastMessage } from "@mini/voice/lib/types";

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const today = d.toDateString() === now.toDateString();
  return today
    ? d.toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString("ru-RU", { day: "2-digit", month: "short" });
}

export default function ChatListItem({ chat }: { chat: ChatWithLastMessage }) {
  const isInbox = chat.kind === "inbox";
  return (
    <Link href={`/voice/${chat.id}`} className="voice-chat-item">
      <div className="voice-chat-icon" aria-hidden="true">
        {isInbox ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M21 3L3 10l7 3 3 7 8-17z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="voice-chat-body">
        <div className="voice-chat-title-row">
          <span className="voice-chat-title">{chat.title}</span>
          <span className="voice-chat-time">{formatTime(chat.last_message_at ?? chat.updated_at)}</span>
        </div>
        <div className="voice-chat-preview">
          {chat.last_message_text
            ? chat.last_message_text.slice(0, 120)
            : isInbox
              ? "Сюда падают голосовые из Telegram"
              : "Пусто — нажми внутри, чтобы записать"}
        </div>
        {chat.message_count > 0 && <div className="voice-chat-count">{chat.message_count}</div>}
      </div>
    </Link>
  );
}
