interface HubMobileHeaderProps {
  title: string;
  subtitle: string;
  coverUrl: string | null;
  balance?: number;
}

export function HubMobileHeader({ title, subtitle, coverUrl, balance }: HubMobileHeaderProps) {
  return (
    <div className="hub-header">
      <div className="hub-header-book">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="hub-header-book-img" />
        ) : (
          <div className="hub-header-book-title">{title}</div>
        )}
      </div>
      <div className="hub-header-text">
        <div className="hub-header-title">{title}</div>
        <div className="hub-header-sub">{subtitle}</div>
      </div>
      {balance !== undefined && (
        <div className="hub-header-balance">⚡ {balance}</div>
      )}
    </div>
  );
}
