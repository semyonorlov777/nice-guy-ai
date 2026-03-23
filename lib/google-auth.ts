import { findOrCreateOAuthUser } from "@/lib/oauth-common";

export interface GoogleUser {
  id: string;
  name: string;
  picture: string | null;
  email: string | null;
}

// ---------- Exchange code for token + fetch profile ----------

export async function exchangeCodeAndGetUser(code: string, redirectUri: string): Promise<GoogleUser> {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }

  const { access_token } = await tokenRes.json();

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!profileRes.ok) {
    throw new Error("Failed to fetch Google profile");
  }

  const profile = await profileRes.json();

  return {
    id: String(profile.id),
    name: profile.name || "",
    picture: profile.picture || null,
    email: profile.email || null,
  };
}

// ---------- Find or create Supabase user ----------

export async function findOrCreateGoogleUser(googleUser: GoogleUser) {
  return findOrCreateOAuthUser({
    provider: "Google",
    emailPrefix: "google",
    hmacInput: `google_${googleUser.id}`,
    secret: process.env.GOOGLE_CLIENT_SECRET!,
    lookupField: "google_id",
    lookupValue: googleUser.id,
    existingProfileUpdate: {
      avatar_url: googleUser.picture,
      name: googleUser.name || undefined,
    },
    newProfileData: {
      email: null,
      google_id: googleUser.id,
      avatar_url: googleUser.picture,
      name: googleUser.name || "",
      auth_provider: "google",
    },
  });
}
