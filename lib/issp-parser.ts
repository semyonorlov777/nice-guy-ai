export interface ParseResult {
  scores: number[];
  isConfirmation: boolean;
}

/**
 * Parses AI response to extract confirmed scores.
 *
 * Patterns:
 * - "Записываю как N" → score N (text answer interpreted by AI)
 * - "Принято" / "Готово" → take number from user message (numeric answer)
 */
export function parseAIResponse(aiText: string, userText: string): ParseResult {
  const scores: number[] = [];

  // Pattern 1: "Записываю как N" (one or multiple in a single message)
  const zapisyvayu = [
    ...aiText.matchAll(
      /[Зз]аписываю(?:\s+(?:первый|второй|третий|его|её|это|ответ(?:ы)?)\s+|\s+)как\s+(\d)/g
    ),
  ];
  if (zapisyvayu.length > 0) {
    for (const m of zapisyvayu) {
      const n = parseInt(m[1]);
      if (n >= 1 && n <= 5) scores.push(n);
    }
    return { scores, isConfirmation: scores.length > 0 };
  }

  // Pattern 2: "Принято" or "Готово" — take number from user message
  if (/[Пп]ринято|[Гг]отово/.test(aiText)) {
    const userNumbers = [...userText.trim().matchAll(/\b([1-5])\b/g)];
    if (userNumbers.length > 0) {
      for (const m of userNumbers) {
        scores.push(parseInt(m[1]));
      }
    }
    return { scores, isConfirmation: scores.length > 0 };
  }

  return { scores: [], isConfirmation: false };
}

/**
 * Extracts score 1-5 from user message text.
 * Primary source of truth for ISSP test scoring.
 * Returns number 1-5 or null if can't determine.
 */
export function extractScoreFromUserMessage(text: string): number | null {
  const trimmed = text.trim();

  // Число 1-5
  if (/^[1-5]$/.test(trimmed)) {
    return parseInt(trimmed);
  }

  const lower = trimmed.toLowerCase();

  // "да"/"точно"/"это про меня"/"конечно" → 5
  if (/^(да|точно|это про меня|конечно|абсолютно|полностью|однозначно|определённо|именно|верно)$/.test(lower)) return 5;

  // "скорее да"/"часто"/"пожалуй" → 4
  if (/^(скорее да|часто|пожалуй|в целом да|наверное|почти всегда|в основном)$/.test(lower)) return 4;

  // "иногда"/"бывает"/"50/50" → 3
  if (/^(иногда|бывает|50\/50|средне|не знаю|может быть|наполовину|и да и нет|по-разному)$/.test(lower)) return 3;

  // "скорее нет"/"редко"/"не особо" → 2
  if (/^(скорее нет|редко|не особо|вряд ли|маловероятно|почти нет|не очень)$/.test(lower)) return 2;

  // "нет"/"не про меня"/"совсем нет" → 1
  if (/^(нет|не про меня|совсем нет|никогда|абсолютно нет|ни разу|нисколько)$/.test(lower)) return 1;

  return null;
}

/**
 * Checks if user message is a number outside valid 1-5 range.
 * Such messages should NOT be recorded as answers.
 */
export function isOutOfRangeNumber(text: string): boolean {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) && !/^[1-5]$/.test(trimmed);
}
