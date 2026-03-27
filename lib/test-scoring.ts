import type { TestConfig } from "./test-config";
import { getScaleOrder } from "./test-config";

export interface TestAnswer {
  q: number;
  scale: string;
  type: "direct" | "reverse";
  rawAnswer: number;
  score: number;
  text?: string;
}

export interface ScaleResult {
  raw: number;
  max: number;
  pct: number;
  level: string;
}

export interface TestResult {
  totalScore: number;
  totalRaw: number;
  scoresByScale: Record<string, ScaleResult>;
  topScales: string[];
  recommendedExercises: number[];
}

/**
 * Generic test scoring that works with any test configuration.
 *
 * Scoring formula:
 * - Reverse: (max + min) - answer  (for [1,5] = 6 - answer)
 * - Scale %: ((raw - N*min) / (N*(max-min))) * 100
 * - Total %: ((totalRaw - totalN*min) / (totalN*(max-min))) * 100
 * - Level: based on config.scoring.level_thresholds
 */
export function calculateTestScore(
  answers: TestAnswer[],
  config: TestConfig
): TestResult {
  const [min, max] = config.scoring.answer_range;
  const reverseBase = max + min; // For [1,5] = 6

  // 1. Calculate final scores (reverse questions)
  const scored = answers.map((a) => ({
    ...a,
    finalScore: a.type === "reverse" ? reverseBase - a.rawAnswer : a.rawAnswer,
  }));

  // 2. Aggregate by scale
  const scaleOrder = getScaleOrder(config);
  const scoresByScale: Record<string, ScaleResult> = {};

  for (const key of scaleOrder) {
    const scaleAnswers = scored.filter((a) => a.scale === key);
    const n = scaleAnswers.length;
    if (n === 0) continue;

    const raw = scaleAnswers.reduce((sum, a) => sum + a.finalScore, 0);
    const scaleMax = n * max;
    const range = n * (max - min);
    const pct = range > 0 ? Math.round(((raw - n * min) / range) * 100) : 0;
    const level = getLevel(pct, config);

    scoresByScale[key] = { raw, max: scaleMax, pct, level };
  }

  // 3. Total score
  const totalRaw = Object.values(scoresByScale).reduce(
    (sum, s) => sum + s.raw,
    0
  );
  const totalN = answers.length;
  const totalRange = totalN * (max - min);
  const totalScore =
    totalRange > 0
      ? Math.round(((totalRaw - totalN * min) / totalRange) * 100)
      : 0;

  // 4. Top scales (sorted by pct, direction-aware)
  const isLowerBetter = config.scoring.score_direction === "lower_is_better";
  const topScales = [...scaleOrder]
    .sort((a, b) => {
      const pctA = scoresByScale[a]?.pct ?? 0;
      const pctB = scoresByScale[b]?.pct ?? 0;
      // For lower_is_better, highest pct = most problematic = top
      // For higher_is_better, highest pct = best performance = top
      return isLowerBetter ? pctB - pctA : pctB - pctA;
    })
    .slice(0, 3);

  // 5. Recommended exercises from top scales
  const scalesMap = new Map(config.scales.map((s) => [s.key, s]));
  const recommendedExercises = topScales.flatMap(
    (key) => scalesMap.get(key)?.exercises ?? []
  );

  return {
    totalScore,
    totalRaw,
    scoresByScale,
    topScales,
    recommendedExercises,
  };
}

function getLevel(pct: number, config: TestConfig): string {
  const { level_thresholds, level_labels } = config.scoring;
  for (let i = 0; i < level_thresholds.length; i++) {
    if (pct <= level_thresholds[i]) {
      return level_labels[i] ?? `level_${i}`;
    }
  }
  return level_labels[level_thresholds.length] ?? "high";
}
