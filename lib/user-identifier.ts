export interface UserIdentifierInput {
  telegramUsername?: string | null;
  email?: string | null;
  telegramId?: number | string | null;
}

const FAKE_EMAIL_SUFFIX = "@niceguy.local";

function isRealEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return false;
  return !trimmed.endsWith(FAKE_EMAIL_SUFFIX);
}

export function resolveUserIdentifier({
  telegramUsername,
  email,
  telegramId,
}: UserIdentifierInput): string | null {
  const tgUsername = telegramUsername?.trim();
  if (tgUsername) return `@${tgUsername}`;

  if (isRealEmail(email)) return email!.trim();

  if (telegramId !== null && telegramId !== undefined && String(telegramId).length > 0) {
    return `Telegram ID: ${telegramId}`;
  }

  return null;
}
