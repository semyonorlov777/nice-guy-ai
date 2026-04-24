"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { parseQuickReplies } from "@/lib/chat/parse-quick-replies";

/**
 * Единый компонент рендера AI-сообщения для ВСЕХ чат-поверхностей
 * (ChatWindow, NewChatScreen, AnonymousChat, anything новое).
 *
 * Что делает:
 * - Парсит «ёлочки» в конце текста через parseQuickReplies (из lib/chat).
 * - Рендерит cleanText через ReactMarkdown с remark-breaks (одинарный \n = <br>).
 * - Если есть replies — рендерит кнопки-«ёлочки» после bubble.
 *
 * Зачем единый компонент:
 * Ранее каждый экран (NewChatScreen, AnonymousChat) рендерил AI-ответы через
 * голый ReactMarkdown без парсинга «ёлочек» — в итоге кнопки появлялись только
 * в ChatWindow (после reload), а на welcome-экране пользователь видел ёлочки
 * plain-текстом. См. docs/chat-audit-eq-2-0.md.
 *
 * API:
 * - `text` — полный текст AI (может содержать «ёлочки» в конце)
 * - `isStreaming` — для парсера (прячет частично-выведенные «ёлочки»)
 * - `onReplyClick` — если передан, кнопки кликабельны; если undefined —
 *    вообще не рендерить блок кнопок
 * - `classNames` — кастомизация CSS-классов (bubble, replies-container, reply-btn,
 *    reply-btn-exit, reply-label). Каждый экран передаёт свои.
 */
export interface ChatMessageClassNames {
  bubble?: string;
  repliesContainer?: string;
  replyButton?: string;
  replyButtonExit?: string;
  replyLabel?: string;
}

export interface ChatMessageProps {
  text: string;
  isStreaming?: boolean;
  onReplyClick?: (text: string) => void;
  disabled?: boolean;
  classNames?: ChatMessageClassNames;
  /** Показать ли служебный лейбл "Выбери вариант или напиши своё" над кнопками */
  showReplyLabel?: boolean;
  /** Произвольный контент внутри bubble после markdown (например streaming cursor) */
  bubbleSuffix?: React.ReactNode;
}

const DEFAULT_LABEL = "Выбери вариант или напиши своё";

export function ChatMessage({
  text,
  isStreaming = false,
  onReplyClick,
  disabled = false,
  classNames = {},
  showReplyLabel = true,
  bubbleSuffix,
}: ChatMessageProps) {
  const { cleanText, replies } = parseQuickReplies(text, isStreaming);

  const bubbleClass = classNames.bubble ?? "msg-bubble";
  const repliesContainerClass = classNames.repliesContainer ?? "quick-replies";
  const replyBtnClass = classNames.replyButton ?? "quick-reply-btn";
  const replyBtnExitClass = classNames.replyButtonExit ?? "quick-reply-btn-exit";
  const labelClass = classNames.replyLabel ?? "quick-reply-label";

  return (
    <>
      <div className={bubbleClass}>
        <ReactMarkdown remarkPlugins={[remarkBreaks]}>{cleanText}</ReactMarkdown>
        {bubbleSuffix}
      </div>
      {onReplyClick && replies.length > 0 && (
        <div className={repliesContainerClass}>
          {showReplyLabel && <div className={labelClass}>{DEFAULT_LABEL}</div>}
          {replies.map((reply, i) => (
            <button
              key={i}
              className={replyBtnClass}
              onClick={() => onReplyClick(reply)}
              disabled={disabled}
            >
              {reply}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
