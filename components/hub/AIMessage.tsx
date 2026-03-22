interface AIMessageProps {
  text: string;
}

export function AIMessage({ text }: AIMessageProps) {
  return (
    <div className="hub-ai-msg fade-in">
      <div className="hub-ai-avatar" />
      <div
        className="hub-ai-text"
        dangerouslySetInnerHTML={{ __html: text }}
      />
    </div>
  );
}
