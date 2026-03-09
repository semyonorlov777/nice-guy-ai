"use client";

import { useRouter } from "next/navigation";

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
          {"←"}
        </button>
      )}
      <span className="mobile-header-title">{title}</span>
      {showNewChat && (
        <button
          className="mobile-header-btn"
          onClick={() => router.push(`/program/${slug}/chat`)}
          title="Новый чат"
        >
          {"✏️"}
        </button>
      )}
      {showNewSession && (
        <button
          className="mobile-header-btn"
          onClick={() => router.refresh()}
          title="Новая сессия"
        >
          {"+"}
        </button>
      )}
    </div>
  );
}
