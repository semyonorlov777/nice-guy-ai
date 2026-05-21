import { createRemoteJWKSet, jwtVerify } from "jose";
import { findOrCreateOAuthUser } from "@/lib/oauth-common";

// Telegram OIDC (OpenID Connect) — https://core.telegram.org/widgets/login
// Legacy iframe widget closed by Telegram in early 2026 ("deprecated"
// response from oauth.telegram.org/auth). OIDC через oauth.telegram.org
// supports standard Authorization Code Flow with PKCE; SDK
// `oauth.telegram.org/js/telegram-login.js` returns an id_token (JWT).

const TELEGRAM_JWKS_URL = "https://oauth.telegram.org/.well-known/jwks.json";
const TELEGRAM_ISSUER = "https://oauth.telegram.org";

export type TelegramAuthErrorReason =
  | "missing_token"
  | "invalid_token";

export class TelegramAuthError extends Error {
  constructor(public reason: TelegramAuthErrorReason, message: string) {
    super(message);
    this.name = "TelegramAuthError";
  }
}

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
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, jwks, {
      issuer: TELEGRAM_ISSUER,
      audience: clientId,
    }));
  } catch (err) {
    throw new TelegramAuthError(
      "invalid_token",
      err instanceof Error ? err.message : "Telegram id_token verification failed",
    );
  }

  return {
    id: String(payload.sub),
    name:
      (payload.name as string) ||
      (payload.preferred_username as string) ||
      "",
    username: (payload.preferred_username as string) || null,
    picture: (payload.picture as string) || null,
    phone: (payload.phone_number as string) || null,
  };
}

export async function findOrCreateUser(tgUser: TelegramUser) {
  return findOrCreateOAuthUser({
    provider: "Telegram",
    emailPrefix: "tg",
    hmacInput: tgUser.id,
    secret: process.env.TELEGRAM_CLIENT_SECRET!,
    lookupField: "telegram_id",
    lookupValue: Number(tgUser.id),
    existingProfileUpdate: {
      telegram_username: tgUser.username || undefined,
      avatar_url: tgUser.picture || undefined,
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
