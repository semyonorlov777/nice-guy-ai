import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { TestCatalogGrid } from "@/components/landing/TestCatalogGrid";
import { SiteFooter } from "@/components/SiteFooter";
import { createClient } from "@/lib/supabase-server";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Тесты по книгам по психологии",
  description:
    "Бесплатные тесты по книгам Берна, Бредберри, Бакирова, Гулдингов и других. Узнай свои паттерны за 5 минут — без регистрации.",
};

export default async function TestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <div className="landing-v3">
      <LandingHeader
        ctaText={isLoggedIn ? "В кабинет" : "Пройти бесплатный тест"}
        ctaHref={
          isLoggedIn
            ? `/program/${DEFAULT_PROGRAM_SLUG}/hub`
            : `/program/${DEFAULT_PROGRAM_SLUG}/test`
        }
        isLoggedIn={isLoggedIn}
        programSlug={DEFAULT_PROGRAM_SLUG}
      />

      <main className="tests-page-main">
        <TestCatalogGrid />
      </main>

      <SiteFooter />
    </div>
  );
}
