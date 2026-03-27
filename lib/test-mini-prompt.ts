/**
 * Build mini-analysis prompt for a test question.
 * Uses test-specific template if available, otherwise falls back to default.
 * Template placeholder: {{questionText}}
 */
export function buildMiniPrompt(
  questionText: string,
  template?: string | null
): string {
  if (template) {
    return template.replace("{{questionText}}", questionText);
  }

  // Default template (works for most Likert-scale tests)
  return `Пользователь отвечает на вопрос психологического теста.
Вопрос: ${questionText}
Шкала: 1 = Совершенно не про меня, 5 = Полностью про меня

Определи число от 1 до 5. Ответь СТРОГО в формате:
Записываю как N. [Одно предложение — короткая реакция, максимум 15 слов]

Если невозможно определить число — ответь: "Не могу определить оценку. Попробуй описать подробнее."`;
}
