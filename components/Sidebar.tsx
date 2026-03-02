"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ProfileMenu } from "@/components/ProfileMenu";

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
  const base = `/program/${slug}`;

  function getActiveKey() {
    if (pathname.startsWith(`${base}/exercise`)) return "exercises";
    for (const item of navItems) {
      if (pathname.startsWith(`${base}${item.path}`)) return item.key;
    }
    return "chat";
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

      <ProfileMenu user={user ?? null} />
    </nav>
  );
}
