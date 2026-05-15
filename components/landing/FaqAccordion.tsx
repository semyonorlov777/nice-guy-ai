interface FaqAccordionProps {
  label: string;
  title: string;
  items: { question: string; answer: string }[];
}

export function FaqAccordion({ label, title, items }: FaqAccordionProps) {
  return (
    <section className="faq-section">
      <div className="content-w">
        <p className="section-label">{label}</p>
        <h2 className="faq-title" dangerouslySetInnerHTML={{ __html: title }} />
        <div className="faq-list">
          {items.map((item, i) => (
            <details key={i} className="faq-item">
              <summary className="faq-question">
                <span>{item.question}</span>
                <svg
                  className="faq-arrow"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </summary>
              <div className="faq-answer">{item.answer}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
