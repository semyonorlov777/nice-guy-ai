import { generateText } from "ai";
import { transcribeModel } from "@mini/voice/lib/ai";

// Серверная транскрипция через Google Gemini Flash.
// Используется fallback'ом для веб-записи (Safari etc., где нет Web Speech API)
// и для voice-сообщений из Telegram.
//
// Используется ENV GOOGLE_GEMINI_API_KEY (общий с основным проектом).
// Платная только в тарифе Pay-as-you-go; на free tier хватает.

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_DURATION_SEC = 25 * 60;

const SYSTEM_PROMPT =
  "Ты — точный транскриптор. Получаешь аудио на русском языке. Верни ТОЛЬКО дословный текст того, что было сказано, на русском, без комментариев, без описания тона, без 'вот текст:' и подобного. Если аудио пустое или неразборчивое — верни пустую строку. Сохраняй абзацы и пунктуацию по смыслу, исправляй явные оговорки, но не пересказывай.";

export interface TranscribeResult {
  text: string;
}

async function transcribeAudio(buffer: ArrayBuffer, mimeType: string): Promise<TranscribeResult> {
  if (buffer.byteLength > MAX_AUDIO_BYTES) {
    throw new Error("Файл слишком большой (макс. 25 MB)");
  }
  const result = await generateText({
    model: transcribeModel(),
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Расшифруй это аудио." },
          { type: "file", data: new Uint8Array(buffer), mediaType: mimeType },
        ],
      },
    ],
  });
  return { text: result.text.trim() };
}

export async function transcribeFile(file: File): Promise<TranscribeResult> {
  const buffer = await file.arrayBuffer();
  return transcribeAudio(buffer, file.type || "audio/webm");
}

export async function transcribeBuffer(
  buffer: ArrayBuffer,
  _filename: string,
  mimeType: string,
): Promise<TranscribeResult> {
  return transcribeAudio(buffer, mimeType);
}

export const VOICE_LIMITS = {
  MAX_AUDIO_BYTES,
  MAX_DURATION_SEC,
};
