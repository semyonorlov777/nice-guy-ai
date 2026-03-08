import { createClient, createServiceClient } from "@/lib/supabase-server";
import OpenAI from "openai";

const STT_TOKENS_PER_MINUTE = 50;

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function POST(request: Request) {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Не авторизован" }, { status: 401 });
  }

  // 2. Check balance
  const { data: profile } = await supabase
    .from("profiles")
    .select("balance_tokens")
    .eq("id", user.id)
    .single();

  if (!profile || profile.balance_tokens < STT_TOKENS_PER_MINUTE) {
    return Response.json(
      { error: "Недостаточно токенов для голосового ввода" },
      { status: 403 }
    );
  }

  // 3. Parse multipart form data
  const formData = await request.formData();
  const audioFile = formData.get("audio") as File | null;
  const durationSec = Number(formData.get("duration")) || 1;

  if (!audioFile) {
    return Response.json({ error: "Аудио не найдено" }, { status: 400 });
  }
  if (audioFile.size > 25 * 1024 * 1024) {
    return Response.json(
      { error: "Файл слишком большой (макс. 25 MB)" },
      { status: 400 }
    );
  }

  // 4. Calculate cost BEFORE calling OpenAI
  const durationMin = Math.ceil(durationSec / 60);
  const tokensToSpend = durationMin * STT_TOKENS_PER_MINUTE;

  if (profile.balance_tokens < tokensToSpend) {
    return Response.json(
      { error: "Недостаточно токенов для этой записи" },
      { status: 403 }
    );
  }

  // 5. Transcribe
  try {
    const transcription = await getOpenAI().audio.transcriptions.create({
      file: audioFile,
      model: "gpt-4o-mini-transcribe",
      language: "ru",
    });

    // 6. Deduct tokens
    const serviceClient = createServiceClient();
    const newBalance = Math.max(0, profile.balance_tokens - tokensToSpend);
    await serviceClient
      .from("profiles")
      .update({ balance_tokens: newBalance })
      .eq("id", user.id);

    return Response.json({
      text: transcription.text,
      tokens_spent: tokensToSpend,
      balance_remaining: newBalance,
    });
  } catch (err) {
    console.error("[transcribe] Error:", err);
    return Response.json(
      { error: "Ошибка транскрипции" },
      { status: 500 }
    );
  }
}
