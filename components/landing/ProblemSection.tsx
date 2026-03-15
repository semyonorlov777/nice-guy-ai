interface ProblemSectionProps {
  label: string;
  title: string;
  lead: string;
  painCards: { title: string; text: string }[];
}

export function ProblemSection({ label, title, lead, painCards }: ProblemSectionProps) {
  return (
    <section className="problem">
      <div className="content-w">
        <p className="section-label">{label}</p>
        <h2 dangerouslySetInnerHTML={{ __html: title }} />
        <p className="problem-lead">{lead}</p>
        <div className="pain-grid">
          {painCards.map((card, i) => (
            <div key={i} className="pain-card">
              <h4>{card.title}</h4>
              <p>{card.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
