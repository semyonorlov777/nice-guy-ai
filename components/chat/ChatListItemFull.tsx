import Link from "next/link";
import { ChatIcon, ExercisesIcon, AuthorIcon, TestIcon, FreechatIcon } from "@/components/icons/hub-icons";
import { getChatTypeColorClass } from "@/lib/chat-utils";
import { formatRelativeTime } from "@/lib/time";
import type { ChatItemData } from "@/components/ChatListItem";

interface ChatListItemFullProps {
  chat: ChatItemData;
  slug: string;
}

const CHAT_TYPE_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  exercise: ExercisesIcon,
  author: AuthorIcon,
  free: FreechatIcon,
  test: TestIcon,
};

export function ChatListItemFull({ chat, slug }: ChatListItemFullProps) {
  const href = chat.chatType === "exercise" && chat.exerciseNumber
    ? `/program/${slug}/exercise/${chat.exerciseNumber}/${chat.id}`
    : `/program/${slug}/chat/${chat.id}`;

  const Icon = CHAT_TYPE_ICONS[chat.chatType] || ChatIcon;
  const colorClass = getChatTypeColorClass(chat.chatType);

  return (
    <Link href={href} className="cl-item">
      <div className={`cl-icon i-${colorClass}`}>
        <Icon size={18} />
      </div>
      <div className="cl-body">
        <div className="cl-name">{chat.title}</div>
        <div className="cl-preview">{chat.preview || "Начни разговор..."}</div>
      </div>
      <div className="cl-meta">
        <span className="cl-time">{formatRelativeTime(chat.lastMessageAt)}</span>
      </div>
    </Link>
  );
}
