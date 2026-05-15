"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { HomeIcon, ChatIcon, UserIcon } from "@/components/icons/hub-icons";
import { BookSwitcher } from "@/components/BookSwitcher";
import type { ProgramSwitcherItem } from "@/lib/queries/all-programs";

interface MobileTabsProps {
  slug: string;
  programs: ProgramSwitcherItem[];
  currentProgram: ProgramSwitcherItem;
}

export function MobileTabs({ slug, programs }: MobileTabsProps) {
  const pathname = usePathname();
  const base = `/program/${slug}`;

  const tabs = [
    { key: "hub", path: "/hub", icon: HomeIcon, label: "Главная" },
    { key: "chats", path: "/chats", icon: ChatIcon, label: "Чаты" },
    { key: "profile", path: "/profile", icon: UserIcon, label: "Профиль" },
  ];

  function getActiveKey(): string {
    if (pathname.startsWith(`${base}/hub`)) return "hub";
    if (pathname.startsWith(`${base}/chats`)) return "chats";
    if (pathname.startsWith(`${base}/chat`) || pathname.startsWith(`${base}/exercise`) || pathname.startsWith(`${base}/author-chat`)) return "chats";
    if (pathname.startsWith(`${base}/profile`) || pathname.startsWith(`${base}/portrait`)) return "profile";
    return "hub";
  }

  const activeKey = getActiveKey();
  const showSwitcher = programs.length > 1;

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
      {showSwitcher && (
        <BookSwitcher
          variant="mobile"
          currentSlug={slug}
          programs={programs}
        />
      )}
    </div>
  );
}
