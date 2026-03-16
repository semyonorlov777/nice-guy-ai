import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { DEFAULT_REDIRECT } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect");

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth?error=no_code", request.url),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/auth?error=callback_failed", request.url),
    );
  }

  // Validate redirect target for safety
  const isValidRedirect =
    redirect &&
    (redirect.startsWith("/program/") || redirect.startsWith("/balance"));

  // If redirect points to a test page, send user to link-success instead
  // (the original tab will detect auth via onAuthStateChange)
  if (isValidRedirect && /^\/program\/[^/]+\/test\//.test(redirect)) {
    return NextResponse.redirect(new URL("/auth/link-success", request.url));
  }

  const target = isValidRedirect ? redirect : DEFAULT_REDIRECT;
  return NextResponse.redirect(new URL(target, request.url));
}
