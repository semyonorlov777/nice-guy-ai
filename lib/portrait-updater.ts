/**
 * Core logic для обновления психологического портрета пользователя через
 * Gemini Pro. Вынесено из app/api/portrait/update/route.ts чтобы убрать
 * крестную зависимость API routes (chat/route.ts импортировал из portrait/route).
 *
 * Вызывается:
 * - Из app/api/portrait/update/route.ts (HTTP-handler с INTERNAL_API_SECRET)
 * - Из app/api/chat/route.ts onFinish (fire-and-forget каждые 5 user-сообщений)
 */

import { createServiceClient } from "@/lib/supabase-server";
import { analyzeForPortrait } from "@/lib/gemini-portrait";
import { PORTRAIT_ANALYST_PROMPT } from "@/lib/prompts/portrait-analyst";
import { createRateLimit } from "@/lib/rate-limit";
import {
  getFacts,
  IDENTITY_QUESTION_IDS,
  type IdentityFacts,
} from "@/lib/personalization";
import { IDENTITY_FACT_LABELS } from "@/lib/anketa/questions";

function formatAnketaForPortrait(facts: IdentityFacts): string {
  if (Object.keys(facts).length === 0) return "";
  const lines: string[] = [];
  for (const qid of IDENTITY_QUESTION_IDS) {
    const value = facts[qid]?.trim();
    if (!value) continue;
    lines.push(`- ${IDENTITY_FACT_LABELS[qid]}: ${value}`);
  }
  return `\nАНКЕТА ПОЛЬЗОВАТЕЛЯ (его собственный запрос, не путать с наблюдениями из чата):\n${lines.join("\n")}\n`;
}

// Per-user rate limit: 1 обновление портрета в минуту.
// updatePortrait вызывает Gemini Pro (дороже Flash), поэтому отдельный жёсткий
// limit поверх chat-level rate-limit (20/мин). При spam'е сообщений портрет
// обновится в следующий раз — это OK по UX.
const checkPortraitRateLimit = createRateLimit({ windowMs: 60_000, max: 1 });

export async function updatePortrait(
  chatId: string,
  trigger: string,
): Promise<{ success: boolean; error?: string }> {
  console.log("[PORTRAIT] updatePortrait called, chat:", chatId, "trigger:", trigger);

  const supabase = createServiceClient();

  // 1. Load chat
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id, user_id, program_id, exercise_id")
    .eq("id", chatId)
    .single();

  if (chatError || !chat) {
    console.error("[PORTRAIT] Chat not found:", chatId, chatError);
    return { success: false, error: "Чат не найден" };
  }

  // 1.5 Per-user rate limit (Gemini Pro is expensive)
  if (!checkPortraitRateLimit(chat.user_id)) {
    console.log("[PORTRAIT] Rate-limited for user:", chat.user_id);
    return { success: false, error: "rate_limited" };
  }

  // 2. Load messages
  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (msgError || !messages || messages.length === 0) {
    console.error("[PORTRAIT] No messages for chat:", chatId, msgError);
    return { success: false, error: "Нет сообщений для анализа" };
  }

  console.log("[PORTRAIT] Loaded", messages.length, "messages");

  // 3. Load current portrait
  const { data: portrait } = await supabase
    .from("portraits")
    .select("content")
    .eq("user_id", chat.user_id)
    .eq("program_id", chat.program_id)
    .maybeSingle();

  const currentPortrait = portrait?.content || {};
  console.log("[PORTRAIT] Current portrait exists:", !!portrait);

  // 3.5 Load user's anketa (identity facts) — даёт Gemini Pro контекст
  // того, что пользователь сам сказал о своём запросе, чтобы анализ диалога
  // учитывал это, а не делал выводы в вакууме.
  const anketaFacts = await getFacts(supabase, chat.user_id);
  const anketaBlock = formatAnketaForPortrait(anketaFacts);
  console.log("[PORTRAIT] Anketa facts loaded:", Object.keys(anketaFacts).length, "fields");

  // 4. Load program's portrait_prompt (fallback to file)
  const { data: programRow } = await supabase
    .from("programs")
    .select("portrait_prompt")
    .eq("id", chat.program_id)
    .single();
  const promptToUse = programRow?.portrait_prompt || PORTRAIT_ANALYST_PROMPT;

  // 5. Determine source label
  let sourceLabel = "свободный чат";
  if (chat.exercise_id) {
    const { data: exercise } = await supabase
      .from("exercises")
      .select("number, title")
      .eq("id", chat.exercise_id)
      .single();

    if (exercise) {
      sourceLabel = `Упражнение ${exercise.number}: ${exercise.title}`;
    }
  }

  // 5. Format transcript
  const chatTranscript = messages
    .map((m) => `[${m.role === "user" ? "ПОЛЬЗОВАТЕЛЬ" : "ФАСИЛИТАТОР"}]: ${m.content}`)
    .join("\n\n");

  // 6. Build request for Gemini Pro
  const userMessage = `
ТЕКУЩИЙ ПОРТРЕТ:
${JSON.stringify(currentPortrait, null, 2)}
${anketaBlock}
ИСТОЧНИК: ${sourceLabel}
ТРИГГЕР: ${trigger}
ДАТА: ${new Date().toISOString()}

ПЕРЕПИСКА:
${chatTranscript}

Проанализируй переписку и верни обновлённый портрет в формате JSON.
`;

  // 7. Call Gemini Pro
  console.log("[PORTRAIT] Calling Gemini Pro...");
  let responseText: string;
  try {
    responseText = await analyzeForPortrait(promptToUse, userMessage);
    console.log("[PORTRAIT] Gemini Pro response received, length:", responseText.length);
  } catch (err) {
    console.error("[PORTRAIT] Gemini Pro error:", err);
    return { success: false, error: "Gemini Pro API error" };
  }

  // 8. Parse JSON
  let updatedPortrait;
  try {
    const cleanJson = responseText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    updatedPortrait = JSON.parse(cleanJson);
  } catch {
    console.error("[PORTRAIT] JSON parse error:", responseText.substring(0, 500));
    return { success: false, error: "ИИ вернул невалидный JSON" };
  }

  // 9. Upsert to DB
  const { error: upsertError } = await supabase
    .from("portraits")
    .upsert(
      {
        user_id: chat.user_id,
        program_id: chat.program_id,
        content: updatedPortrait,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,program_id" },
    );

  if (upsertError) {
    console.error("[PORTRAIT] Upsert error:", upsertError);
    return { success: false, error: "Не удалось сохранить портрет" };
  }

  console.log("[PORTRAIT] Saved to DB successfully");
  return { success: true };
}
