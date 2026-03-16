import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.YANDEX_CLIENT_ID!;
  const redirectUri = `${request.nextUrl.origin}/api/auth/yandex/callback`;

  const isPopup = request.nextUrl.searchParams.get("popup") === "true";
  const redirect = request.nextUrl.searchParams.get("redirect");

  const url = new URL("https://oauth.yandex.ru/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);

  // Encode popup flag and redirect URL in OAuth state
  const state: Record<string, string> = {};
  if (isPopup) state.popup = "true";
  if (redirect) state.redirect = redirect;
  if (Object.keys(state).length > 0) {
    url.searchParams.set("state", JSON.stringify(state));
  }

  return NextResponse.redirect(url.toString());
}
