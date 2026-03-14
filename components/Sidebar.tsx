"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ProfileMenu } from "@/components/ProfileMenu";
import { ChatListItem, type ChatItemData } from "@/components/ChatListItem";
import { useChatListRefresh } from "@/contexts/ChatListContext";

interface UserInfo {
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

interface SidebarProps {
  slug: string;
  programId: string;
  user?: UserInfo | null;
  features?: Record<string, boolean> | null;
  initialChats: ChatItemData[];
  exerciseCount: number;
}

export function Sidebar({
  slug,
  programId,
  user,
  features,
  initialChats,
  exerciseCount,
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

  // Активный раздел навигации
  function getActiveSection() {
    if (pathname.startsWith("/test/issp")) return "test";
    if (pathname.startsWith(`${base}/exercise`)) return "exercises";
    if (pathname.startsWith(`${base}/portrait`)) return "portrait";
    return null; // chat не подсвечиваем в навигации — он в списке чатов
  }
  const activeSection = getActiveSection();

  // Архивация
  async function handleArchive(chatId: string) {
    await fetch(`/api/chats/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (chatId === activeChatId) {
      router.push(`${base}/chat`);
    }
  }

  // Навигация "Тренажёры"
  const navItems = [
    {
      key: "test",
      path: "/test/issp",
      icon: "📝",
      label: "Пройти тест",
      absolutePath: true,
    },
    {
      key: "exercises",
      path: "/exercises",
      icon: "📋",
      label: "Упражнения",
      badge: exerciseCount > 0 ? exerciseCount : undefined,
    },
    ...(features?.portrait
      ? [{ key: "portrait", path: "/portrait", icon: "📊", label: "Мой портрет" }]
      : []),
  ];

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
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <button
        className="new-chat-btn"
        onClick={() => router.push(`${base}/chat`)}
        title="Новый чат"
      >
        <span className="new-chat-btn-icon">{"✏️"}</span>
        <span className="sidebar-item-label">Новый чат</span>
      </button>

      <div className="sidebar-section-label">Тренажёры</div>
      <div className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.key}
            href={item.absolutePath ? item.path : `${base}${item.path}`}
            className={`sidebar-item${activeSection === item.key ? " active" : ""}`}
          >
            <div className="sidebar-item-icon">{item.icon}</div>
            <span className="sidebar-item-label">{item.label}</span>
            {"badge" in item && item.badge && (
              <span className="sidebar-item-badge">{item.badge}</span>
            )}
          </Link>
        ))}
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
        <ProfileMenu user={user ?? null} collapsed={collapsed} />
      </div>
    </nav>
  );
}
