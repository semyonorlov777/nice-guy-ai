import { createRemoteJWKSet, jwtVerify } from "jose";
import { createServiceClient } from "@/lib/supabase-server";
import crypto from "crypto";

const TELEGRAM_JWKS_URL = "https://oauth.telegram.org/.well-known/jwks.json";
const TELEGRAM_ISSUER = "https://oauth.telegram.org";

// ---------- PKCE helpers ----------

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = crypto.createHash("sha256").update(verifier).digest();
  return digest.toString("base64url");
}

export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

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

// ---------- Deterministic password from Telegram ID ----------

function generatePassword(telegramId: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(telegramId)
    .digest("base64url");
}

// ---------- Find or create Supabase user ----------

export async function findOrCreateUser(tgUser: TelegramUser) {
  const supabase = createServiceClient();
  const clientSecret = process.env.TELEGRAM_CLIENT_SECRET!;

  const fakeEmail = `tg_${tgUser.id}@niceguy.local`;
  const password = generatePassword(tgUser.id, clientSecret);

  // Check if profile with this telegram_id exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("telegram_id", Number(tgUser.id))
    .maybeSingle();

  if (existingProfile) {
    // --- Existing user: login ---
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email: fakeEmail, password });

    if (signInError) throw new Error(`Telegram login failed: ${signInError.message}`);

    // Update profile with latest Telegram data
    await supabase
      .from("profiles")
      .update({
        telegram_username: tgUser.username,
        avatar_url: tgUser.picture,
        name: tgUser.name || undefined,
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
      email: null, // profiles.email = NULL for Telegram users
      telegram_id: Number(tgUser.id),
      telegram_username: tgUser.username,
      avatar_url: tgUser.picture,
      name: tgUser.name || "",
    })
    .eq("id", createData.user.id);

  // Login the new user to get a session
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({ email: fakeEmail, password });

  if (signInError) throw new Error(`Login after creation failed: ${signInError.message}`);

  return signInData.session;
}
