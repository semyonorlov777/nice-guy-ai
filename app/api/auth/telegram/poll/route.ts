import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getLoginCode, markCodeUsed, createOrUpdateUserFromLogin } from "@/lib/telegram-login";
import { apiError } from "@/lib/api-helpers";

// Сайт опрашивает этот endpoint раз в 2 секунды после открытия Telegram.
// Когда юзер нажал /start у бота, webhook поставил status=confirmed —
// и этот endpoint возвращает access_token+refresh_token для setSession.

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return apiError("Отсутствует параметр code", 400);
  }

  try {
    const login = await getLoginCode(code);

    if (!login) {
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }

    if (login.status === "used") {
      // Защита от повторного использования — код можно обменять на сессию ровно один раз.
      return NextResponse.json({ status: "used" }, { status: 410 });
    }

    if (new Date(login.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ status: "expired" }, { status: 410 });
    }

    if (login.status === "pending") {
      return NextResponse.json({ status: "pending" });
    }

    if (login.status === "confirmed") {
      const session = await createOrUpdateUserFromLogin(login);

      if (!session) {
        console.error("[auth/telegram/poll] session_failed", { telegramId: login.telegram_id });
        Sentry.captureMessage("Telegram session_failed", {
          level: "error",
          tags: { provider: "telegram", step: "poll", reason: "session_failed" },
          extra: { telegramId: login.telegram_id },
        });
        return apiError("Не удалось создать сессию", 500);
      }

      // Помечаем код used ДО возврата токенов — гарантия одноразовости.
      await markCodeUsed(code);

      return NextResponse.json({
        status: "confirmed",
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }

    return NextResponse.json({ status: login.status });
  } catch (err) {
    console.error("[auth/telegram/poll] error", err);
    Sentry.captureException(err, {
      tags: { provider: "telegram", step: "poll" },
    });
    return apiError("Ошибка проверки входа", 500);
  }
}
