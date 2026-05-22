"use client";

import { useState } from "react";
import type { Message } from "@mini/voice/lib/types";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatDur(sec: number | null): string | null {
  if (!sec || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const dur = formatDur(message.audio_duration_sec);

  return (
    <article className={`voice-message voice-message-${message.source}`}>
      <header className="voice-message-meta">
        <span className="voice-message-source">
          {message.source === "telegram" ? "Из Telegram" : "Запись"}
        </span>
        <span className="voice-message-time">{formatTime(message.created_at)}</span>
        {dur && <span className="voice-message-duration">{dur}</span>}
      </header>
      <div className="voice-message-text">{message.text}</div>
      <button type="button" className="voice-message-copy" onClick={handleCopy} aria-label="Скопировать текст">
        {copied ? "Скопировано" : "Скопировать"}
      </button>
    </article>
  );
}
