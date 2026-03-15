interface OutcomesSectionProps {
  label: string;
  title: string;
  subtitle: string;
  items: { icon: string; title: string; description: string }[];
}

export function OutcomesSection({ label, title, subtitle, items }: OutcomesSectionProps) {
  return (
    <section className="outcomes">
      <div className="content-w">
        <p className="section-label">{label}</p>
        <h2 dangerouslySetInnerHTML={{ __html: title }} />
        <p className="outcomes-sub">{subtitle}</p>
        <div className="outcomes-grid">
          {items.map((item, i) => (
            <div key={i} className="outcome-card">
              <div className="outcome-icon">{item.icon}</div>
              <div className="outcome-title">{item.title}</div>
              <div className="outcome-desc">{item.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
