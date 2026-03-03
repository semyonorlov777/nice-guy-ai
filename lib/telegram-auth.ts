import { createRemoteJWKSet, jwtVerify } from "jose";
import { findOrCreateOAuthUser } from "@/lib/oauth-common";

const TELEGRAM_JWKS_URL = "https://oauth.telegram.org/.well-known/jwks.json";
const TELEGRAM_ISSUER = "https://oauth.telegram.org";

// ---------- JWT verification ----------

export interface TelegramUser {
  id: string;
  name: string;
  username: string | null;
  picture: string | null;
  phone: string | null;
}

const jwks = createRemoteJWKSet(new URL(TELEGRAM_JWKS_URL));

export async function verifyTelegramToken(
  idToken: string,
  clientId: string,
): Promise<TelegramUser> {
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: TELEGRAM_ISSUER,
    audience: clientId,
  });

  return {
    id: String(payload.sub),
    name: (payload.name as string) || (payload.preferred_username as string) || "",
    username: (payload.preferred_username as string) || null,
    picture: (payload.picture as string) || null,
    phone: (payload.phone_number as string) || null,
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
