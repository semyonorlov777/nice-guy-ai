interface SocialProofItem {
  icon: string;
  main: string;
  sub: string;
}

const icons: Record<string, React.ReactNode> = {
  book: (
    <svg viewBox="0 0 24 24">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M8 7h6" />
      <path d="M8 11h4" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
};

export function SocialProof({ items }: { items: SocialProofItem[] }) {
  return (
    <section className="proof">
      <div className="proof-inner">
        {items.map((item, i) => (
          <div key={i} className="proof-item">
            <div className="proof-icon">{icons[item.icon] || icons.star}</div>
            <div>
              <div className="proof-main">{item.main}</div>
              <div className="proof-sub">{item.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
