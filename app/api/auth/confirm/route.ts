import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase-server";
import { DEFAULT_REDIRECT, isAllowedRedirect } from "@/lib/constants";

export async function POST(request: NextRequest) {
  let code: string | null = null;
  let redirect: string | null = null;

  try {
    const body = await request.json().catch(() => ({}));
    code = typeof body.code === "string" ? body.code : null;
    redirect = typeof body.redirect === "string" ? body.redirect : null;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "no_code" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/confirm] exchangeCodeForSession failed", {
      message: error.message,
      status: error.status,
      redirect,
    });
    Sentry.captureException(error, {
      tags: { provider: "email", step: "exchange_code" },
      extra: { redirect },
    });
    return NextResponse.json(
      { error: "exchange_failed", message: error.message },
      { status: 400 },
    );
  }

  let target: string;
  if (isAllowedRedirect(redirect) && /^\/program\/[^/]+\/test\//.test(redirect)) {
    // Magic Link opened in a new tab during the test: tell user to return to
    // the original tab — it'll detect the new session via onAuthStateChange.
    target = "/auth/link-success";
  } else if (isAllowedRedirect(redirect)) {
    target = redirect;
  } else {
    target = DEFAULT_REDIRECT;
  }

  return NextResponse.json({
    ok: true,
    redirect: target,
    email: data.user?.email ?? null,
  });
}
