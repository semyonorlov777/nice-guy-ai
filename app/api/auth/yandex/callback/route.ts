import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createServerClient } from "@supabase/ssr";
import { exchangeCodeAndGetUser, findOrCreateYandexUser, type YandexUser } from "@/lib/yandex-auth";
import { DEFAULT_REDIRECT, isAllowedRedirect } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  // Parse state: supports both legacy "popup" string and new JSON format
  let isPopup = false;
  let stateRedirect: string | null = null;
  const rawState = request.nextUrl.searchParams.get("state");
  if (rawState) {
    if (rawState === "popup") {
      isPopup = true;
    } else {
      try {
        const parsed = JSON.parse(rawState) as { popup?: string; redirect?: string };
        isPopup = parsed.popup === "true";
        stateRedirect = parsed.redirect || null;
      } catch {
        // malformed state — ignore
      }
    }
  }

  if (!code) {
    console.error("[auth/yandex/callback] missing code", { isPopup, stateRedirect });
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.search = "?error=yandex_missing_code";
    return NextResponse.redirect(url);
  }

  let yaUser: YandexUser | null = null;

  try {
    // Exchange code for token + fetch Yandex profile
    yaUser = await exchangeCodeAndGetUser(code);

    // Find or create Supabase user, get session
    const session = await findOrCreateYandexUser(yaUser);

    if (!session) {
      console.error("[auth/yandex/callback] session_failed", {
        email: yaUser.email,
        yandexId: yaUser.id,
      });
      Sentry.captureMessage("Yandex session_failed", {
        level: "error",
        tags: { provider: "yandex", step: "session" },
        extra: { email: yaUser.email, yandexId: yaUser.id },
      });
      const url = request.nextUrl.clone();
      url.pathname = "/auth";
      url.search = "?error=yandex_session_failed";
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
    console.error("[auth/yandex/callback] auth_failed", {
      email: yaUser?.email ?? null,
      yandexId: yaUser?.id ?? null,
      error: err instanceof Error ? err.message : String(err),
    });
    Sentry.captureException(err, {
      tags: { provider: "yandex", step: "auth" },
      extra: {
        email: yaUser?.email ?? null,
        yandexId: yaUser?.id ?? null,
        stateRedirect,
      },
    });
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.search = "?error=yandex_auth_failed";
    return NextResponse.redirect(url);
  }
}
