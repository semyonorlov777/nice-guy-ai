import { ScrollReveal } from "./ScrollReveal";

interface Feature {
  icon: string;
  title: string;
  text: string;
}

interface SolutionSectionProps {
  label: string;
  title: string;
  subtitle: string;
  features: Feature[];
  positioning: string;
}

export function SolutionSection({ label, title, subtitle, features, positioning }: SolutionSectionProps) {
  return (
    <section className="solution">
      <div className="solution-inner">
        <ScrollReveal>
          <div className="section-label" style={{ textAlign: "center" }}>{label}</div>
          <h2 dangerouslySetInnerHTML={{ __html: title }} />
          <p className="solution-sub">{subtitle}</p>
        </ScrollReveal>

        <ScrollReveal className="features-grid">
          {features.map((feature, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h4>{feature.title}</h4>
              <p>{feature.text}</p>
            </div>
          ))}
        </ScrollReveal>

        <ScrollReveal className="positioning">
          <p dangerouslySetInnerHTML={{ __html: positioning }} />
        </ScrollReveal>
      </div>
    </section>
  );
}
