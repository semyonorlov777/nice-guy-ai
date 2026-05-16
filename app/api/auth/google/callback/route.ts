import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createServerClient } from "@supabase/ssr";
import { exchangeCodeAndGetUser, findOrCreateGoogleUser, type GoogleUser } from "@/lib/google-auth";
import { DEFAULT_REDIRECT, isAllowedRedirect } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  // Parse state
  let isPopup = false;
  let stateRedirect: string | null = null;
  const rawState = request.nextUrl.searchParams.get("state");
  if (rawState) {
    try {
      const parsed = JSON.parse(rawState) as { popup?: string; redirect?: string };
      isPopup = parsed.popup === "true";
      stateRedirect = parsed.redirect || null;
    } catch {
      // malformed state — ignore
    }
  }

  if (!code) {
    console.error("[auth/google/callback] missing code", { isPopup, stateRedirect });
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.search = "?error=google_missing_code";
    return NextResponse.redirect(url);
  }

  let googleUser: GoogleUser | null = null;

  try {
    const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`;

    // Exchange code for token + fetch Google profile
    googleUser = await exchangeCodeAndGetUser(code, redirectUri);

    // Find or create Supabase user, get session
    const session = await findOrCreateGoogleUser(googleUser);

    if (!session) {
      console.error("[auth/google/callback] session_failed", {
        email: googleUser.email,
        googleId: googleUser.id,
      });
      Sentry.captureMessage("Google session_failed", {
        level: "error",
        tags: { provider: "google", step: "session" },
        extra: { email: googleUser.email, googleId: googleUser.id },
      });
      const url = request.nextUrl.clone();
      url.pathname = "/auth";
      url.search = "?error=google_session_failed";
      return NextResponse.redirect(url);
    }

    // Set Supabase session cookies on the redirect response
    const cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookies) {
            cookiesToSet.push(...cookies);
          },
        },
      },
    );

    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    const redirectUrl = request.nextUrl.clone();
    if (isPopup) {
      redirectUrl.pathname = "/auth";
      const popupParams = new URLSearchParams({ popup: "true" });
      if (isAllowedRedirect(stateRedirect)) {
        popupParams.set("redirect", stateRedirect);
      }
      redirectUrl.search = `?${popupParams.toString()}`;
    } else if (isAllowedRedirect(stateRedirect)) {
      redirectUrl.pathname = stateRedirect;
      redirectUrl.search = "";
    } else {
      redirectUrl.pathname = DEFAULT_REDIRECT;
      redirectUrl.search = "";
    }

    const response = NextResponse.redirect(redirectUrl);
    cookiesToSet.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]),
    );

    return response;
  } catch (err) {
    console.error("[auth/google/callback] auth_failed", {
      email: googleUser?.email ?? null,
      googleId: googleUser?.id ?? null,
      error: err instanceof Error ? err.message : String(err),
    });
    Sentry.captureException(err, {
      tags: { provider: "google", step: "auth" },
      extra: {
        email: googleUser?.email ?? null,
        googleId: googleUser?.id ?? null,
        stateRedirect,
      },
    });
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.search = "?error=google_auth_failed";
    return NextResponse.redirect(url);
  }
}
