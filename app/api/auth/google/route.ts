import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`;

  const isPopup = request.nextUrl.searchParams.get("popup") === "true";
  const redirect = request.nextUrl.searchParams.get("redirect");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");

  // Encode popup flag and redirect URL in OAuth state
  const state: Record<string, string> = {};
  if (isPopup) state.popup = "true";
  if (redirect && (redirect.startsWith("/program/") || redirect.startsWith("/balance"))) {
    state.redirect = redirect;
  }
  if (Object.keys(state).length > 0) {
    url.searchParams.set("state", JSON.stringify(state));
  }

  return NextResponse.redirect(url.toString());
}
