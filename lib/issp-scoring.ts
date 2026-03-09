import { ISSP_SCALES, ISSP_SCALE_ORDER } from "./issp-config";

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
  level: "low" | "medium" | "high";
}

export interface ISSPResult {
  totalScore: number;
  totalRaw: number;
  scoresByScale: Record<string, ScaleResult>;
  topScales: string[];
  recommendedExercises: number[];
}

export function calculateISSP(answers: TestAnswer[]): ISSPResult {
  // 1. Calculate final scores (reverse questions: 6 - answer)
  const scored = answers.map((a) => ({
    ...a,
    finalScore: a.type === "reverse" ? 6 - a.rawAnswer : a.rawAnswer,
  }));

  // 2. Aggregate by scale
  const scoresByScale: Record<string, ScaleResult> = {};
  for (const key of ISSP_SCALE_ORDER) {
    const scaleAnswers = scored.filter((a) => a.scale === key);
    const raw = scaleAnswers.reduce((sum, a) => sum + a.finalScore, 0);
    const pct = Math.round(((raw - 5) / 20) * 100);
    const level = pct <= 30 ? "low" : pct <= 60 ? "medium" : "high";
    scoresByScale[key] = { raw, max: 25, pct, level };
  }

  // 3. Total ISSP
  const totalRaw = Object.values(scoresByScale).reduce((sum, s) => sum + s.raw, 0);
  const totalScore = Math.round(((totalRaw - 35) / 140) * 100);

  // 4. Top 3 scales (sorted by percentage descending)
  const topScales = [...ISSP_SCALE_ORDER]
    .sort((a, b) => scoresByScale[b].pct - scoresByScale[a].pct)
    .slice(0, 3);

  // 5. Recommended exercises from top scales
  const recommendedExercises = topScales.flatMap(
    (key) => ISSP_SCALES[key].exercises
  );

  return { totalScore, totalRaw, scoresByScale, topScales, recommendedExercises };
}

/**
 * Форматирует результаты ИССП в системное сообщение для Gemini.
 * Gemini НЕ должен пересчитывать — только интерпретировать готовые числа.
 */
export function formatISSPScoresMessage(result: ISSPResult): string {
  const levelRu = (l: string) =>
    l === "high" ? "высокий" : l === "medium" ? "средний" : "низкий";

  const scaleLines = ISSP_SCALE_ORDER.map((key) => {
    const s = result.scoresByScale[key];
    return `- ${ISSP_SCALES[key].name}: ${s.raw}/${s.max} (${s.pct}%) — ${levelRu(s.level)}`;
  }).join("\n");

  const topNames = result.topScales
    .map((k) => ISSP_SCALES[k].name)
    .join(", ");

  return `[СИСТЕМА] Тест завершён. Баллы подсчитаны сервером — используй ТОЛЬКО эти числа, не пересчитывай.

📊 ИССП: ${result.totalScore}/100

Шкалы:
${scaleLines}

Топ-3: ${topNames}
Рекомендуемые упражнения: №${result.recommendedExercises.join(", №")}

Сформируй интерпретацию по шаблону из <result_format>. Числа выше — финальные, не меняй их.`;
}
