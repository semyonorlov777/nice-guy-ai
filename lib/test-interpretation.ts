import { analyzeForPortrait } from "./gemini-portrait";
import type { TestConfig } from "./test-config";
import { getScaleOrder } from "./test-config";
import type { ScaleResult } from "./test-scoring";

export interface TestInterpretation {
  overall: string;
  level_label: string;
  scales: Array<{ scale_key: string; interpretation: string }>;
  // Минимальный формат (eq-test, issp-test): scale_key + action_text.
  // Расширенный формат для тестов-типологий (archetype-test): + score / headline / body / action_route.
  // Поле archetype — legacy: ранние промпты выдавали русское имя; нормализатор резолвит его в scale_key.
  top_zones: Array<{
    scale_key: string;
    action_text: string;
    score?: number;
    headline?: string;
    body?: string;
    action_route?: string;
    archetype?: string;
  }>;
}

export const FALLBACK_OVERALL_TEXT =
  "Тест завершён. Подробная интерпретация временно недоступна.";

const FALLBACK_SCALE_TEXT = "Интерпретация временно недоступна.";

export function isFallbackInterpretation(
  interp: TestInterpretation | null | undefined
): boolean {
  if (!interp) return true;
  if (!interp.overall) return true;
  return interp.overall === FALLBACK_OVERALL_TEXT;
}

/**
 * Нормализует interpretation от Gemini. Разные промпты выдают разные ключи:
 * - nice-guy / eq-test: `scale_key` (целевой формат UI).
 * - heroes-and-outlaws (legacy): `key` или `archetype` (русское имя архетипа).
 *
 * Если передан `scaleNames` (мапа `scale_key → русское_имя` из конфига теста),
 * нормализатор инвертирует её и резолвит `archetype` → `scale_key`. Без `scaleNames`
 * делает только `key → scale_key` — безопасно для всех тестов.
 */
export function normalizeInterpretation(
  interp: TestInterpretation | null | undefined,
  scaleNames?: Record<string, string>
): TestInterpretation | null {
  if (!interp) return null;
  const nameToKey = new Map<string, string>();
  if (scaleNames) {
    for (const [key, name] of Object.entries(scaleNames)) {
      if (name) nameToKey.set(name.trim().toLowerCase(), key);
    }
  }
  type Loose = { scale_key?: string; key?: string; archetype?: string };
  const fixKey = <T extends Loose>(item: T): T => {
    if (item.scale_key) return item;
    if (item.key) return { ...item, scale_key: item.key };
    if (item.archetype && nameToKey.size > 0) {
      const resolved = nameToKey.get(item.archetype.trim().toLowerCase());
      if (resolved) return { ...item, scale_key: resolved };
    }
    return item;
  };
  // Некоторые промпты (mind-power и др. навыковые тесты) выдают top_zones в формате
  // { label, recommendation } вместо { headline, body, action_text }. Мапим, чтобы
  // TopZones получил привычные поля без потери текста.
  type LooseZone = Loose & {
    label?: string;
    recommendation?: string;
    headline?: string;
    body?: string;
    action_text?: string;
  };
  const fixZone = (zone: LooseZone): LooseZone => {
    const withKey = fixKey(zone);
    const headline = withKey.headline ?? withKey.label;
    const body = withKey.body ?? withKey.recommendation;
    const action_text = withKey.action_text ?? withKey.recommendation;
    return { ...withKey, headline, body, action_text };
  };
  return {
    ...interp,
    scales: Array.isArray(interp.scales) ? interp.scales.map(fixKey) : [],
    top_zones: Array.isArray(interp.top_zones)
      ? (interp.top_zones as LooseZone[]).map(fixZone) as TestInterpretation["top_zones"]
      : [],
  };
}

function getLevelLabel(score: number, config: TestConfig): string {
  const { level_thresholds, level_labels } = config.scoring;
  for (let i = 0; i < level_thresholds.length; i++) {
    if (score <= level_thresholds[i]) {
      return level_labels[i] ?? `level_${i}`;
    }
  }
  return level_labels[level_thresholds.length] ?? "high";
}

/**
 * Generate AI interpretation for test results using the test's interpretation prompt.
 * Falls back gracefully if no prompt is configured or Gemini fails.
 */
export async function generateTestInterpretation(
  totalScore: number,
  scoresByScale: Record<string, ScaleResult>,
  config: TestConfig
): Promise<TestInterpretation> {
  const levelLabel = getLevelLabel(totalScore, config);
  const scaleOrder = getScaleOrder(config);
  const scaleNames = new Map(config.scales.map((s) => [s.key, s.name]));

  if (!config.interpretation_prompt) {
    return buildFallback(levelLabel, scaleOrder);
  }

  const scaleLines = scaleOrder
    .map((key) => {
      const s = scoresByScale[key];
      const name = scaleNames.get(key) ?? key;
      return `- ${key} (${name}): ${s?.pct ?? 0}%`;
    })
    .join("\n");

  const topScales = [...scaleOrder]
    .sort(
      (a, b) => (scoresByScale[b]?.pct ?? 0) - (scoresByScale[a]?.pct ?? 0)
    )
    .slice(0, 3);

  const userMessage = `Сгенерируй интерпретации результатов теста.

Общий балл: ${totalScore}/100 (${levelLabel})

Баллы по шкалам:
${scaleLines}

Топ-3 шкалы: ${topScales.join(", ")}`;

  try {
    const responseText = await analyzeForPortrait(
      config.interpretation_prompt,
      userMessage
    );

    const cleanJson = responseText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed = JSON.parse(cleanJson);

    if (!parsed.overall || !Array.isArray(parsed.scales)) {
      throw new Error("Missing required fields: overall, scales");
    }

    if (!parsed.level_label) {
      parsed.level_label = levelLabel;
    }

    return normalizeInterpretation(
      parsed as TestInterpretation,
      Object.fromEntries(scaleNames)
    )!;
  } catch (err) {
    console.error("[test-interpretation] Error:", err);
    return buildFallback(levelLabel, scaleOrder);
  }
}

function buildFallback(
  levelLabel: string,
  scaleOrder: string[]
): TestInterpretation {
  return {
    overall: FALLBACK_OVERALL_TEXT,
    level_label: levelLabel,
    scales: scaleOrder.map((key) => ({
      scale_key: key,
      interpretation: FALLBACK_SCALE_TEXT,
    })),
    top_zones: [],
  };
}
