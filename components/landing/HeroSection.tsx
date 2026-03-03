import { ScrollReveal } from "./ScrollReveal";

interface BookData {
  author_top: string;
  title: string;
  subtitle: string;
  author_bottom: string;
}

interface HeroSectionProps {
  tag: string;
  title: string;
  subtitle: string;
  cta: string;
  hint: string;
  ctaHref: string;
  book: BookData;
}

export function HeroSection({ tag, title, subtitle, cta, hint, ctaHref, book }: HeroSectionProps) {
  return (
    <section className="hero">
      <ScrollReveal className="hero-content">
        <div className="hero-tag">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          {tag}
        </div>
        <h1 dangerouslySetInnerHTML={{ __html: title }} />
        <p className="hero-sub">{subtitle}</p>
        <div className="hero-cta-row">
          <a href={ctaHref} className="btn-primary">
            {cta}
          </a>
          <span className="hero-hint">{hint}</span>
        </div>
      </ScrollReveal>
      <ScrollReveal className="hero-book">
        <div className="book-wrapper">
          <div className="book-cover">
            <div className="book-author-top">{book.author_top}</div>
            <div className="book-line" />
            <div className="book-title">{book.title}</div>
            <div className="book-subtitle">{book.subtitle}</div>
            <div className="book-line-bottom" />
            <div className="book-author-bottom">{book.author_bottom}</div>
          </div>
          <div className="book-glow" />
        </div>
      </ScrollReveal>
    </section>
  );
}
