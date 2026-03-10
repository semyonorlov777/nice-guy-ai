import { analyzeForPortrait } from "./gemini-portrait";
import { ISSP_SCALES, ISSP_SCALE_ORDER } from "./issp-config";
import type { ScaleResult } from "./issp-scoring";

// ── Типы ──

export interface ISSPInterpretation {
  overall: string;
  level_label: string;
  scales: Array<{ scale_key: string; interpretation: string }>;
  top_zones: Array<{ scale_key: string; action_text: string }>;
}

// ── Уровни ──

function getLevelLabel(score: number): string {
  if (score <= 25) return "Низкий уровень";
  if (score <= 50) return "Умеренный уровень";
  if (score <= 75) return "Выраженный уровень";
  return "Высокий уровень";
}

// ── Системный промпт ──

const ISSP_INTERPRETATION_PROMPT = `Ты — психолог-консультант, специализирующийся на мужской психологии и работе с паттернами «славного парня» по методике Роберта Гловера. Твоя задача — написать персонализированные интерпретации результатов теста ИССП.

7 ПРАВИЛ ЯЗЫКА:
1. НОРМАЛИЗАЦИЯ. Не «у вас проблема», а «многие мужчины усвоили эту стратегию». Всегда через общий опыт.
2. ПОВЕДЕНИЕ, НЕ ЧЕЛОВЕК. «Вы склонны...» вместо «вы такой...». Стратегию можно изменить.
3. ОСОЗНАНИЕ = ДОСТИЖЕНИЕ. Сам факт что человек видит паттерн — уже шаг.
4. ПРИЧИНА, НЕ ДИАГНОЗ. Кратко объясняй откуда берётся паттерн (из детства/воспитания).
5. РЕСУРС В КАЖДОМ МИНУСЕ:
   - Потребность в одобрении → развитая эмпатия
   - Подавление потребностей → навык заботы о других
   - Сложности с границами → гибкость, дипломатичность
   - Трудности с конфликтами → стремление к гармонии
   - Контролирующее поведение → организованность
   - Скрытые контракты → щедрость и внимательность
   - Изоляция → самостоятельность
6. ЯЗЫК ДВИЖЕНИЯ. «начать», «расти», «на пути к». Не статичные определения.
7. НЕ ПАТОЛОГИЗИРОВАТЬ. Запрещено: синдром, нарушение, дисфункция, расстройство, зависимость, диагноз, токсичный. Используй: паттерн, привычка, стратегия, навык, склонность.

ФОРМУЛА ШКАЛЫ: [Ресурс/позитив] + [Обратная сторона] + [Направление роста]. 2-3 предложения.
ФОРМУЛА ОБЩЕЙ: [Что показывает результат] + [Нормализация] + [Осознание + направление]. 3-4 предложения.

УРОВНИ: 0-25 "Низкий уровень", 26-50 "Умеренный уровень", 51-75 "Выраженный уровень", 76-100 "Высокий уровень"

КЛЮЧИ ШКАЛ: approval, contracts, suppression, control, boundaries, masculinity, attachment

Ответь ТОЛЬКО валидным JSON без markdown-обёртки:
{
  "overall": "Общая интерпретация (3-4 предложения)",
  "level_label": "Умеренный уровень",
  "scales": [
    { "scale_key": "approval", "interpretation": "2-3 предложения" },
    { "scale_key": "contracts", "interpretation": "2-3 предложения" },
    { "scale_key": "suppression", "interpretation": "2-3 предложения" },
    { "scale_key": "control", "interpretation": "2-3 предложения" },
    { "scale_key": "boundaries", "interpretation": "2-3 предложения" },
    { "scale_key": "masculinity", "interpretation": "2-3 предложения" },
    { "scale_key": "attachment", "interpretation": "2-3 предложения" }
  ],
  "top_zones": [
    { "scale_key": "...", "action_text": "Практический совет 1-2 предложения" },
    { "scale_key": "...", "action_text": "Практический совет 1-2 предложения" },
    { "scale_key": "...", "action_text": "Практический совет 1-2 предложения" }
  ]
}`;

// ── Генерация ──

export async function generateInterpretation(
  totalScore: number,
  scoresByScale: Record<string, ScaleResult>
): Promise<ISSPInterpretation> {
  const levelLabel = getLevelLabel(totalScore);

  // Формируем user message с баллами
  const scaleLines = ISSP_SCALE_ORDER.map((key) => {
    const s = scoresByScale[key];
    const name = ISSP_SCALES[key]?.name ?? key;
    return `- ${key} (${name}): ${s.pct}%`;
  }).join("\n");

  const topScales = [...ISSP_SCALE_ORDER]
    .sort((a, b) => (scoresByScale[b]?.pct ?? 0) - (scoresByScale[a]?.pct ?? 0))
    .slice(0, 3);

  const userMessage = `Сгенерируй интерпретации результатов теста ИССП.

Общий балл: ${totalScore}/100 (${levelLabel})

Баллы по шкалам:
${scaleLines}

Топ-3 шкалы: ${topScales.join(", ")}`;

  try {
    const responseText = await analyzeForPortrait(
      ISSP_INTERPRETATION_PROMPT,
      userMessage
    );

    // Убираем возможную markdown-обёртку
    const cleanJson = responseText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed = JSON.parse(cleanJson);

    // Валидация минимальной структуры
    if (!parsed.overall || !Array.isArray(parsed.scales)) {
      throw new Error("Missing required fields: overall, scales");
    }

    // Проставляем level_label если Gemini его не вернул
    if (!parsed.level_label) {
      parsed.level_label = levelLabel;
    }

    return parsed as ISSPInterpretation;
  } catch (err) {
    console.error("[ISSP-INTERPRETATION] Error:", err);

    // Fallback — не ломаем процесс
    return {
      overall:
        "Тест завершён. Подробная интерпретация временно недоступна.",
      level_label: levelLabel,
      scales: ISSP_SCALE_ORDER.map((key) => ({
        scale_key: key,
        interpretation: "Интерпретация временно недоступна.",
      })),
      top_zones: [],
    };
  }
}
