import crypto from "crypto";
import { findOrCreateOAuthUser } from "@/lib/oauth-common";

// ---------- Telegram Login Widget (legacy) HMAC verification ----------
// https://core.telegram.org/widgets/login#checking-authorization

export interface TelegramUser {
  id: string;
  name: string;
  username: string | null;
  picture: string | null;
  phone: string | null;
}

export interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;

export function verifyTelegramAuth(
  data: TelegramAuthData,
  botToken: string,
): TelegramUser {
  if (!data.hash || typeof data.hash !== "string") {
    throw new Error("Telegram hash is missing");
  }

  const { hash, ...rest } = data;

  const dataCheckString = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const provided = Buffer.from(hash, "hex");
  const expected = Buffer.from(calculatedHash, "hex");
  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    throw new Error("Telegram hash verification failed");
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - data.auth_date > AUTH_MAX_AGE_SECONDS) {
    throw new Error("Telegram auth_date is too old");
  }

  const fullName = [data.first_name, data.last_name]
    .filter((s): s is string => Boolean(s))
    .join(" ")
    .trim();

  return {
    id: String(data.id),
    name: fullName || data.username || "",
    username: data.username || null,
    picture: data.photo_url || null,
    phone: null,
  };
}

// ---------- Find or create Supabase user ----------

export async function findOrCreateUser(tgUser: TelegramUser) {
  return findOrCreateOAuthUser({
    provider: "Telegram",
    emailPrefix: "tg",
    hmacInput: tgUser.id,
    secret: process.env.TELEGRAM_CLIENT_SECRET!,
    lookupField: "telegram_id",
    lookupValue: Number(tgUser.id),
    existingProfileUpdate: {
      telegram_username: tgUser.username,
      avatar_url: tgUser.picture,
      name: tgUser.name || undefined,
    },
    newProfileData: {
      email: null,
      telegram_id: Number(tgUser.id),
      telegram_username: tgUser.username,
      avatar_url: tgUser.picture,
      name: tgUser.name || "",
    },
  });
}
