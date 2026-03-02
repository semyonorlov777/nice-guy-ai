import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  generateState,
  generateCodeVerifier,
  generateCodeChallenge,
} from "@/lib/telegram-auth";

export async function GET() {
  const clientId = process.env.TELEGRAM_CLIENT_ID!;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const redirectUri = `${appUrl}/auth/telegram/callback`;

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const isSecure = appUrl.startsWith("https");
  const cookieStore = await cookies();

  cookieStore.set("telegram_oauth_state", state, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  cookieStore.set("telegram_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile phone",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return NextResponse.redirect(
    `https://oauth.telegram.org/auth?${params.toString()}`,
  );
}
