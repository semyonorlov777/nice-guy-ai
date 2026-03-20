"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useModes } from "@/contexts/ModesContext";
import { getModeIcon } from "@/components/hub/mode-icons";

function HubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function PortraitIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function MobileTabs({
  slug,
}: {
  slug: string;
}) {
  const pathname = usePathname();
  const base = `/program/${slug}`;
  const { modes } = useModes();

  // Build tabs: Hub + up to 3 modes (skip coming_soon) + Portrait
  const modeTabs = modes
    .filter((m) => !m.config?.coming_soon)
    .slice(0, 3)
    .map((m) => ({
      key: m.key,
      path: m.route_suffix,
      label: m.key === "free_chat" ? "Чат"
        : m.key === "exercises" ? "Тренажёры"
        : m.key === "test_issp" ? "Тест"
        : m.key === "author_chat" ? "Автор"
        : m.name,
      icon: m.icon,
    }));

  const tabs = [
    { key: "hub", path: "/hub", label: "Hub", icon: "__hub__" },
    ...modeTabs,
    { key: "portrait", path: "/portrait", label: "Портрет", icon: "__portrait__" },
  ];

  function getActiveKey() {
    if (pathname.startsWith(`${base}/hub`)) return "hub";
    if (pathname.includes("/test/issp")) return "test_issp";
    if (pathname.startsWith(`${base}/exercise`)) return "exercises";
    if (pathname.startsWith(`${base}/portrait`)) return "portrait";
    if (pathname.startsWith(`${base}/author-chat`)) return "author_chat";
    if (pathname.startsWith(`${base}/chat`)) return "free_chat";
    return "hub";
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
          <div className="mobile-tab-icon">
            {tab.icon === "__hub__" ? <HubIcon />
              : tab.icon === "__portrait__" ? <PortraitIcon />
              : getModeIcon(tab.icon)}
          </div>
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
