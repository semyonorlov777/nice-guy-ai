import { generateText } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chatModel, CHAT_PROVIDER_OPTIONS } from "@/lib/ai";
import type { IdentityFacts } from "@/lib/personalization";
import type { ProgramTheme } from "@/lib/queries/themes";
import { createServiceClient } from "@/lib/supabase-server";

const MAX_RELEVANT = 4;

function buildPrompt(facts: IdentityFacts, themes: ProgramTheme[]): string {
  const factsLines: string[] = [];
  if (facts.context_intent)
    factsLines.push(`- Что привело к программе: ${facts.context_intent}`);
  if (facts.problem)
    factsLines.push(`- Что не так сейчас: ${facts.problem}`);
  if (facts.implication)
    factsLines.push(`- Что будет если не менять: ${facts.implication}`);
  if (facts.need_payoff)
    factsLines.push(`- Желаемый результат: ${facts.need_payoff}`);

  const themesList = themes
    .map((t, i) => {
      const desc = t.description ? ` — ${t.description}` : "";
      return `${i + 1}. ${t.title}${desc}`;
    })
    .join("\n");

  return `Запрос пользователя из анкеты:
${factsLines.join("\n")}

Список тем программы:
${themesList}

Какие темы наиболее релевантны запросу пользователя? Выбери от 2 до ${MAX_RELEVANT} тем, которые реально про этот запрос. Не лей воду — лучше меньше, но точнее.

Верни только JSON-массив номеров тем от самой релевантной к менее релевантной. Без markdown, без комментариев, без объяснений. Только массив.

Пример правильного ответа: [3, 1, 5]`;
}

function parseRelevantIndexes(
  responseText: string,
  themeCount: number,
): number[] {
  const cleaned = responseText
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\[[\d,\s]+\]/);
    if (!match) return [];
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];
  const result: number[] = [];
  for (const item of parsed) {
    const n = typeof item === "number" ? item : parseInt(String(item), 10);
    if (Number.isInteger(n) && n >= 1 && n <= themeCount && !result.includes(n)) {
      result.push(n);
    }
  }
  return result.slice(0, MAX_RELEVANT);
}

async function computeRelevantKeys(
  facts: IdentityFacts,
  themes: ProgramTheme[],
): Promise<string[]> {
  if (themes.length === 0) return [];

  try {
    const { text } = await generateText({
      model: chatModel(),
      prompt: buildPrompt(facts, themes),
      providerOptions: CHAT_PROVIDER_OPTIONS,
    });

    const indexes = parseRelevantIndexes(text, themes.length);
    if (indexes.length === 0) {
      console.warn("[theme-relevance] empty parse from Gemini, fallback to all themes");
      return themes.map((t) => t.key);
    }

    return indexes.map((i) => themes[i - 1].key);
  } catch (err) {
    console.error("[theme-relevance] Gemini error:", err);
    return themes.map((t) => t.key);
  }
}

/**
 * Возвращает массив ключей тем, релевантных анкете пользователя, в порядке
 * убывания релевантности. Кеширует результат в БД: пересчитывается только
 * при первом заходе или после инвалидации (когда обновляется анкета).
 *
 * Если анкета пустая — возвращает все ключи в исходном порядке.
 */
export async function getRelevantThemeKeys(
  supabase: SupabaseClient,
  userId: string,
  programId: string,
  facts: IdentityFacts,
  themes: ProgramTheme[],
): Promise<string[]> {
  if (Object.keys(facts).length === 0) {
    return themes.map((t) => t.key);
  }

  const { data: cached } = await supabase
    .from("anketa_theme_relevance")
    .select("relevant_keys")
    .eq("user_id", userId)
    .eq("program_id", programId)
    .maybeSingle();

  if (cached?.relevant_keys && cached.relevant_keys.length > 0) {
    const validKeys = (cached.relevant_keys as string[]).filter((k) =>
      themes.some((t) => t.key === k),
    );
    if (validKeys.length > 0) return validKeys;
  }

  const relevantKeys = await computeRelevantKeys(facts, themes);

  const service = createServiceClient();
  const { error } = await service.from("anketa_theme_relevance").upsert(
    {
      user_id: userId,
      program_id: programId,
      relevant_keys: relevantKeys,
      computed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,program_id" },
  );
  if (error) console.error("[theme-relevance] cache upsert error:", error);

  return relevantKeys;
}

/**
 * Удаляет кеш AI-фильтрации тем для пользователя. Вызывается при сохранении
 * новой версии ответа анкеты, чтобы при следующем заходе на хаб релевантность
 * пересчиталась с актуальными данными.
 */
export async function invalidateThemeRelevance(
  service: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await service
    .from("anketa_theme_relevance")
    .delete()
    .eq("user_id", userId);
  if (error) console.error("[theme-relevance] invalidate error:", error);
}
