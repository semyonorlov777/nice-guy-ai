"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import MessageBubble from "@mini/voice/components/MessageBubble";
import Recorder from "@mini/voice/components/Recorder";
import type { Chat, Message } from "@mini/voice/lib/types";

const POLL_INTERVAL_MS = 5000;

export default function ChatPage() {
  const params = useParams<{ chatId: string }>();
  const router = useRouter();
  const chatId = params?.chatId ?? "";

  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!chatId) return;
    try {
      const res = await fetch(`/api/voice/chats/${chatId}/messages`, { cache: "no-store" });
      if (res.status === 404) {
        setError("Чат не найден");
        return;
      }
      const data = (await res.json()) as { chat?: Chat; messages?: Message[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не удалось загрузить");
        return;
      }
      if (data.chat) setChat(data.chat);
      if (data.messages) setMessages(data.messages);
    } catch {
      setError("Не удалось загрузить");
    }
  }, [chatId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!chatId) return;
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [chatId, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const handleCopyAll = async () => {
    if (messages.length === 0) return;
    const text = messages.map((m) => m.text).join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {}
  };

  const handleDelete = async () => {
    if (!chatId) return;
    if (!confirm("Удалить заметку со всеми сообщениями?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/voice/chats/${chatId}/messages`, { method: "DELETE" });
      if (res.ok) router.push("/voice");
      else setError("Не удалось удалить");
    } finally {
      setBusy(false);
    }
  };

  const startEditTitle = () => {
    setTitleDraft(chat?.title ?? "");
    setEditingTitle(true);
  };

  const saveTitle = async () => {
    if (!chatId || !titleDraft.trim()) {
      setEditingTitle(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/voice/chats/${chatId}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleDraft.trim() }),
      });
      if (res.ok) {
        setChat((c) => (c ? { ...c, title: titleDraft.trim() } : c));
      }
    } finally {
      setBusy(false);
      setEditingTitle(false);
    }
  };

  if (error) {
    return (
      <main className="voice-page">
        <div className="voice-container">
          <Link href="/voice" className="voice-back">← К списку</Link>
          <div className="voice-banner-error">{error}</div>
        </div>
      </main>
    );
  }

  const isInbox = chat?.kind === "inbox";

  return (
    <main className="voice-page voice-page-chat">
      <div className="voice-container">
        <header className="voice-chat-header">
          <Link href="/voice" className="voice-back">← К списку</Link>
          <div className="voice-chat-title-block">
            {editingTitle && !isInbox ? (
              <input
                className="voice-chat-title-input"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                autoFocus
                disabled={busy}
              />
            ) : (
              <h1
                className={`voice-chat-h1 ${isInbox ? "" : "is-editable"}`}
                onClick={isInbox ? undefined : startEditTitle}
              >
                {chat?.title ?? "…"}
              </h1>
            )}
            {isInbox && <span className="voice-chat-inbox-badge">Telegram Inbox</span>}
          </div>
          <div className="voice-chat-actions">
            {messages.length > 0 && (
              <button type="button" className="voice-action-btn" onClick={handleCopyAll}>
                {copyState === "copied" ? "Скопировано" : "Скопировать всё"}
              </button>
            )}
            {!isInbox && (
              <button type="button" className="voice-action-btn voice-action-danger" onClick={handleDelete} disabled={busy}>
                Удалить
              </button>
            )}
          </div>
        </header>

        <section className="voice-messages">
          {messages.length === 0 ? (
            <div className="voice-empty">
              {isInbox
                ? "Пришли голосовое боту в Telegram — оно появится здесь."
                : "Нажми «Записать» — голосовое расшифруется и сохранится."}
            </div>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
          <div ref={endRef} />
        </section>

        {!isInbox && (
          <footer className="voice-recorder-footer">
            <Recorder chatId={chatId} onMessageAdded={load} />
          </footer>
        )}
      </div>
    </main>
  );
}
