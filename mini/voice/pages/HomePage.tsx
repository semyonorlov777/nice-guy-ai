"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChatListItem from "@mini/voice/components/ChatListItem";
import type { ChatWithLastMessage } from "@mini/voice/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatWithLastMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/voice/chats", { cache: "no-store" });
      const data = (await res.json()) as { chats?: ChatWithLastMessage[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не удалось загрузить");
        return;
      }
      setChats(data.chats ?? []);
    } catch {
      setError("Не удалось загрузить");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleNew = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/voice/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = (await res.json()) as { chat?: { id: string }; error?: string };
      if (res.ok && data.chat) {
        router.push(`/voice/${data.chat.id}`);
      } else {
        setError(data.error ?? "Не удалось создать");
      }
    } catch {
      setError("Не удалось создать");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="voice-page">
      <div className="voice-container">
        <header className="voice-header">
          <div>
            <h1 className="voice-title">Голосовые заметки</h1>
            <p className="voice-subtitle">Запиши мысль голосом — получи готовый текст.</p>
          </div>
          <button type="button" className="voice-new-btn" onClick={handleNew} disabled={creating}>
            {creating ? "…" : "+ Новая заметка"}
          </button>
        </header>

        {error && <div className="voice-banner-error">{error}</div>}

        {chats === null ? (
          <div className="voice-empty">Загрузка…</div>
        ) : chats.length === 0 ? (
          <div className="voice-empty">
            <p>Пока пусто. Создай первую заметку или пришли голосовое боту в Telegram.</p>
          </div>
        ) : (
          <ul className="voice-chat-list">
            {chats.map((chat) => (
              <li key={chat.id}>
                <ChatListItem chat={chat} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
