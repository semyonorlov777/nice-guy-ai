import Link from "next/link";

interface PlatformHeroProps {
  tag: string;
  title: string;
  subtitle: string;
  primaryCta: { text: string; href: string };
  secondaryCta: { text: string; href: string };
  hint: string;
}

export function PlatformHero({
  tag,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  hint,
}: PlatformHeroProps) {
  return (
    <section className="platform-hero">
      <div className="content-w">
        <div className="platform-hero-inner">
          <span className="hero-tag">{tag}</span>
          <h1 dangerouslySetInnerHTML={{ __html: title }} />
          <p className="platform-hero-sub">{subtitle}</p>
          <div className="platform-hero-cta-row">
            <Link href={primaryCta.href} className="hero-cta">
              {primaryCta.text}
            </Link>
            <Link href={secondaryCta.href} className="platform-hero-secondary">
              {secondaryCta.text}
            </Link>
          </div>
          <p className="hero-hint">{hint}</p>
        </div>
      </div>
    </section>
  );
}
