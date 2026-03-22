export function isTelegramWebView(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    ua.includes('TelegramBot') ||
    ua.includes('Telegram') ||
    'TelegramWebviewProxy' in window
  );
}
