import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createServerClient } from "@supabase/ssr";
import { verifyTelegramToken, findOrCreateUser, type TelegramUser } from "@/lib/telegram-auth";
import { apiError } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  let tgUser: TelegramUser | null = null;

  try {
    const { id_token } = await request.json();

    if (!id_token || typeof id_token !== "string") {
      return apiError("Отсутствует id_token", 400);
    }

    const clientId = process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID!;

    // Verify JWT signature, issuer, audience, expiration
    tgUser = await verifyTelegramToken(id_token, clientId);

    // Find or create Supabase user, get session
    const session = await findOrCreateUser(tgUser);

    if (!session) {
      console.error("[auth/telegram/verify] session_failed", {
        telegramId: tgUser.id,
        username: tgUser.username,
      });
      Sentry.captureMessage("Telegram session_failed", {
        level: "error",
        tags: { provider: "telegram", step: "session" },
        extra: { telegramId: tgUser.id, username: tgUser.username },
      });
      return apiError("Не удалось создать сессию", 500);
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
    console.error("[auth/telegram/verify] error", {
      telegramId: tgUser?.id ?? null,
      username: tgUser?.username ?? null,
      error: err instanceof Error ? err.message : String(err),
    });
    Sentry.captureException(err, {
      tags: { provider: "telegram", step: "verify" },
      extra: {
        telegramId: tgUser?.id ?? null,
        username: tgUser?.username ?? null,
      },
    });
    return apiError(err instanceof Error ? err.message : "Ошибка верификации", 500);
  }
}
