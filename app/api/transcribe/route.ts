import { createClient, createServiceClient } from "@/lib/supabase-server";
import { requireAuth, apiError } from "@/lib/api-helpers";
import OpenAI from "openai";

const STT_TOKENS_PER_MINUTE = 50;

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function POST(request: Request) {
  // 1. Auth
  const supabase = await createClient();
  const { user, response } = await requireAuth(supabase);
  if (response) return response;

  // 2. Check balance
  const { data: profile } = await supabase
    .from("profiles")
    .select("balance_tokens")
    .eq("id", user.id)
    .single();

  if (!profile || profile.balance_tokens < STT_TOKENS_PER_MINUTE) {
    return apiError("Недостаточно токенов для голосового ввода", 403);
  }

  // 3. Parse multipart form data
  const formData = await request.formData();
  const audioFile = formData.get("audio") as File | null;
  const durationSec = Number(formData.get("duration")) || 1;

  if (!audioFile) {
    return apiError("Аудио не найдено", 400);
  }
  if (audioFile.size > 25 * 1024 * 1024) {
    return apiError("Файл слишком большой (макс. 25 MB)", 400);
  }

  // 4. Calculate cost BEFORE calling OpenAI
  const durationMin = Math.ceil(durationSec / 60);
  const tokensToSpend = durationMin * STT_TOKENS_PER_MINUTE;

  if (profile.balance_tokens < tokensToSpend) {
    return apiError("Недостаточно токенов для этой записи", 403);
  }

  // 5. Transcribe
  try {
    const transcription = await getOpenAI().audio.transcriptions.create({
      file: audioFile,
      model: "gpt-4o-mini-transcribe",
      language: "ru",
    });

    // 6. Deduct tokens atomically via RPC (prevents race conditions)
    const serviceClient = createServiceClient();
    const { error: deductError } = await serviceClient.rpc("deduct_tokens", {
      p_user_id: user.id,
      p_amount: tokensToSpend,
    });

    if (deductError) {
      console.error("[transcribe] deduct_tokens failed:", deductError);
      return apiError("Ошибка списания токенов", 500);
    }

    // Read updated balance for response
    const { data: updatedProfile } = await supabase
      .from("profiles")
      .select("balance_tokens")
      .eq("id", user.id)
      .single();

    return Response.json({
      text: transcription.text,
      tokens_spent: tokensToSpend,
      balance_remaining: updatedProfile?.balance_tokens ?? 0,
    });
  } catch (err) {
    console.error("[transcribe] Error:", err);
    return apiError("Ошибка транскрипции", 500);
  }
}
