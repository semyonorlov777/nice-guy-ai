/**
 * Одноразово перегенерирует интерпретацию для одного test_results.id.
 *
 * Запуск:
 *   npx tsx scripts/regenerate-test-interpretation.ts <result_id>
 *
 * Безопасен: если интерпретация уже валидная (не fallback) — не трогает.
 */

import * as fs from "fs";
import * as path from "path";

function loadEnv(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, "utf-8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const envPath = path.resolve(__dirname, "../.env.local");
const env = loadEnv(envPath);
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;

if (!supabaseUrl || !serviceKey || !geminiKey) {
  console.error(
    "❌ В .env.local должны быть: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_GEMINI_API_KEY"
  );
  process.exit(1);
}

const resultId = process.argv[2];
if (!resultId) {
  console.error("Использование: npx tsx scripts/regenerate-test-interpretation.ts <result_id>");
  process.exit(1);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(resultId)) {
  console.error(`❌ Невалидный UUID: ${resultId}`);
  process.exit(1);
}

// Динамический импорт — после того как env vars выставлены в process.env,
// чтобы lib/gemini-portrait (читает GOOGLE_GEMINI_API_KEY при импорте) получил значение.
async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { generateTestInterpretation, isFallbackInterpretation } = await import(
    "../lib/test-interpretation"
  );

  const supabase = createClient(supabaseUrl!, serviceKey!);

  console.log(`📥 Загружаю test_result ${resultId}`);
  const { data: result, error: loadErr } = await supabase
    .from("test_results")
    .select("id, test_slug, total_score, scores_by_scale, interpretation, user_id")
    .eq("id", resultId)
    .single();

  if (loadErr || !result) {
    console.error(`❌ test_result не найден: ${loadErr?.message ?? "no rows"}`);
    process.exit(1);
  }

  console.log(`   test_slug: ${result.test_slug}, score: ${result.total_score}, user: ${result.user_id}`);

  if (result.interpretation && !isFallbackInterpretation(result.interpretation)) {
    console.log("✅ Интерпретация уже валидная (не fallback). Ничего не делаю.");
    process.exit(0);
  }

  console.log(`📥 Загружаю test_config ${result.test_slug}`);
  const { data: testConfig, error: configErr } = await supabase
    .from("test_configs")
    .select("*")
    .eq("slug", result.test_slug)
    .eq("is_active", true)
    .single();

  if (configErr || !testConfig) {
    console.error(`❌ test_config не найден: ${configErr?.message ?? "no rows"}`);
    process.exit(1);
  }

  console.log("🤖 Вызываю Gemini (это ~20-30 секунд)…");
  let interpretation;
  try {
    interpretation = await generateTestInterpretation(
      result.total_score,
      result.scores_by_scale,
      testConfig
    );
  } catch (err) {
    console.error("❌ Gemini упал:", err);
    process.exit(1);
  }

  if (isFallbackInterpretation(interpretation)) {
    console.error("❌ generateTestInterpretation вернула fallback (внутренний catch). Не сохраняю.");
    process.exit(1);
  }

  console.log(`💾 Сохраняю interpretation (level: ${interpretation.level_label}, scales: ${interpretation.scales.length})`);
  const { error: updateErr } = await supabase
    .from("test_results")
    .update({ interpretation, status: "ready" })
    .eq("id", resultId);

  if (updateErr) {
    console.error(`❌ UPDATE упал: ${updateErr.message}`);
    process.exit(1);
  }

  console.log("✅ Готово. Открой страницу результатов:");
  console.log(`   https://nice-guy-ai.vercel.app/program/<slug>/test/results/${resultId}`);
}

main().catch((err) => {
  console.error("❌ Скрипт упал:", err);
  process.exit(1);
});
