import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.YANDEX_CLIENT_ID!;
  const redirectUri = `${request.nextUrl.origin}/api/auth/yandex/callback`;

  const isPopup = request.nextUrl.searchParams.get("popup") === "true";

  const url = new URL("https://oauth.yandex.ru/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  if (isPopup) {
    url.searchParams.set("state", "popup");
  }

  return NextResponse.redirect(url.toString());
}
