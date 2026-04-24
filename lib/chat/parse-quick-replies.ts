/**
 * Парсинг «кавычек-ёлочек» из конца AI-сообщения как быстрых ответов-кнопок.
 *
 * Паттерн: строки вида «Текст» (или "Текст") в самом конце сообщения,
 * каждая на отдельной строке. Парсер читает с конца, пропускает пустые строки,
 * собирает матчи, останавливается на первой не-матчащей строке.
 *
 * Source of truth формата — docs/runbooks/chat-message-formatting.md.
 *
 * ВАЖНО: эту функцию используют ВСЕ компоненты-чаты (ChatWindow, NewChatScreen,
 * AnonymousChat) через единый components/chat/ChatMessage.tsx. Не дублируй
 * логику парсинга в самих компонентах — вызывай только через ChatMessage.
 */
export function parseQuickReplies(
  text: string,
  isStreaming: boolean,
): { cleanText: string; replies: string[] } {
  const lines = text.trimEnd().split("\n");
  const replies: string[] = [];
  let i = lines.length - 1;

  while (i >= 0) {
    const line = lines[i].trim();
    if (!line) {
      i--;
      continue;
    }
    const match = line.match(/^[«"](.+?)[»"]$/);
    if (match) {
      replies.unshift(match[1]);
      i--;
    } else {
      break;
    }
  }

  const cleanText =
    replies.length === 0
      ? text
      : lines.slice(0, i + 1).join("\n").trimEnd();

  // Во время стрима: прячем частично-выведенную открытую «ёлочку»
  // (`«Вари` без закрывающей `»`), чтобы не светить сырой токен до момента
  // когда модель дотокенит его и он станет кнопкой.
  if (isStreaming) {
    const remainingLines = cleanText.split("\n");
    for (let j = remainingLines.length - 1; j >= 0; j--) {
      const line = remainingLines[j].trim();
      if (!line) continue;
      if (line.startsWith("«") && !line.endsWith("»")) {
        return {
          cleanText: remainingLines.slice(0, j).join("\n").trimEnd(),
          replies,
        };
      }
      break;
    }
  }

  return { cleanText, replies };
}
