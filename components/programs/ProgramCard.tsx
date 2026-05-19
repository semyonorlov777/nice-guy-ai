import Link from "next/link";

export interface ProgramCardData {
  slug: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  description: string | null;
  isPaid: boolean;
  priceRub: number | null;
  priceLabel: string | null;
}

interface ProgramCardProps {
  program: ProgramCardData;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

export function ProgramCard({ program }: ProgramCardProps) {
  const badgeText = program.isPaid
    ? program.priceLabel ?? (program.priceRub ? `${program.priceRub} ₽` : "Платно")
    : "Бесплатно";

  const ctaText = program.isPaid ? "Купить →" : "Открыть →";

  return (
    <Link href={`/program/${program.slug}`} className="catalog-card">
      {program.coverUrl && (
        <div className="catalog-card-cover">
          <img src={program.coverUrl} alt="" />
        </div>
      )}
      <div className="catalog-card-body">
        <h3 className="catalog-card-title">{program.title}</h3>
        {program.author && (
          <div className="catalog-card-author">{program.author}</div>
        )}
        {program.description && (
          <p className="catalog-card-desc">{stripHtml(program.description)}</p>
        )}
      </div>
      <div className="catalog-card-footer">
        <span
          className={`catalog-card-badge ${
            program.isPaid ? "is-paid" : "is-free"
          }`}
        >
          {badgeText}
        </span>
        <span className="catalog-card-btn">{ctaText}</span>
      </div>
    </Link>
  );
}
