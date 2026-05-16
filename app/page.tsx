import type { Metadata } from "next";
import Link from "next/link";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { PlatformHero } from "@/components/landing/PlatformHero";
import { SocialProof } from "@/components/landing/SocialProof";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { ProgramCatalogGrid } from "@/components/landing/ProgramCatalogGrid";
import { PersonasSection } from "@/components/landing/PersonasSection";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { SiteFooter } from "@/components/SiteFooter";
import { createClient } from "@/lib/supabase-server";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";
import { platformLanding } from "@/lib/platform-landing";

export const metadata: Metadata = {
  title: "Книжный Спарринг — тренажёры по книгам по психологии",
  description:
    "От прочитал до применил. Каждая книга — тренажёр с упражнениями, чатом с автором (ИИ) и портретом ваших паттернов.",
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <div className="landing-v3">
      <LandingHeader
        ctaText={isLoggedIn ? "В кабинет" : "Пройти тест"}
        ctaHref={
          isLoggedIn ? `/program/${DEFAULT_PROGRAM_SLUG}/hub` : "/tests"
        }
        isLoggedIn={isLoggedIn}
        programSlug={DEFAULT_PROGRAM_SLUG}
      />

      <PlatformHero
        tag={platformLanding.hero.tag}
        title={platformLanding.hero.title}
        subtitle={platformLanding.hero.subtitle}
        primaryCta={platformLanding.hero.primary_cta}
        secondaryCta={platformLanding.hero.secondary_cta}
        hint={platformLanding.hero.hint}
      />

      <SocialProof items={platformLanding.social_proof} />

      <ComparisonSection
        label={platformLanding.comparison.label}
        title={platformLanding.comparison.title}
        subtitle={platformLanding.comparison.subtitle}
        columns={platformLanding.comparison.columns}
        rows={platformLanding.comparison.rows}
        conclusion={platformLanding.comparison.conclusion}
      />

      <HowItWorksSection
        label={platformLanding.how_it_works.label}
        title={platformLanding.how_it_works.title}
        steps={platformLanding.how_it_works.steps}
        summary_text={platformLanding.how_it_works.summary_text}
      />

      <ProgramCatalogGrid />

      <PersonasSection
        label={platformLanding.personas.label}
        title={platformLanding.personas.title}
        lead={platformLanding.personas.lead}
        items={platformLanding.personas.items}
      />

      <FaqAccordion
        label="Частые вопросы"
        title="<em>Что обычно</em> спрашивают"
        items={platformLanding.faq}
      />

      <section className="final-cta">
        <div className="content-w">
          <div className="final-cta-card">
            <h2 className="final-cta-title">{platformLanding.final_cta.title}</h2>
            <p className="final-cta-subtitle">{platformLanding.final_cta.subtitle}</p>
            <div className="final-cta-buttons">
              <Link
                href={platformLanding.final_cta.primary.href}
                className="hero-cta"
              >
                {platformLanding.final_cta.primary.text}
              </Link>
              <Link
                href={platformLanding.final_cta.secondary.href}
                className="platform-hero-secondary"
              >
                {platformLanding.final_cta.secondary.text}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
