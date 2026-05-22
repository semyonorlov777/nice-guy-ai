import { NextResponse } from "next/server";
import { transcribeFile, VOICE_LIMITS } from "@mini/voice/lib/transcribe";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    if (!audioFile) {
      return NextResponse.json({ error: "Аудио не найдено" }, { status: 400 });
    }
    if (!audioFile.type.startsWith("audio/")) {
      return NextResponse.json({ error: "Файл должен быть аудио" }, { status: 400 });
    }
    if (audioFile.size > VOICE_LIMITS.MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Файл слишком большой (макс. 25 MB)" }, { status: 400 });
    }
    const { text } = await transcribeFile(audioFile);
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[voice/transcribe] error:", err);
    const message = err instanceof Error ? err.message : "Ошибка транскрипции";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
