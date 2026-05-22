import { NextResponse } from "next/server";
import {
  type TgUpdate,
  downloadFile,
  getOwnerChatId,
  getWebhookSecret,
  sendMessage,
} from "@mini/voice/lib/telegram";
import { transcribeBuffer } from "@mini/voice/lib/transcribe";
import { addMessage, getOrCreateInbox } from "@mini/voice/lib/repo";

export async function POST(request: Request) {
  // 1. Проверка секрета webhook'а (Telegram передаёт его в header).
  const expected = getWebhookSecret();
  if (expected) {
    const got = request.headers.get("x-telegram-bot-api-secret-token");
    if (got !== expected) {
      // Не палим, что у нас вообще есть webhook — отдаём 200 на чужие.
      return NextResponse.json({ ok: true });
    }
  }

  // 2. Парсинг апдейта.
  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message) return NextResponse.json({ ok: true });

  // 3. Защита: only owner.
  const ownerId = getOwnerChatId();
  if (ownerId !== null) {
    const fromId = message.from?.id ?? message.chat.id;
    if (fromId !== ownerId) {
      // Чужой пользователь — молча игнорируем (single-user мини).
      return NextResponse.json({ ok: true });
    }
  }

  // 4. /start или другие команды — мягкий ответ.
  if (message.text === "/start") {
    try {
      await sendMessage(
        message.chat.id,
        "Привет. Запиши голосовое — пришлю текст расшифровки и сохраню в вебе.",
      );
    } catch (err) {
      console.error("[voice/webhook] sendMessage /start error:", err);
    }
    return NextResponse.json({ ok: true });
  }

  // 5. Только voice/audio обрабатываем.
  const file = message.voice ?? message.audio;
  if (!file) {
    try {
      await sendMessage(message.chat.id, "Шли голосовое сообщение — расшифрую.");
    } catch {}
    return NextResponse.json({ ok: true });
  }

  // 6. Скачать → транскрибировать → сохранить → ответить.
  try {
    const { buffer, mimeType } = await downloadFile(file.file_id);
    const filename = `voice-${file.file_id}.ogg`;
    const { text } = await transcribeBuffer(buffer, filename, mimeType);

    const inbox = await getOrCreateInbox();
    await addMessage({
      chat_id: inbox.id,
      source: "telegram",
      text,
      audio_duration_sec: file.duration ?? null,
    });

    if (text.trim()) {
      await sendMessage(message.chat.id, text, message.message_id);
    } else {
      await sendMessage(message.chat.id, "Не смог разобрать речь — попробуй ещё раз.", message.message_id);
    }
  } catch (err) {
    console.error("[voice/webhook] processing error:", err);
    try {
      await sendMessage(message.chat.id, "Ошибка обработки — попробуй ещё раз.", message.message_id);
    } catch {}
  }

  return NextResponse.json({ ok: true });
}
