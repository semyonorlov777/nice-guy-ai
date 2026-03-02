import { createServiceClient } from "@/lib/supabase-server";
import crypto from "crypto";

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

  // Exchange authorization code for access_token
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

  // Fetch user profile
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

// ---------- Deterministic password from Yandex ID ----------

function generatePassword(yandexId: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`yandex_${yandexId}`)
    .digest("base64url");
}

// ---------- Find or create Supabase user ----------

export async function findOrCreateYandexUser(yaUser: YandexUser) {
  const supabase = createServiceClient();
  const clientSecret = process.env.YANDEX_CLIENT_SECRET!;

  const fakeEmail = `ya_${yaUser.id}@niceguy.local`;
  const password = generatePassword(yaUser.id, clientSecret);

  // Check if profile with this yandex_id exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("yandex_id", yaUser.id)
    .maybeSingle();

  if (existingProfile) {
    // --- Existing user: login ---
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email: fakeEmail, password });

    if (signInError) throw new Error(`Yandex login failed: ${signInError.message}`);

    // Update profile with latest Yandex data
    await supabase
      .from("profiles")
      .update({
        avatar_url: yaUser.avatarUrl,
        name: yaUser.displayName || undefined,
      })
      .eq("id", existingProfile.id);

    return signInData.session;
  }

  // --- New user: create ---
  const { data: createData, error: createError } =
    await supabase.auth.admin.createUser({
      email: fakeEmail,
      password,
      email_confirm: true,
    });

  if (createError) throw new Error(`User creation failed: ${createError.message}`);

  // Update the profile created by handle_new_user trigger
  await supabase
    .from("profiles")
    .update({
      email: null,
      yandex_id: yaUser.id,
      avatar_url: yaUser.avatarUrl,
      name: yaUser.displayName || "",
      auth_provider: "yandex",
    })
    .eq("id", createData.user.id);

  // Login the new user to get a session
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({ email: fakeEmail, password });

  if (signInError) throw new Error(`Login after creation failed: ${signInError.message}`);

  return signInData.session;
}
