import { ThinkingLevel, type ThinkingConfig } from "@google/genai";

/** Запасные текстовые модели: основную Google временами часами отдаёт с 503 (перегрузка). */
export const TEXT_FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-2.5-pro"];

/** У моделей 3.x — уровень размышлений, у 2.5 — бюджет в токенах. */
export function lowThinking(model: string): ThinkingConfig {
  if (model.startsWith("gemini-2.5-pro")) return { thinkingBudget: 512 };
  if (model.startsWith("gemini-2.5")) return { thinkingBudget: 0 };
  return { thinkingLevel: ThinkingLevel.LOW };
}

/** Перебрать основную и запасные модели, вернуть первый успешный ответ. */
export async function withModelFallback<T>(
  primary: string,
  call: (model: string) => Promise<T>,
  tag: string,
  fallbacks: string[] = TEXT_FALLBACK_MODELS,
): Promise<{ result: T; model: string }> {
  let lastErr: unknown;
  for (const model of [primary, ...fallbacks.filter((m) => m !== primary)]) {
    try {
      return { result: await call(model), model };
    } catch (e) {
      lastErr = e;
      console.error(`[${tag}] model failed`, model, String(e).slice(0, 200));
    }
  }
  throw lastErr;
}
