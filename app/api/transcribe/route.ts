import { createClient, createServiceClient } from "@/lib/supabase-server";
import { requireAuth, apiError } from "@/lib/api-helpers";
import { createRateLimit } from "@/lib/rate-limit";
import OpenAI from "openai";

const STT_TOKENS_PER_MINUTE = 50;

// Per-user rate limit: 10 транскрипций в минуту.
// Защита от abuse-вектора: загрузка валидных аудио чужими токенами через
// компрометированную сессию.
const checkRateLimit = createRateLimit({ windowMs: 60_000, max: 10 });

// Минимальный битрейт типичного клиентского записанного audio/webm;opus ≈ 16 kbps.
// Делим на 8 чтобы получить байты/сек = 2048. Делим размер файла на это — нижняя
// граница длительности. Защищает от cost-spoofing: клиент шлёт duration=1 для
// 25MB файла → реально 100+ секунд → биллим как минимум по размеру.
const MIN_AUDIO_BYTES_PER_SEC = 2048;

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function POST(request: Request) {
  // 1. Auth
  const supabase = await createClient();
  const { user, response } = await requireAuth(supabase);
  if (response) return response;

  // 2. Rate limit (per user)
  if (!checkRateLimit(user.id)) {
    return apiError("Слишком много запросов. Подожди минуту.", 429);
  }

  // 3. Check balance
  const { data: profile } = await supabase
    .from("profiles")
    .select("balance_tokens")
    .eq("id", user.id)
    .single();

  if (!profile || profile.balance_tokens < STT_TOKENS_PER_MINUTE) {
    return apiError("Недостаточно токенов для голосового ввода", 403);
  }

  // 4. Parse multipart form data
  const formData = await request.formData();
  const audioFile = formData.get("audio") as File | null;
  const clientDurationSec = Number(formData.get("duration")) || 1;

  if (!audioFile) {
    return apiError("Аудио не найдено", 400);
  }
  if (!audioFile.type.startsWith("audio/")) {
    return apiError("Файл должен быть аудио", 400);
  }
  if (audioFile.size > 25 * 1024 * 1024) {
    return apiError("Файл слишком большой (макс. 25 MB)", 400);
  }

  // 5. Calculate cost BEFORE calling OpenAI.
  // Берём максимум из присланной клиентом длительности и нижней границы по
  // размеру файла — клиент не может занизить (cost-spoofing fix).
  const sizeBasedMinSec = Math.ceil(audioFile.size / MIN_AUDIO_BYTES_PER_SEC);
  const durationSec = Math.max(clientDurationSec, sizeBasedMinSec);
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
