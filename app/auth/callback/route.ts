import { NextRequest, NextResponse } from "next/server";

// Magic Link landing: do NOT exchange the code here.
// Email scanners (Gmail web preview, Outlook Safe Links, antivirus, etc.) issue
// a GET to every link in incoming mail and would burn the one-time code before
// the human ever clicks. We just hand off to /auth/confirm, which requires a
// real click to POST the exchange.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect");

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth?error=no_code", request.url),
    );
  }

  const confirmUrl = new URL("/auth/confirm", request.url);
  confirmUrl.searchParams.set("code", code);
  if (redirect) confirmUrl.searchParams.set("redirect", redirect);

  return NextResponse.redirect(confirmUrl);
}
