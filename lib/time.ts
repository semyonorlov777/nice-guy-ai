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
