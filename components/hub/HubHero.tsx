interface HubHeroProps {
  title: string;
  author: string;
  coverUrl: string | null;
  exerciseCount?: number;
  compact?: boolean;
}

export function HubHero({ title, author, coverUrl, exerciseCount, compact }: HubHeroProps) {
  return (
    <div className={compact ? "hub-hero hub-hero-compact" : "hub-hero"}>
      <div className="hub-hero-cover">
        {coverUrl ? (
          <img src={coverUrl} alt={title} />
        ) : (
          <div className="hub-hero-cover-text">
            <span className="main">{title}</span>
            <span className="sub">{author}</span>
          </div>
        )}
      </div>
      {!compact && (
        <div className="hub-hero-info">
          <h1>{title}</h1>
          <div className="hub-hero-meta">
            {author}
            {exerciseCount ? ` · ${exerciseCount} упражнений` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
