import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_REDIRECT = "/program/nice-guy/chat";

function isProtected(pathname: string): boolean {
  // /program/<slug>/<subpage> (chat, exercise, exercises, portrait, balance)
  if (/^\/program\/[^/]+\/.+/.test(pathname)) return true;
  if (pathname.startsWith("/balance")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for OAuth endpoints (they manage their own auth)
  if (pathname.startsWith("/api/auth/telegram") || pathname.startsWith("/api/auth/yandex")) {
    return NextResponse.next();
  }

  // Always create Supabase client and refresh auth token
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged-in user on /auth → redirect to app
  if (pathname === "/auth" && user) {
    const url = request.nextUrl.clone();
    url.pathname = DEFAULT_REDIRECT;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Non-logged user on protected path → redirect to /auth with redirect param
  if (isProtected(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.search = `?redirect=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
