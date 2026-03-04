import Link from "next/link";

interface LandingHeaderProps {
  ctaText: string;
  ctaHref: string;
}

export function LandingHeader({ ctaText, ctaHref }: LandingHeaderProps) {
  return (
    <header className="public-header">
      <div className="logo">
        <div className="logo-icon">HC</div>
        <div className="logo-text">
          <span>He</span>Cлавный
        </div>
      </div>
      <Link href={ctaHref} className="header-cta">
        {ctaText}
      </Link>
    </header>
  );
}
