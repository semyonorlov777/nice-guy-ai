import Link from "next/link";
import { createServiceClient } from "@/lib/supabase-server";
import { getProgramsForCatalog } from "@/lib/queries/programs-catalog";
import { ProgramCard } from "./ProgramCard";

interface ProgramCatalogPreviewProps {
  limit?: number;
}

export async function ProgramCatalogPreview({
  limit = 3,
}: ProgramCatalogPreviewProps) {
  const supabase = createServiceClient();
  const all = await getProgramsForCatalog(supabase);
  const programs = all.slice(0, limit);

  if (programs.length === 0) return null;

  return (
    <section className="platform-catalog" id="catalog">
      <div className="wide-w">
        <p className="section-label">Каталог</p>
        <h2 className="platform-catalog-title">Программы по книгам</h2>
        <p className="platform-catalog-sub">
          Каждая программа — это книга, тест, чат с автором и упражнения. Ниже —
          несколько на старт, остальные — в полном каталоге.
        </p>

        <div className="catalog-grid">
          {programs.map((program) => (
            <ProgramCard key={program.slug} program={program} />
          ))}
        </div>

        <div className="catalog-preview-more">
          <Link href="/programs" className="catalog-preview-more-link">
            Смотреть все программы →
          </Link>
        </div>
      </div>
    </section>
  );
}
