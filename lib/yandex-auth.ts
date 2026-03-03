import { findOrCreateOAuthUser } from "@/lib/oauth-common";

export interface YandexUser {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
}

// ---------- Exchange code for token + fetch profile ----------

export async function exchangeCodeAndGetUser(code: string): Promise<YandexUser> {
  const clientId = process.env.YANDEX_CLIENT_ID!;
  const clientSecret = process.env.YANDEX_CLIENT_SECRET!;

  const tokenRes = await fetch("https://oauth.yandex.ru/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Yandex token exchange failed: ${err}`);
  }

  const { access_token } = await tokenRes.json();

  const profileRes = await fetch("https://login.yandex.ru/info?format=json", {
    headers: { Authorization: `OAuth ${access_token}` },
  });

  if (!profileRes.ok) {
    throw new Error("Failed to fetch Yandex profile");
  }

  const profile = await profileRes.json();

  return {
    id: String(profile.id),
    login: profile.login || "",
    displayName: profile.display_name || profile.real_name || profile.login || "",
    avatarUrl: profile.default_avatar_id
      ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
      : null,
    email: profile.default_email || null,
  };
}

// ---------- Find or create Supabase user ----------

export async function findOrCreateYandexUser(yaUser: YandexUser) {
  return findOrCreateOAuthUser({
    provider: "Yandex",
    emailPrefix: "ya",
    hmacInput: `yandex_${yaUser.id}`,
    secret: process.env.YANDEX_CLIENT_SECRET!,
    lookupField: "yandex_id",
    lookupValue: yaUser.id,
    existingProfileUpdate: {
      avatar_url: yaUser.avatarUrl,
      name: yaUser.displayName || undefined,
    },
    newProfileData: {
      email: null,
      yandex_id: yaUser.id,
      avatar_url: yaUser.avatarUrl,
      name: yaUser.displayName || "",
      auth_provider: "yandex",
    },
  });
}
