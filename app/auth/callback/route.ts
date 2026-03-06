import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";

const DEFAULT_REDIRECT = `/program/${DEFAULT_PROGRAM_SLUG}/chat`;

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
  const target =
    redirect &&
    (redirect.startsWith("/program/") || redirect.startsWith("/balance"))
      ? redirect
      : DEFAULT_REDIRECT;

  return NextResponse.redirect(new URL(target, request.url));
}
