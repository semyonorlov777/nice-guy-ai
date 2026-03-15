interface PersonasSectionProps {
  label: string;
  title: string;
  items: { headline: string; body: string }[];
}

export function PersonasSection({ label, title, items }: PersonasSectionProps) {
  return (
    <section className="personas">
      <div className="content-w">
        <p className="section-label">{label}</p>
        <h2>{title}</h2>
        <div className="personas-grid">
          {items.map((item, i) => (
            <div key={i} className="persona-card">
              <div className="persona-qm">&ldquo;</div>
              <div className="persona-headline">{item.headline}</div>
              <div className="persona-body">{item.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
