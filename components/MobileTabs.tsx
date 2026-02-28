"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const tabs = [
  { key: "chat", path: "/chat", icon: "\u{1F4AC}", label: "Чат" },
  { key: "exercises", path: "/exercises", icon: "\u{1F4CB}", label: "Упражнения" },
  { key: "portrait", path: "/portrait", icon: "\u{1F4CA}", label: "Портрет" },
  { key: "balance", path: "/balance", icon: "\u26A1", label: "Баланс" },
];

export function MobileTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/program/${slug}`;

  function getActiveKey() {
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
