"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ProfileMenu } from "@/components/ProfileMenu";
import { useChatListRefresh } from "@/contexts/ChatListContext";
import {
  HomeIcon,
  ChatIcon,
  UserIcon,
  PlusIcon,
  CollapseIcon,
  CollapseBackIcon,
} from "@/components/icons/hub-icons";
import type { ChatItemData } from "@/components/ChatListItem";

interface UserInfo {
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

interface SidebarProps {
  slug: string;
  programId: string;
  user?: UserInfo | null;
  features?: import("@/types/program").ProgramFeatures | null;
  initialChats: ChatItemData[];
  exerciseCount: number;
  balance?: number;
}

export function Sidebar({
  slug,
  programId,
  user,
  initialChats,
  balance,
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

  // Active chatId from URL
  const activeChatId = (() => {
    const chatMatch = pathname.match(/\/chat\/([a-f0-9-]+)/);
    const exerciseMatch = pathname.match(/\/exercise\/\d+\/([a-f0-9-]+)/);
    return chatMatch?.[1] || exerciseMatch?.[1] || null;
  })();

  // Active nav section
  function getActiveSection(): string | null {
    if (pathname.startsWith(`${base}/hub`)) return "hub";
    if (pathname.startsWith(`${base}/portrait`)) return "portrait";
    if (pathname.startsWith(`${base}/chats`)) return "chats";
    if (pathname.startsWith(`${base}/chat`) || pathname.startsWith(`${base}/exercise`) || pathname.startsWith(`${base}/author-chat`)) return "chats";
    return "hub";
  }
  const activeSection = getActiveSection();

  // Chat item href
  function getChatHref(chat: ChatItemData): string {
    if (chat.chatType === "exercise" && chat.exerciseNumber) {
      return `${base}/exercise/${chat.exerciseNumber}/${chat.id}`;
    }
    return `${base}/chat/${chat.id}`;
  }

  return (
    <nav className={`sidebar${collapsed ? " collapsed" : ""}`}>
      {/* Header */}
      <div className="sidebar-header">
        <button
          className="sidebar-toggle"
          onClick={toggleCollapsed}
          title={collapsed ? "Развернуть" : "Свернуть"}
        >
          {collapsed ? <CollapseIcon size={18} /> : <CollapseBackIcon size={18} />}
        </button>
        <div className="sidebar-brand">
          <div className="sidebar-logo" />
          <div className="sidebar-brand-wrap">
            <div className="sidebar-brand-text">НеСлавный</div>
            <div className="sidebar-brand-sub">AI-тренажёр</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="sidebar-nav">
        <div className="sidebar-section-label">Программа</div>

        <Link
          href={`${base}/hub`}
          className={`sidebar-item${activeSection === "hub" ? " active" : ""}`}
          data-tooltip="Главная"
        >
          <div className="sidebar-item-icon"><HomeIcon size={18} /></div>
          <div className="sidebar-item-text">Главная</div>
        </Link>

        <Link
          href={`${base}/chats`}
          className={`sidebar-item${activeSection === "chats" ? " active" : ""}`}
          data-tooltip="Чаты"
        >
          <div className="sidebar-item-icon"><ChatIcon size={18} /></div>
          <div className="sidebar-item-text">Чаты</div>
        </Link>

        <Link
          href={`${base}/portrait`}
          className={`sidebar-item${activeSection === "portrait" ? " active" : ""}`}
          data-tooltip="Мой профиль"
        >
          <div className="sidebar-item-icon"><UserIcon size={18} /></div>
          <div className="sidebar-item-text">Мой профиль</div>
        </Link>

        {/* New chat button → Hub */}
        <button
          className="sidebar-new-chat"
          onClick={() => router.push(`${base}/hub`)}
          data-tooltip="Новый чат"
        >
          <PlusIcon size={16} />
          <span className="sidebar-item-text">Новый чат</span>
        </button>

        {/* Recent chats */}
        <div className="sidebar-section-label" style={{ marginTop: 16 }}>Недавние чаты</div>
        <div className="sidebar-chat-list">
          {chats.length === 0 && (
            <div className="sidebar-chat-empty">Нет чатов</div>
          )}
          {chats.map((chat) => (
            <Link
              key={chat.id}
              href={getChatHref(chat)}
              className={`sidebar-item${chat.id === activeChatId ? " active" : ""}`}
              data-tooltip={chat.title}
            >
              <div className="sidebar-item-icon"><ChatIcon size={18} /></div>
              <div className="sidebar-item-text" style={{ opacity: 0.7 }}>{chat.title}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Profile footer */}
      <ProfileMenu user={user ?? null} slug={slug} collapsed={collapsed} balance={balance} />
    </nav>
  );
}
