"use client";

import Link from "next/link";
import { formatRelativeTime } from "@/lib/time";

export interface ChatItemData {
  id: string;
  title: string;
  chatType: string;
  exerciseNumber: number | null;
  preview: string;
  lastMessageAt: string;
}

interface ChatListItemProps {
  chat: ChatItemData;
  isActive: boolean;
  slug: string;
  onArchive: () => void;
}

export function ChatListItem({
  chat,
  isActive,
  slug,
  onArchive,
}: ChatListItemProps) {
  const href =
    chat.chatType === "exercise" && chat.exerciseNumber
      ? `/program/${slug}/exercise/${chat.exerciseNumber}/${chat.id}`
      : `/program/${slug}/chat/${chat.id}`;

  return (
    <Link
      href={href}
      className={`sidebar-chat-item${isActive ? " active" : ""}`}
    >
      <div className="sidebar-chat-title">{chat.title}</div>
      <div className="sidebar-chat-preview">
        {chat.preview || "Начни разговор..."}
      </div>
      <div className="sidebar-chat-time">
        {formatRelativeTime(chat.lastMessageAt)}
        {chat.exerciseNumber && (
          <span className="sidebar-chat-context">
            Упр. {chat.exerciseNumber}
          </span>
        )}
      </div>
      <button
        className="archive-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onArchive();
        }}
        title="Архивировать"
      >
        Архив
      </button>
    </Link>
  );
}
