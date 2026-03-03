interface ComparisonItem {
  emoji: string;
  title: string;
  text: string;
  tag: string;
  tag_color: string;
  highlight?: boolean;
}

interface ComparisonGridProps {
  title: string;
  items: ComparisonItem[];
}

export function ComparisonGrid({ title, items }: ComparisonGridProps) {
  return (
    <div>
      <div className="compare-title">{title}</div>
      <div className="compare-grid">
        {items.map((item, i) => (
          <div key={i} className={`compare-card${item.highlight ? " highlight" : ""}`}>
            <div className="compare-card-emoji">{item.emoji}</div>
            <h5>{item.title}</h5>
            <p>{item.text}</p>
            <span
              className={`compare-tag ${
                item.tag_color === "green" ? "compare-tag-green" : "compare-tag-red"
              }`}
            >
              {item.tag}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
