"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

/**
 * Единый рендер-слой AI-сообщений для ВСЕХ чат-поверхностей
 * (ChatWindow, NewChatScreen, AnonymousChat, anything новое).
 *
 * Два компонента вместо одного монолитного, чтобы вызывающий код
 * мог разместить их в правильных местах layout-а:
 *
 * - <AIBubble>       — пузырь с текстом ответа. Кладётся ВНУТРЬ flex-row
 *                      контейнера сообщения (рядом с аватаром).
 * - <QuickReplyBar>  — блок кнопок-«ёлочек». Кладётся как SIBLING
 *                      контейнера сообщения, НЕ внутрь flex-row.
 *                      Иначе кнопки уедут в узкую колонку справа от bubble.
 *
 * parseQuickReplies живёт в lib/chat/parse-quick-replies.ts — вызывающий
 * парсит ровно один раз, cleanText передаёт в AIBubble, replies — в
 * QuickReplyBar. Единый источник истины для формата «ёлочек».
 *
 * См. docs/runbooks/chat-message-formatting.md → раздел
 * «Архитектурный инвариант» и docs/chat-audit-eq-2-0.md.
 */

// --- AIBubble --------------------------------------------------------------

export interface AIBubbleProps {
  /** cleanText из parseQuickReplies (без «ёлочек» в конце) */
  text: string;
  /** CSS-класс пузыря — передаётся вызывающим под его дизайн-систему */
  className?: string;
  /** Произвольный JSX внутри bubble после markdown (streaming cursor и т.п.) */
  bubbleSuffix?: React.ReactNode;
}

export function AIBubble({
  text,
  className = "msg-bubble",
  bubbleSuffix,
}: AIBubbleProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkBreaks]}>{text}</ReactMarkdown>
      {bubbleSuffix}
    </div>
  );
}

// --- QuickReplyBar ---------------------------------------------------------

const DEFAULT_LABEL = "Выбери вариант или напиши своё";

export interface QuickReplyBarClassNames {
  container?: string;
  button?: string;
  buttonExit?: string;
  label?: string;
}

export interface QuickReplyBarProps {
  /** Массив replies из parseQuickReplies */
  replies: string[];
  /** Вызывается при клике на кнопку — обычно тот же handleSend */
  onClick: (text: string) => void;
  disabled?: boolean;
  classNames?: QuickReplyBarClassNames;
  /** Показать ли "Выбери вариант или напиши своё" над кнопками. По умолчанию — да */
  showLabel?: boolean;
}

export function QuickReplyBar({
  replies,
  onClick,
  disabled = false,
  classNames = {},
  showLabel = true,
}: QuickReplyBarProps) {
  if (replies.length === 0) return null;

  const containerClass = classNames.container ?? "quick-replies";
  const buttonClass = classNames.button ?? "quick-reply-btn";
  const labelClass = classNames.label ?? "quick-reply-label";

  return (
    <div className={containerClass}>
      {showLabel && <div className={labelClass}>{DEFAULT_LABEL}</div>}
      {replies.map((reply, i) => (
        <button
          key={i}
          className={buttonClass}
          onClick={() => onClick(reply)}
          disabled={disabled}
        >
          {reply}
        </button>
      ))}
    </div>
  );
}
