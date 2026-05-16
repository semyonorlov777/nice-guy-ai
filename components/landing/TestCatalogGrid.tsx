import Link from "next/link";
import { getAllTestConfigsWithProgram } from "@/lib/queries/test-config";

export async function TestCatalogGrid() {
  const tests = await getAllTestConfigsWithProgram();

  return (
    <section className="platform-catalog" id="catalog">
      <div className="wide-w">
        <p className="section-label">Тесты</p>
        <h2 className="platform-catalog-title">Бесплатные тесты по книгам психологии</h2>
        <p className="platform-catalog-sub">
          Каждый тест ведёт к личному разбору и тренажёру в Книжном Спарринге по книге автора. Без регистрации — просто выбери тему и пройди.
        </p>

        <div className="catalog-grid">
          {tests.map((t) => {
            const emoji = t.program.test_emoji || "📖";
            const bookLine = t.program.book_title
              ? t.program.author_top
                ? `по книге «${t.program.book_title}», ${t.program.author_top}`
                : `по книге «${t.program.book_title}»`
              : t.program.author_top;
            const questionsLabel = t.program.questions_label || `${t.total_questions} вопросов`;
            const timeLabel = t.program.time_label;
            const meta = [questionsLabel, timeLabel].filter(Boolean).join(" · ");

            const cardClass = `catalog-card test-catalog-card${t.is_active ? "" : " is-coming-soon"}`;

            const inner = (
              <>
                <div className="test-card-emoji" aria-hidden="true">{emoji}</div>
                <div className="catalog-card-body">
                  <h3 className="catalog-card-title">{t.title}</h3>
                  {bookLine && (
                    <div className="catalog-card-author test-card-book">{bookLine}</div>
                  )}
                  {t.description && (
                    <p className="catalog-card-desc">{t.description}</p>
                  )}
                </div>
                <div className="catalog-card-footer">
                  <span className="catalog-card-badge">{meta}</span>
                  <span className="catalog-card-btn">
                    {t.is_active ? "Пройти тест →" : "Скоро"}
                  </span>
                </div>
              </>
            );

            if (!t.is_active) {
              return (
                <div key={t.slug} className={cardClass}>
                  {inner}
                </div>
              );
            }

            return (
              <Link
                key={t.slug}
                href={`/program/${t.program.slug}/test/${t.slug}`}
                className={cardClass}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
