"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChatListItemFull } from "./ChatListItemFull";
import { PlusIcon } from "@/components/icons/hub-icons";
import { groupChatsByDate } from "@/lib/chat-utils";
import { useChatListRefresh } from "@/contexts/ChatListContext";
import type { ChatItemData } from "@/components/ChatListItem";

interface ChatListPageProps {
  slug: string;
  programId: string;
  initialChats: ChatItemData[];
}

export function ChatListPage({ slug, programId, initialChats }: ChatListPageProps) {
  const router = useRouter();
  const [chats, setChats] = useState(initialChats);
  const { onRefresh } = useChatListRefresh();

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch(`/api/chats?programId=${programId}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats);
      }
    } catch {
      // silent
    }
  }, [programId]);

  useEffect(() => {
    return onRefresh(fetchChats);
  }, [onRefresh, fetchChats]);

  const groups = groupChatsByDate(chats);
  const isEmpty = chats.length === 0;

  return (
    <div className="cl-page">
      {/* Header */}
      <div className="m-header">
        <h1 className="m-header-title">Чаты</h1>
        <button
          className="m-header-btn"
          onClick={() => router.push(`/program/${slug}/hub`)}
          title="Новый чат"
        >
          <PlusIcon size={20} />
        </button>
      </div>

      {/* Chat list */}
      <div className="cl-scroll">
        {isEmpty ? (
          <div className="cl-empty">
            <div className="cl-empty-orb" />
            <div className="cl-empty-title">Пока нет чатов</div>
            <div className="cl-empty-desc">
              Начни разговор на Главной — выбери тему или просто напиши
            </div>
            <button
              className="cl-empty-btn"
              onClick={() => router.push(`/program/${slug}/hub`)}
            >
              Перейти на Главную
            </button>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <div className="cl-date-label">{group.label}</div>
              {group.chats.map((chat) => (
                <ChatListItemFull key={chat.id} chat={chat} slug={slug} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
