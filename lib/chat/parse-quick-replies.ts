/**
 * Парсинг «кавычек-ёлочек» из конца AI-сообщения как быстрых ответов-кнопок.
 *
 * Паттерн: строки вида «Текст» (или "Текст") в самом конце сообщения,
 * каждая на отдельной строке. Парсер читает с конца, пропускает пустые строки,
 * собирает матчи, останавливается на первой не-матчащей строке.
 *
 * Толерантность к markdown-маркерам: если модель ошибочно оборачивает «ёлочки»
 * в списковые префиксы (`* «...»`, `- «...»`, `• «...»`, `1. «...»`), парсер
 * срежет префикс ДО проверки regex. Это ловит частый формат сбоя Gemini, где
 * промпт слабее.
 *
 * Возвращает replies как массив объектов `{text, type}` — совместимо с
 * welcome_replies из БД (одна и та же сигнатура во всех чат-компонентах).
 * Последний reply автоматически получает `type: "exit"` если их ≥3
 * (по правилу runbook: «последний reply в начале диалога — безопасный exit»).
 *
 * Source of truth формата — docs/runbooks/chat-message-formatting.md.
 *
 * ВАЖНО: эту функцию используют ВСЕ компоненты-чаты (ChatWindow, NewChatScreen,
 * AnonymousChat) через единый components/chat/ChatMessage.tsx. Не дублируй
 * логику парсинга в самих компонентах — вызывай только через ChatMessage.
 */
const LIST_MARKER_RE = /^(?:[*\-•·]|\d+\.)\s+/;

function stripListMarker(line: string): string {
  return line.replace(LIST_MARKER_RE, "");
}

export type QuickReplyType = "normal" | "exit";

export interface QuickReply {
  text: string;
  type: QuickReplyType;
}

export function parseQuickReplies(
  text: string,
  isStreaming: boolean,
): { cleanText: string; replies: QuickReply[] } {
  const lines = text.trimEnd().split("\n");
  const rawReplies: string[] = [];
  let i = lines.length - 1;

  while (i >= 0) {
    const line = stripListMarker(lines[i].trim());
    if (!line) {
      i--;
      continue;
    }
    const match = line.match(/^[«"](.+?)[»"]$/);
    if (match) {
      rawReplies.unshift(match[1]);
      i--;
    } else {
      break;
    }
  }

  const cleanText =
    rawReplies.length === 0
      ? text
      : lines.slice(0, i + 1).join("\n").trimEnd();

  // Во время стрима: прячем частично-выведенную открытую «ёлочку»
  // (`«Вари` без закрывающей `»`), чтобы не светить сырой токен до момента
  // когда модель дотокенит его и он станет кнопкой.
  let finalCleanText = cleanText;
  if (isStreaming) {
    const remainingLines = cleanText.split("\n");
    for (let j = remainingLines.length - 1; j >= 0; j--) {
      const line = stripListMarker(remainingLines[j].trim());
      if (!line) continue;
      if (line.startsWith("«") && !line.endsWith("»")) {
        finalCleanText = remainingLines.slice(0, j).join("\n").trimEnd();
      }
      break;
    }
  }

  // Тип replies: последний автоматически "exit" если их ≥3
  // (runbook: «последний reply в начале диалога — безопасный exit»).
  // Для replies с <3 элементов — все normal (в scaffolding 13+ ходов
  // остаётся 1 fallback, и ему exit-стиль нужен как раз при 1 элементе).
  const replies: QuickReply[] = rawReplies.map((text, idx) => {
    const isLast = idx === rawReplies.length - 1;
    const shouldBeExit = isLast && (rawReplies.length >= 3 || rawReplies.length === 1);
    return { text, type: shouldBeExit ? "exit" : "normal" };
  });

  return { cleanText: finalCleanText, replies };
}
