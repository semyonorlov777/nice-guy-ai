import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createServerClient } from "@supabase/ssr";
import {
  verifyTelegramToken,
  findOrCreateUser,
  TelegramAuthError,
  type TelegramAuthErrorReason,
  type TelegramUser,
} from "@/lib/telegram-auth";
import { apiError } from "@/lib/api-helpers";

const USER_MESSAGE_BY_REASON: Record<TelegramAuthErrorReason, string> = {
  missing_token: "Не удалось получить токен от Telegram",
  invalid_token:
    "Не удалось проверить ответ Telegram. Открой страницу заново и попробуй ещё раз.",
};

export async function POST(request: NextRequest) {
  let tgUser: TelegramUser | null = null;

  try {
    const { id_token } = (await request.json()) as { id_token?: string };

    if (!id_token || typeof id_token !== "string") {
      Sentry.captureMessage("Telegram missing id_token", {
        level: "warning",
        tags: { provider: "telegram", step: "verify", reason: "missing_token" },
      });
      return apiError(USER_MESSAGE_BY_REASON.missing_token, 400);
    }

    const clientId = process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID!;
    tgUser = await verifyTelegramToken(id_token, clientId);

    const session = await findOrCreateUser(tgUser);

    if (!session) {
      console.error("[auth/telegram/verify] session_failed", {
        telegramId: tgUser.id,
        hasUsername: Boolean(tgUser.username),
      });
      Sentry.captureMessage("Telegram session_failed", {
        level: "error",
        tags: { provider: "telegram", step: "session", reason: "session_failed" },
        extra: {
          telegramId: tgUser.id,
          hasUsername: Boolean(tgUser.username),
          hasName: Boolean(tgUser.name),
          hasPhoto: Boolean(tgUser.picture),
        },
      });
      return apiError("Не удалось создать сессию", 500);
    }

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
    if (err instanceof TelegramAuthError) {
      console.error("[auth/telegram/verify] auth_error", {
        reason: err.reason,
        message: err.message,
      });
      Sentry.captureException(err, {
        level: "error",
        tags: { provider: "telegram", step: "verify", reason: err.reason },
        extra: { telegramId: tgUser?.id ?? null },
      });
      const status = err.reason === "missing_token" ? 400 : 401;
      return apiError(USER_MESSAGE_BY_REASON[err.reason], status);
    }

    console.error("[auth/telegram/verify] error", {
      telegramId: tgUser?.id ?? null,
      hasUsername: Boolean(tgUser?.username),
      error: err instanceof Error ? err.message : String(err),
    });
    Sentry.captureException(err, {
      tags: { provider: "telegram", step: "verify", reason: "unknown" },
      extra: {
        telegramId: tgUser?.id ?? null,
        hasUsername: Boolean(tgUser?.username),
      },
    });
    return apiError("Ошибка верификации Telegram. Попробуй ещё раз.", 500);
  }
}
