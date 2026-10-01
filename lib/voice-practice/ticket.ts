import { createHash, randomBytes } from "node:crypto";

/** Одноразовый билет на подключение к голосовой сессии. В БД хранится только хеш. */
export function newTicket(): { ticket: string; hash: string; expiresAt: string } {
  const ticket = randomBytes(32).toString("base64url");
  return { ticket, hash: hashTicket(ticket), expiresAt: new Date(Date.now() + 60_000).toISOString() };
}

export function hashTicket(ticket: string): string {
  return createHash("sha256").update(ticket).digest("hex");
}
