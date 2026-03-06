import Link from "next/link";

interface LandingHeaderProps {
  ctaText: string;
  ctaHref: string;
}

export function LandingHeader({ ctaText, ctaHref }: LandingHeaderProps) {
  return (
    <header className="public-header">
      <Link href="/" className="logo">
        <div className="logo-icon">HC</div>
        <div className="logo-text">
          <span>He</span>Cлавный
        </div>
      </Link>
      <Link href={ctaHref} className="header-cta">
        {ctaText}
      </Link>
    </header>
  );
}
