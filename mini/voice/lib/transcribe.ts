import OpenAI from "openai";

// Серверная транскрипция через OpenAI gpt-4o-mini-transcribe.
// Используется fallback'ом для веб-записи (если Web Speech API недоступен)
// и для voice-сообщений из Telegram.
//
// Никакого token-биллинга — single-user мини. Расходы вижу по своему OpenAI dashboard.

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_DURATION_SEC = 25 * 60;

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey });
}

export interface TranscribeResult {
  text: string;
}

export async function transcribeFile(file: File): Promise<TranscribeResult> {
  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error("Файл слишком большой (макс. 25 MB)");
  }
  const transcription = await getOpenAI().audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe",
    language: "ru",
  });
  return { text: transcription.text };
}

export async function transcribeBuffer(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
): Promise<TranscribeResult> {
  if (buffer.byteLength > MAX_AUDIO_BYTES) {
    throw new Error("Файл слишком большой (макс. 25 MB)");
  }
  const blob = new Blob([buffer], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });
  return transcribeFile(file);
}

export const VOICE_LIMITS = {
  MAX_AUDIO_BYTES,
  MAX_DURATION_SEC,
};
