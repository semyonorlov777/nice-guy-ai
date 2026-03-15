"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export function MobileTabs({
  slug,
  features,
}: {
  slug: string;
  features?: Record<string, boolean> | null;
}) {
  const pathname = usePathname();
  const base = `/program/${slug}`;

  const tabs = [
    { key: "chat", path: "/chat", icon: "\u{1F4AC}", label: "Чат" },
    { key: "author-chat", path: "/author-chat", icon: "\u270D\uFE0F", label: "Автор" },
    { key: "test", path: "/test/issp", icon: "\u{1F4DD}", label: "Тест" },
    { key: "exercises", path: "/exercises", icon: "\u{1F4CB}", label: "Тренажёры" },
    ...(features?.portrait
      ? [{ key: "portrait", path: "/portrait", icon: "\u{1F4CA}", label: "Портрет" }]
      : []),
    { key: "balance", path: "/balance", icon: "\u26A1", label: "Баланс" },
  ];

  function getActiveKey() {
    if (pathname.includes("/test/issp")) return "test";
    if (pathname.startsWith(`${base}/exercise`)) return "exercises";
    for (const tab of tabs) {
      if (pathname.startsWith(`${base}${tab.path}`)) return tab.key;
    }
    return "chat";
  }

  const activeKey = getActiveKey();

  return (
    <div className="mobile-tabs">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={`${base}${tab.path}`}
          className={`mobile-tab${activeKey === tab.key ? " active" : ""}`}
        >
          <div className="mobile-tab-icon">{tab.icon}</div>
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
