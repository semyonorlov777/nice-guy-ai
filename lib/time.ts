const SHORT_DAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const SHORT_MONTHS = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

/**
 * Compact time for sidebar chat list:
 * Today → "14:32", Yesterday → "Вчера", This week → "Пн", Older → "12 мар"
 */
export function formatChatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor(
    (today.getTime() - dateDay.getTime()) / 86400000
  );

  if (diffDays === 0) {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
  if (diffDays === 1) return "Вчера";
  if (diffDays < 7) return SHORT_DAYS[date.getDay()];
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин.`;
  if (diffHr < 24) return `${diffHr} ч.`;
  if (diffDay === 1) return "вчера";
  if (diffDay < 7) return `${diffDay} дн.`;
  if (diffDay < 14) return "неделю";
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} нед.`;
  if (diffDay < 60) return "месяц";
  return `${Math.floor(diffDay / 30)} мес.`;
}
