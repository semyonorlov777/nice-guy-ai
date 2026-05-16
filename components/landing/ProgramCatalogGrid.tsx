import Link from "next/link";
import { createServiceClient } from "@/lib/supabase-server";

interface LandingDataMin {
  book?: { cover_url?: string; author_top?: string };
}

export async function ProgramCatalogGrid() {
  const serviceClient = createServiceClient();

  const { data: programs } = await serviceClient
    .from("programs")
    .select("id, slug, title, landing_data")
    .order("created_at");

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
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
