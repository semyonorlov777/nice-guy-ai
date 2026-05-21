import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createLoginCode } from "@/lib/telegram-login";
import { apiError } from "@/lib/api-helpers";
import { createRateLimit } from "@/lib/rate-limit";

const rateLimit = createRateLimit({ windowMs: 60_000, max: 20 });

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "anon";
  if (!rateLimit(ip)) {
    return apiError("Слишком много попыток входа. Подожди минуту.", 429);
  }

  try {
    const { code, botUrl } = await createLoginCode();
    return NextResponse.json({ code, botUrl });
  } catch (err) {
    console.error("[auth/telegram/start] error", err);
    Sentry.captureException(err, {
      tags: { provider: "telegram", step: "start" },
    });
    return apiError("Не удалось создать вход через Telegram. Попробуй ещё раз.", 500);
  }
}
