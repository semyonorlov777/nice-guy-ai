"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ProfileMenu } from "@/components/ProfileMenu";
import { ChatListItem, type ChatItemData } from "@/components/ChatListItem";
import { useChatListRefresh } from "@/contexts/ChatListContext";
import type { ProgramFeatures } from "@/types/program";

interface UserInfo {
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

interface ProgramItem {
  slug: string;
  title: string;
  coverUrl: string | null;
}

interface SidebarProps {
  slug: string;
  programId: string;
  user?: UserInfo | null;
  features?: ProgramFeatures | null;
  initialChats: ChatItemData[];
  exerciseCount: number;
  programs: ProgramItem[];
}

export function Sidebar({
  slug,
  programId,
  user,
  features,
  initialChats,
  exerciseCount,
  programs,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/program/${slug}`;

  const [chats, setChats] = useState<ChatItemData[]>(initialChats);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });
  const { onRefresh } = useChatListRefresh();

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch(`/api/chats?programId=${programId}&limit=30`);
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats);
      }
    } catch {
      // silent fail
    }
  }, [programId]);

  useEffect(() => {
    return onRefresh(fetchChats);
  }, [onRefresh, fetchChats]);

  // Активный chatId из URL
  const activeChatId = (() => {
    const chatMatch = pathname.match(/\/chat\/([a-f0-9-]+)/);
    const exerciseMatch = pathname.match(/\/exercise\/\d+\/([a-f0-9-]+)/);
    return chatMatch?.[1] || exerciseMatch?.[1] || null;
  })();

  // Архивация
  async function handleArchive(chatId: string) {
    await fetch(`/api/chats/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (chatId === activeChatId) {
      router.push(`${base}/hub`);
    }
  }

  return (
    <nav className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">НС</div>
          <div className="sidebar-logo-text">НеСлавный</div>
        </div>
        <button
          className="sidebar-collapse-btn"
          onClick={toggleCollapsed}
          title={collapsed ? "Развернуть" : "Свернуть"}
        >
          {collapsed ? "\u00BB" : "\u00AB"}
        </button>
      </div>

      <div className="sidebar-section-label">Программы</div>
      <div className="sidebar-nav">
        {programs.map((p) => {
          const isActive = p.slug === slug;
          return (
            <Link
              key={p.slug}
              href={`/program/${p.slug}/hub`}
              className={`sidebar-item${isActive ? " active" : ""}`}
            >
              <div className="sidebar-book-cover">
                {p.coverUrl ? (
                  <img src={p.coverUrl} alt="" />
                ) : (
                  <div className="sidebar-book-placeholder" />
                )}
              </div>
              <span className="sidebar-item-label">{p.title}</span>
            </Link>
          );
        })}
      </div>

      <div className="sidebar-section-label">Все чаты</div>
      <div className="sidebar-chat-list">
        {chats.length === 0 && (
          <div className="sidebar-chat-empty">Нет чатов</div>
        )}
        {chats.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            isActive={chat.id === activeChatId}
            slug={slug}
            onArchive={() => handleArchive(chat.id)}
          />
        ))}
      </div>

      <div className="sidebar-footer">
        <ProfileMenu user={user ?? null} slug={slug} collapsed={collapsed} />
      </div>
    </nav>
  );
}
