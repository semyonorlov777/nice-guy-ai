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
