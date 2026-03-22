import type { ChatItemData } from "@/components/ChatListItem";

/** Chat type → CSS color class for icons */
export function getChatTypeColorClass(chatType: string): "accent" | "green" {
  switch (chatType) {
    case "exercise":
    case "author":
      return "accent";
    case "free":
    case "test":
    default:
      return "green";
  }
}

interface DateGroup {
  label: string;
  chats: ChatItemData[];
}

/** Group chats by date: Сегодня / Вчера / На этой неделе / Ранее */
export function groupChatsByDate(chats: ChatItemData[]): DateGroup[] {
  if (chats.length === 0) return [];

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); // Monday

  const groups: Record<string, ChatItemData[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  };

  for (const chat of chats) {
    const date = new Date(chat.lastMessageAt);
    const chatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (chatDay >= today) {
      groups.today.push(chat);
    } else if (chatDay >= yesterday) {
      groups.yesterday.push(chat);
    } else if (chatDay >= weekStart) {
      groups.week.push(chat);
    } else {
      groups.older.push(chat);
    }
  }

  const result: DateGroup[] = [];
  if (groups.today.length > 0) result.push({ label: "Сегодня", chats: groups.today });
  if (groups.yesterday.length > 0) result.push({ label: "Вчера", chats: groups.yesterday });
  if (groups.week.length > 0) result.push({ label: "На этой неделе", chats: groups.week });
  if (groups.older.length > 0) result.push({ label: "Ранее", chats: groups.older });

  return result;
}
