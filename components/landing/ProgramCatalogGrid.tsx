import Link from "next/link";
import { createServiceClient } from "@/lib/supabase-server";

interface LandingDataMin {
  book?: { cover_url?: string; author_top?: string };
}

export async function ProgramCatalogGrid() {
  const serviceClient = createServiceClient();

  const { data: programs } = await serviceClient
    .from("programs")
    .select("id, slug, title, description, landing_data, features")
    .order("created_at");

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
    <section className="platform-catalog" id="catalog">
      <div className="wide-w">
        <p className="section-label">Каталог</p>
        <h2 className="platform-catalog-title">Программы по книгам</h2>
        <p className="platform-catalog-sub">
          Каждая программа — это книга, тест, чат с ИИ-автором и упражнения. Выберите ту, которая откликается.
        </p>

        <div className="catalog-grid">
          {(programs || []).map((program) => {
            const landing = program.landing_data as LandingDataMin | null;
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
                  <h3 className="catalog-card-title">{program.title}</h3>
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
                  <span className="catalog-card-btn">Открыть →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
