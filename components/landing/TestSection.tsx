interface TestSectionProps {
  emoji: string;
  title: string;
  description: string;
  time_label: string;
  questions_label: string;
  cta_text: string;
  cta_href: string;
}

export function TestSection({ emoji, title, description, time_label, questions_label, cta_text, cta_href }: TestSectionProps) {
  return (
    <section className="test">
      <div className="test-inner">
        <span className="test-emoji">{emoji}</span>
        <h3>{title}</h3>
        <p className="test-desc">{description}</p>
        <div className="test-meta">
          <span>{time_label}</span>
          <span className="test-meta-dot"></span>
          <span>{questions_label}</span>
        </div>
        <a href={cta_href} className="test-cta" target="_blank" rel="noopener noreferrer">
          {cta_text}
        </a>
      </div>
    </section>
  );
}
