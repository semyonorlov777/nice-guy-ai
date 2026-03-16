import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { exchangeCodeAndGetUser, findOrCreateYandexUser } from "@/lib/yandex-auth";
import { DEFAULT_REDIRECT } from "@/lib/constants";

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
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.search = "?error=yandex_missing_code";
    return NextResponse.redirect(url);
  }

  try {
    // Exchange code for token + fetch Yandex profile
    const yaUser = await exchangeCodeAndGetUser(code);

    // Find or create Supabase user, get session
    const session = await findOrCreateYandexUser(yaUser);

    if (!session) {
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
      redirectUrl.search = "?popup=true";
    } else if (stateRedirect && (stateRedirect.startsWith("/program/") || stateRedirect.startsWith("/balance"))) {
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
    console.error("Yandex auth error:", err);
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.search = "?error=yandex_auth_failed";
    return NextResponse.redirect(url);
  }
}
