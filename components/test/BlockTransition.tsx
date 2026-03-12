interface BlockTransitionProps {
  blockIndex: number;
  completedScaleName: string;
  nextScaleName: string;
  insight: string;
  onContinue: () => void;
}

export function BlockTransition({
  blockIndex,
  completedScaleName,
  nextScaleName,
  insight,
  onContinue,
}: BlockTransitionProps) {
  return (
    <div className="tc-screen tc-block-screen">
      <div className="tc-block-check">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h2>Блок {blockIndex + 1} пройден</h2>

      <p className="tc-block-detail">
        «{completedScaleName}» — завершён.
        <br />
        Следующий: «{nextScaleName}»
      </p>

      <div className="tc-block-insight">
        <div className="tc-block-insight-avatar">НС</div>
        <div
          className="tc-block-insight-text"
          dangerouslySetInnerHTML={{ __html: insight }}
        />
      </div>

      <div className="tc-block-mini-dots">
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className={`tc-bm-dot${i <= blockIndex ? " done" : i === blockIndex + 1 ? " next" : ""}`}
          />
        ))}
      </div>

      <button className="tc-btn-outline" onClick={onContinue}>
        Продолжить
      </button>
    </div>
  );
}
