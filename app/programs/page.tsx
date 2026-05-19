import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ProgramCard } from "@/components/programs/ProgramCard";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { getProgramsForCatalog } from "@/lib/queries/programs-catalog";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Все программы — Книжный Спарринг",
  description:
    "Полный каталог онлайн-тренажёров по книгам по психологии и навыкам. Часть программ бесплатные, часть — с разовой оплатой.",
};

export default async function ProgramsCatalogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  const service = createServiceClient();
  const programs = await getProgramsForCatalog(service);

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

      <section className="program-catalog-page">
        <div className="wide-w">
          <p className="section-label">Каталог</p>
          <h1 className="program-catalog-page-title">
            Все тренажёры по книгам
          </h1>
          <p className="program-catalog-page-sub">
            Каждая программа — это книга, разбор, чат и упражнения. Часть
            программ бесплатные, часть — с разовой оплатой.
          </p>

          <div className="catalog-grid">
            {programs.map((program) => (
              <ProgramCard key={program.slug} program={program} />
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
