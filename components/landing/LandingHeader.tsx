import Link from "next/link";

interface LandingHeaderProps {
  ctaText: string;
  ctaHref: string;
  isLoggedIn: boolean;
  programSlug: string;
}

export function LandingHeader({ ctaText, ctaHref, isLoggedIn, programSlug }: LandingHeaderProps) {
  const loginHref = `/auth?redirect=${encodeURIComponent(`/program/${programSlug}/hub`)}`;

  return (
    <div className="landing-header">
      <Link href="/" className="header-logo">
        <div className="header-logo-icon">К</div>
        <div className="header-logo-text">
          Книжный <span>Спарринг</span>
        </div>
      </Link>
      <nav className="header-nav">
        <Link href="/#catalog" className="header-nav-link">Все программы</Link>
        <Link href="/tests" className="header-nav-link">Тесты</Link>
      </nav>
      <div className="header-right">
        {!isLoggedIn && (
          <Link href={loginHref} className="header-login">Войти</Link>
        )}
        <Link href={ctaHref} className="header-cta">
          {ctaText}
        </Link>
      </div>
    </div>
  );
}
