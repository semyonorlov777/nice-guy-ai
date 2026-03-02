import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { verifyTelegramToken, findOrCreateUser } from "@/lib/telegram-auth";

const DEFAULT_REDIRECT = "/program/nice-guy/chat";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const cookieStore = await cookies();
  const savedState = cookieStore.get("telegram_oauth_state")?.value;
  const codeVerifier = cookieStore.get("telegram_code_verifier")?.value;

  // Clean up OIDC cookies
  cookieStore.delete("telegram_oauth_state");
  cookieStore.delete("telegram_code_verifier");

  // Validate state (CSRF protection)
  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(
      new URL("/auth?error=invalid_state", appUrl),
    );
  }

  if (!codeVerifier) {
    return NextResponse.redirect(
      new URL("/auth?error=missing_verifier", appUrl),
    );
  }

  try {
    // Exchange code for tokens
    const clientId = process.env.TELEGRAM_CLIENT_ID!;
    const clientSecret = process.env.TELEGRAM_CLIENT_SECRET!;
    const redirectUri = `${appUrl}/auth/telegram/callback`;

    const tokenRes = await fetch("https://oauth.telegram.org/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("Telegram token exchange failed:", text);
      return NextResponse.redirect(
        new URL("/auth?error=token_exchange_failed", appUrl),
      );
    }

    const tokenData = await tokenRes.json();
    const idToken = tokenData.id_token;

    if (!idToken) {
      return NextResponse.redirect(
        new URL("/auth?error=no_id_token", appUrl),
      );
    }

    // Verify JWT
    const tgUser = await verifyTelegramToken(idToken, clientId);

    // Find or create Supabase user, get session
    const session = await findOrCreateUser(tgUser);

    if (!session) {
      return NextResponse.redirect(
        new URL("/auth?error=session_failed", appUrl),
      );
    }

    // Set Supabase session cookies
    const response = NextResponse.redirect(new URL(DEFAULT_REDIRECT, appUrl));

    // Create a temporary Supabase client to set the session cookies properly
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    return response;
  } catch (err) {
    console.error("Telegram auth error:", err);
    return NextResponse.redirect(
      new URL("/auth?error=telegram_auth_failed", appUrl),
    );
  }
}
