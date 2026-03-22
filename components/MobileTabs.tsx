"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { HomeIcon, ChatIcon, PortraitIcon } from "@/components/icons/hub-icons";

export function MobileTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/program/${slug}`;

  const tabs = [
    { key: "hub", path: "/hub", icon: HomeIcon, label: "Главная" },
    { key: "chat", path: "/chat", icon: ChatIcon, label: "Чаты" },
    { key: "portrait", path: "/portrait", icon: PortraitIcon, label: "Профиль" },
  ];

  function getActiveKey(): string {
    if (pathname.startsWith(`${base}/hub`)) return "hub";
    if (pathname.startsWith(`${base}/chat`) || pathname.startsWith(`${base}/exercise`) || pathname.startsWith(`${base}/author-chat`)) return "chat";
    if (pathname.startsWith(`${base}/portrait`)) return "portrait";
    return "hub";
  }

  const activeKey = getActiveKey();

  return (
    <div className="mobile-tabs">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.key}
            href={`${base}${tab.path}`}
            className={`mobile-tab${activeKey === tab.key ? " active" : ""}`}
          >
            <div className="mobile-tab-icon">
              <Icon size={22} />
            </div>
            <span className="mobile-tab-label">{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
