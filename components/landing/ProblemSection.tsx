import { ScrollReveal } from "./ScrollReveal";
import { ComparisonGrid } from "./ComparisonGrid";

interface PainCard {
  icon: string;
  title: string;
  text: string;
}

interface ComparisonItem {
  emoji: string;
  title: string;
  text: string;
  tag: string;
  tag_color: string;
  highlight?: boolean;
}

interface ProblemSectionProps {
  label: string;
  title: string;
  lead: string;
  painCards: PainCard[];
  comparison: {
    title: string;
    items: ComparisonItem[];
  };
}

export function ProblemSection({ label, title, lead, painCards, comparison }: ProblemSectionProps) {
  return (
    <section className="problem">
      <ScrollReveal>
        <div className="section-label">{label}</div>
        <h2 dangerouslySetInnerHTML={{ __html: title }} />
        <p className="problem-lead">{lead}</p>
      </ScrollReveal>

      <ScrollReveal className="pain-grid">
        {painCards.map((card, i) => (
          <div key={i} className="pain-card">
            <div className="pain-card-icon">{card.icon}</div>
            <h4>{card.title}</h4>
            <p>{card.text}</p>
          </div>
        ))}
      </ScrollReveal>

      <ScrollReveal>
        <ComparisonGrid title={comparison.title} items={comparison.items} />
      </ScrollReveal>
    </section>
  );
}
