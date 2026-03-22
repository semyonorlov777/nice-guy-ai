"use client";

import { useRouter } from "next/navigation";
import { PlusIcon } from "@/components/icons/hub-icons";

interface MobileChatHeaderProps {
  title: string;
  slug: string;
  showNewChat?: boolean;
  showNewSession?: boolean;
  showBack?: boolean;
  backHref?: string;
}

export function MobileChatHeader({
  title,
  slug,
  showNewChat,
  showNewSession,
  showBack,
  backHref,
}: MobileChatHeaderProps) {
  const router = useRouter();

  return (
    <div className="mobile-chat-header">
      {showBack && (
        <button
          className="mobile-header-btn"
          onClick={() =>
            router.push(backHref || `/program/${slug}/exercises`)
          }
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      )}
      <span className="mobile-header-title">{title}</span>
      {showNewChat && (
        <button
          className="mobile-header-btn"
          onClick={() => router.push(`/program/${slug}/chat`)}
          title="Новый чат"
        >
          <PlusIcon size={18} />
        </button>
      )}
      {showNewSession && (
        <button
          className="mobile-header-btn"
          onClick={() => router.refresh()}
          title="Новая сессия"
        >
          <PlusIcon size={18} />
        </button>
      )}
    </div>
  );
}
