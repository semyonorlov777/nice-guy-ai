import Link from "next/link";
import { formatRelativeTime } from "@/lib/time";

interface ChatItem {
  id: string;
  title: string;
  chatType: string;
  exerciseNumber: number | null;
  preview: string;
  lastMessageAt: string;
}

interface MobileChatListProps {
  chats: ChatItem[];
  slug: string;
}

export function MobileChatList({ chats, slug }: MobileChatListProps) {
  return (
    <div className="prev-chats-section mobile-only">
      <div className="prev-chats-label">Предыдущие чаты</div>
      {chats.map((chat) => {
        const href =
          chat.chatType === "exercise" && chat.exerciseNumber
            ? `/program/${slug}/exercise/${chat.exerciseNumber}/${chat.id}`
            : `/program/${slug}/chat/${chat.id}`;

        return (
          <Link key={chat.id} href={href} className="prev-chat-item">
            <div className="prev-chat-icon">
              {chat.exerciseNumber ? "📋" : "💬"}
            </div>
            <div className="prev-chat-info">
              <div className="prev-chat-title">{chat.title}</div>
              <div className="prev-chat-meta">
                <span className="prev-chat-preview">{chat.preview}</span>
                <span className="prev-chat-time">
                  {formatRelativeTime(chat.lastMessageAt)}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
