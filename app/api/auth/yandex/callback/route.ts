import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { exchangeCodeAndGetUser, findOrCreateYandexUser } from "@/lib/yandex-auth";

const DEFAULT_REDIRECT = "/program/nice-guy/chat";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

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
    redirectUrl.pathname = DEFAULT_REDIRECT;
    redirectUrl.search = "";

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
