import { analyzeForPortrait } from "./gemini-portrait";
import type { TestConfig } from "./test-config";
import { getScaleOrder } from "./test-config";
import type { ScaleResult } from "./test-scoring";

export interface TestInterpretation {
  overall: string;
  level_label: string;
  scales: Array<{ scale_key: string; interpretation: string }>;
  top_zones: Array<{ scale_key: string; action_text: string }>;
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

    return parsed as TestInterpretation;
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
    overall: "Тест завершён. Подробная интерпретация временно недоступна.",
    level_label: levelLabel,
    scales: scaleOrder.map((key) => ({
      scale_key: key,
      interpretation: "Интерпретация временно недоступна.",
    })),
    top_zones: [],
  };
}
