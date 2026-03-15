import Link from "next/link";

interface LandingHeaderProps {
  ctaText: string;
  ctaHref: string;
}

export function LandingHeader({ ctaText, ctaHref }: LandingHeaderProps) {
  return (
    <div className="landing-header">
      <Link href="/" className="header-logo">
        <div className="header-logo-icon">Н</div>
        <div className="header-logo-text">
          НеСлавный <span>AI</span>
        </div>
      </Link>
      <Link href={ctaHref} className="header-cta">
        {ctaText}
      </Link>
    </div>
  );
}
