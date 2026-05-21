import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import {
  confirmLoginCode,
  downloadAndUploadAvatar,
  normalizeName,
  sendBotMessage,
  type TelegramFromUser,
} from "@/lib/telegram-login";

// Telegram стучит сюда при каждом update от бота. Проверяем secret_token
// (его шлёт Telegram в header — это secret из setWebhook), фильтруем
// сообщения с /start CODE, подтверждаем login_code, отвечаем юзеру в чат.

interface TelegramUpdate {
  message?: {
    text?: string;
    chat: { id: number };
    from?: TelegramFromUser;
  };
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");

  if (!webhookSecret || headerSecret !== webhookSecret) {
    console.error("[telegram/webhook] invalid secret");
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const message = update.message;
  if (!message || !message.text || !message.from) {
    // Любые другие апдейты (не текстовые сообщения) — игнорируем тихо.
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text.trim();
  const from = message.from;

  // Поддерживаем "/start CODE" и просто "/start" (без кода — приветствие).
  const startMatch = text.match(/^\/start(?:\s+(\S+))?$/);
  if (!startMatch) {
    return NextResponse.json({ ok: true });
  }

  const code = startMatch[1];
  if (!code) {
    await sendBotMessage(
      chatId,
      "Привет! Чтобы войти на <b>Книжный Спарринг</b>, открой ссылку входа на сайте — она перенесёт сюда с кодом.",
    );
    return NextResponse.json({ ok: true });
  }

  try {
    // Скачиваем аватар (может вернуться null — нет фото / приватность / ошибка),
    // потом одним UPDATE пишем код+telegram_id+name+avatar_url, чтобы polling
    // не увидел status=confirmed без avatar.
    const avatarUrl = await downloadAndUploadAvatar(from.id);
    const confirmed = await confirmLoginCode(code, from, avatarUrl);

    if (!confirmed) {
      await sendBotMessage(
        chatId,
        "Эта ссылка входа уже использована или истекла. Открой страницу <b>Войти</b> на сайте заново.",
      );
      return NextResponse.json({ ok: true });
    }

    // Только first_name в приветствии — короче и теплее, чем "Семён Орлов".
    // Нормализуем регистр: "СЕМЁН" → "Семён".
    const firstName = normalizeName((from.first_name || "").trim());
    const greeting = firstName ? `Готово, ${firstName} 👋` : "Готово 👋";
    const avatarLine = avatarUrl
      ? "Твоё фото из Telegram уже подтянулось в профиль."
      : "Если поставишь фото в Telegram — оно подтянется в твой профиль на сайте.";
    await sendBotMessage(
      chatId,
      `${greeting}\n\nВозвращайся на вкладку с сайтом — я уже тебя пропустил.\n\n${avatarLine}`,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telegram/webhook] error", err);
    Sentry.captureException(err, {
      tags: { provider: "telegram", step: "webhook" },
      extra: { code, telegramId: from.id },
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
