"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const navItems = [
  { key: "chat", path: "/chat", icon: "\u{1F4AC}", label: "Свободный чат" },
  { key: "exercises", path: "/exercises", icon: "\u{1F4CB}", label: "Упражнения" },
  { key: "portrait", path: "/portrait", icon: "\u{1F4CA}", label: "Мой портрет" },
  { key: "balance", path: "/balance", icon: "\u26A1", label: "Баланс" },
];

interface UserInfo {
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

export function Sidebar({ slug, user }: { slug: string; user?: UserInfo | null }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const base = `/program/${slug}`;

  useEffect(() => {
    setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function getActiveKey() {
    if (pathname.startsWith(`${base}/exercise`)) return "exercises";
    for (const item of navItems) {
      if (pathname.startsWith(`${base}${item.path}`)) return item.key;
    }
    return "chat";
  }

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
    }
  }

  const activeKey = getActiveKey();

  return (
    <nav className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">НС</div>
          <div className="sidebar-logo-text">НеСлавный</div>
        </div>
        <button
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Развернуть" : "Свернуть"}
          style={{ transform: collapsed ? "rotate(180deg)" : undefined }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M10 3L5 8L10 13" />
          </svg>
        </button>
      </div>

      <div className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.key}
            href={`${base}${item.path}`}
            className={`sidebar-item${activeKey === item.key ? " active" : ""}`}
          >
            <div className="sidebar-item-icon">{item.icon}</div>
            <span className="sidebar-item-label">{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="sidebar-bottom">
        {user && (
          <div className="sidebar-bottom-item" style={{ cursor: "default", gap: 10 }}>
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, objectFit: "cover" }}
              />
            ) : (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent-soft)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "var(--accent)", flexShrink: 0 }}>
                {(user.name || "?")[0].toUpperCase()}
              </div>
            )}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: "var(--text-secondary)" }}>
              {user.username ? `@${user.username}` : user.name || "Пользователь"}
            </span>
          </div>
        )}
        <button className="sidebar-bottom-item" onClick={toggleTheme}>
          <span>{isDark ? "\u{1F319}" : "\u2600\uFE0F"}</span>
          <span>Тема</span>
        </button>
      </div>
    </nav>
  );
}
