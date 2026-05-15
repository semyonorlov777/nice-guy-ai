"use client";

import Link from "next/link";

interface HeroSectionProps {
  tag: string;
  title: string;
  subtitle: string;
  cta: string;
  hint: string;
  ctaHref: string;
  book: {
    cover_url: string;
    alt: string;
  };
  loggedInHubHref?: string;
}

export function HeroSection({ tag, title, subtitle, cta, hint, ctaHref, book, loggedInHubHref }: HeroSectionProps) {
  return (
    <section className="hero">
      <div className="hero-grid">
        <div className="hero-content">
          <div className="hero-tag">{tag}</div>
          <h1 dangerouslySetInnerHTML={{ __html: title }} />
          <p className="hero-sub">{subtitle}</p>
          {loggedInHubHref ? (
            <div className="hero-logged-banner">
              <span className="hero-logged-text">
                Вы уже занимаетесь по этой программе
              </span>
              <Link href={loggedInHubHref} className="hero-logged-link">
                Продолжить в кабинете →
              </Link>
            </div>
          ) : null}
          <div className="hero-cta-row">
            <a href={ctaHref} className="hero-cta">
              {cta}
            </a>
            <span className="hero-hint">{hint}</span>
          </div>
        </div>
        <div className="hero-book-wrap">
          <a
            href="#chat-block"
            className="hero-book"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("chat-block")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={book.cover_url} alt={book.alt} />
          </a>
        </div>
      </div>
    </section>
  );
}
