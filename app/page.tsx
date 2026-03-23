import type { Metadata } from "next";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase-server";
import { PublicHeader } from "@/components/PublicHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "AI-тренажёры по книгам",
  description: "Платформа AI-тренажёров для работы над собой",
};

interface LandingData {
  book?: { cover_url?: string; author_top?: string };
}

export default async function CatalogPage() {
  const serviceClient = createServiceClient();

  const { data: programs } = await serviceClient
    .from("programs")
    .select("id, slug, title, description, landing_data, features")
    .order("created_at");

  // Count exercises per program
  const exerciseCounts = new Map<string, number>();
  if (programs?.length) {
    for (const p of programs) {
      const { count } = await serviceClient
        .from("exercises")
        .select("id", { count: "exact", head: true })
        .eq("program_id", p.id);
      exerciseCounts.set(p.id, count || 0);
    }
  }

  return (
    <div className="catalog-page">
      <PublicHeader />
      <div className="catalog-container">
        <h1 className="catalog-title">Программы</h1>
        <p className="catalog-subtitle">
          Выбери книгу и начни работу над собой с AI-ассистентом
        </p>

        <div className="catalog-grid">
          {(programs || []).map((program) => {
            const landing = program.landing_data as LandingData | null;
            const coverUrl = landing?.book?.cover_url;
            const author = landing?.book?.author_top;
            const exerciseCount = exerciseCounts.get(program.id) || 0;

            return (
              <Link
                key={program.id}
                href={`/program/${program.slug}`}
                className="catalog-card"
              >
                {coverUrl && (
                  <div className="catalog-card-cover">
                    <img src={coverUrl} alt="" />
                  </div>
                )}
                <div className="catalog-card-body">
                  <h2 className="catalog-card-title">{program.title}</h2>
                  {author && (
                    <div className="catalog-card-author">{author}</div>
                  )}
                  {program.description && (
                    <p className="catalog-card-desc">{program.description}</p>
                  )}
                </div>
                <div className="catalog-card-footer">
                  <span className="catalog-card-badge">
                    {exerciseCount > 0
                      ? `${exerciseCount} упражнений`
                      : "Свободный чат"}
                  </span>
                  <span className="catalog-card-btn">Открыть</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
