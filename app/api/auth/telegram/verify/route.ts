import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { verifyTelegramToken, findOrCreateUser } from "@/lib/telegram-auth";

export async function POST(request: NextRequest) {
  try {
    const { id_token } = await request.json();

    if (!id_token || typeof id_token !== "string") {
      return NextResponse.json(
        { error: "Missing id_token" },
        { status: 400 },
      );
    }

    const clientId = process.env.TELEGRAM_CLIENT_ID!;

    // Verify JWT signature, issuer, audience, expiration
    const tgUser = await verifyTelegramToken(id_token, clientId);

    // Find or create Supabase user, get session
    const session = await findOrCreateUser(tgUser);

    if (!session) {
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 },
      );
    }

    // Set Supabase session cookies on the response
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

    const response = NextResponse.json({ success: true });
    cookiesToSet.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]),
    );

    return response;
  } catch (err) {
    console.error("Telegram verify error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification failed" },
      { status: 500 },
    );
  }
}
