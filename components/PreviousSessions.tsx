"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRelativeTime } from "@/lib/time";

interface Session {
  id: string;
  title: string;
  preview: string;
  lastMessageAt: string;
}

interface PreviousSessionsProps {
  sessions: Session[];
  slug: string;
  exerciseNumber: number;
}

export function PreviousSessions({
  sessions,
  slug,
  exerciseNumber,
}: PreviousSessionsProps) {
  const router = useRouter();

  return (
    <div className="prev-chats-section">
      <div className="prev-chats-header">
        <div className="prev-chats-label">Прошлые сессии</div>
        <button
          className="new-session-btn"
          onClick={() =>
            router.push(`/program/${slug}/exercise/${exerciseNumber}`)
          }
        >
          + Новая сессия
        </button>
      </div>
      {sessions.map((s) => (
        <Link
          key={s.id}
          href={`/program/${slug}/exercise/${exerciseNumber}/${s.id}`}
          className="prev-chat-item"
        >
          <div className="prev-chat-icon">{"💬"}</div>
          <div className="prev-chat-info">
            <div className="prev-chat-title">{s.title}</div>
            <div className="prev-chat-meta">
              <span className="prev-chat-preview">{s.preview}</span>
              <span className="prev-chat-time">
                {formatRelativeTime(s.lastMessageAt)}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
