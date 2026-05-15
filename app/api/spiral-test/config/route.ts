import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    telegramBotId: process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID || null,
  });
}
