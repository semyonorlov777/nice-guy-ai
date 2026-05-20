"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

// Минимальная локальная копия AIBubble из основного проекта.
// QuickReplyBar и normalizeQuickReplies здесь не нужны — в funnel-разборе нет «ёлочек».

export interface AIBubbleProps {
  text: string;
  className?: string;
}

export function AIBubble({ text, className = "msg-bubble" }: AIBubbleProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkBreaks]}>{text}</ReactMarkdown>
    </div>
  );
}
