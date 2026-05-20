import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import type { PortraitContent, PortraitSection } from "@/types/portrait";
import { isLegacyPortrait, convertLegacyPortrait } from "@/types/portrait";
import { requireProgramFeature } from "@/lib/queries/program";
import { getFacts, type IdentityFacts } from "@/lib/personalization";

export default async function PortraitPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const program = await requireProgramFeature(supabase, slug, "portrait");

  // Параллельно: COUNT exercises + portrait load + анкета пользователя.
  const [exercisesCountRes, portraitRes, anketaFacts] = await Promise.all([
    supabase
      .from("exercises")
      .select("id", { count: "exact", head: true })
      .eq("program_id", program.id),
    supabase
      .from("portraits")
      .select("content")
      .eq("user_id", user.id)
      .eq("program_id", program.id)
      .maybeSingle(),
    getFacts(supabase, user.id),
  ]);

  const totalExercises = exercisesCountRes.count;
  const portrait = portraitRes.data;
  const hasAnketa = Object.keys(anketaFacts).length > 0;

  const raw = portrait?.content;
  let content: PortraitContent | null = null;

  if (isLegacyPortrait(raw)) {
    content = convertLegacyPortrait(raw);
  } else if (raw && typeof raw === "object" && "sections" in raw) {
    content = raw as PortraitContent;
  }

  const isEmpty = !content || content.sections.length === 0;
  const exercisesCompleted = content?.exercises_completed || 0;
  const total = totalExercises || 0;
  const progressPct = total > 0 ? Math.round((exercisesCompleted / total) * 100) : 0;

  return (
    <div className="content-scroll">
      <div className="portrait-container">
        {/* Header */}
        <div className="portrait-header">
          <h1 className="portrait-title">Портрет</h1>
          {exercisesCompleted > 0 && total > 0 && (
            <>
              <div className="portrait-progress-label">
                Пройдено упражнений: {exercisesCompleted} / {total}
              </div>
              <div className="portrait-progress-track">
                <div
                  className="portrait-progress-bar"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </>
          )}
        </div>

        {hasAnketa && <AnketaSection facts={anketaFacts} />}

        {isEmpty ? (
          /* Empty state */
          <div className="portrait-empty">
            <div className="portrait-empty-icon">&#x25CE;</div>
            <div className="portrait-empty-text">
              {hasAnketa
                ? "AI-портрет начнёт собираться после нескольких упражнений или свободного чата. Пока что я знаю про тебя только из анкеты — это видно выше."
                : "Портрет пока пуст. Пройди несколько упражнений, и Система начнёт собирать твой психологический профиль."}
            </div>
            <Link href={`/program/${slug}/exercises`} className="portrait-empty-btn">
              Перейти к упражнениям
            </Link>
          </div>
        ) : (
          <>
            {content!.sections.map((section) => (
              <SectionRenderer key={section.id} section={section} />
            ))}

            {content!.sections.length < 5 && (
              <div className="portrait-hint">
                Остальные секции появятся по мере общения с Системой
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AnketaSection({ facts }: { facts: IdentityFacts }) {
  const items: Array<{ label: string; value: string }> = [];
  if (facts.context_intent)
    items.push({ label: "Что привело", value: facts.context_intent });
  if (facts.problem)
    items.push({ label: "Что не так", value: facts.problem });
  if (facts.implication)
    items.push({ label: "Если не менять", value: facts.implication });
  if (facts.need_payoff)
    items.push({ label: "Как пойму, что сработало", value: facts.need_payoff });

  return (
    <div className="portrait-anketa">
      <div className="portrait-anketa-header">
        <h2 className="portrait-anketa-title">Твой запрос</h2>
        <span className="portrait-anketa-tag">из анкеты</span>
      </div>
      <div className="portrait-anketa-list">
        {items.map((it, i) => (
          <div key={i} className="portrait-anketa-item">
            <div className="portrait-anketa-label">{it.label}</div>
            <div className="portrait-anketa-value">{it.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionRenderer({ section }: { section: PortraitSection }) {
  switch (section.type) {
    case "patterns":
      return (
        <div className="portrait-section">
          <h2 className="portrait-section-title">
            {section.icon && <span>{section.icon} </span>}
            {section.title}
          </h2>
          <div className="portrait-patterns">
            {section.data.items.map((p, i) => (
              <div key={i} className="portrait-card">
                <div className="portrait-card-head">
                  <span className="portrait-card-name">{p.name}</span>
                  <span className={`portrait-badge portrait-badge--${p.intensity}`}>
                    {p.intensity === "high"
                      ? "выражен сильно"
                      : p.intensity === "medium"
                        ? "выражен"
                        : "замечен"}
                  </span>
                </div>
                <div className="portrait-card-context">{p.description}</div>
              </div>
            ))}
          </div>
        </div>
      );

    case "insights":
      return (
        <div className="portrait-section">
          <h2 className="portrait-section-title">
            {section.icon && <span>{section.icon} </span>}
            {section.title}
          </h2>
          <div className="portrait-insights">
            {section.data.items.map((ins, i) => (
              <div key={i} className="portrait-insight">
                <span className="portrait-insight-dot" />
                <div>
                  <div className="portrait-insight-text">{ins.text}</div>
                  {(ins.source || ins.date) && (
                    <div className="portrait-insight-meta">
                      {[ins.source, ins.date].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "text":
      return (
        <div className="portrait-section">
          <h2 className="portrait-section-title">
            {section.icon && <span>{section.icon} </span>}
            {section.title}
          </h2>
          <p className="portrait-text">{section.data.text}</p>
        </div>
      );

    case "tags":
      return (
        <div className="portrait-section">
          <h2 className="portrait-section-title">
            {section.icon && <span>{section.icon} </span>}
            {section.title}
          </h2>
          <div className="portrait-tags">
            {section.data.items.map((tag, i) => (
              <span key={i} className="portrait-tag">{tag}</span>
            ))}
          </div>
        </div>
      );
  }
}
