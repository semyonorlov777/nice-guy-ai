import Link from "next/link";
import { BookSwitcher } from "@/components/BookSwitcher";
import type { ProgramSwitcherItem } from "@/lib/queries/all-programs";

interface LandingHeaderProps {
  ctaText: string;
  ctaHref: string;
  isLoggedIn: boolean;
  programSlug: string;
  programs?: ProgramSwitcherItem[];
}

export function LandingHeader({
  ctaText,
  ctaHref,
  isLoggedIn,
  programSlug,
  programs = [],
}: LandingHeaderProps) {
  const loginHref = `/auth?redirect=${encodeURIComponent(`/program/${programSlug}/hub`)}`;
  const showSwitcher = programs.length > 1;

  return (
    <div className="landing-header">
      <div className="header-left">
        <Link href="/" className="header-logo">
          <div className="header-logo-icon">К</div>
          <div className="header-logo-text">
            Книжный <span>Спарринг</span>
          </div>
        </Link>
        {showSwitcher && (
          <BookSwitcher
            variant="desktop"
            currentSlug={programSlug}
            programs={programs}
            destination="landing"
          />
        )}
      </div>
      <nav className="header-nav">
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
