import { ScrollReveal } from "./ScrollReveal";

interface ProofItem {
  icon: string;
  number: string;
  label: string;
}

interface SocialProofProps {
  items: ProofItem[];
}

const icons: Record<string, React.ReactNode> = {
  users: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  book: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  ),
  clock: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
};

export function SocialProof({ items }: SocialProofProps) {
  return (
    <ScrollReveal as="section" className="proof">
      <div className="proof-inner">
        {items.map((item, i) => (
          <div key={i} className="proof-item">
            <div className="proof-icon">{icons[item.icon] ?? null}</div>
            <div>
              <div className="proof-num">{item.number}</div>
              <div className="proof-label">{item.label}</div>
            </div>
          </div>
        ))}
      </div>
    </ScrollReveal>
  );
}
