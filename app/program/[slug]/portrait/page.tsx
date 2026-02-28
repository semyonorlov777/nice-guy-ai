import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import type { PortraitContent } from "@/types/portrait";
import { EMPTY_PORTRAIT } from "@/types/portrait";

const TOTAL_EXERCISES = 46;

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

  const { data: program } = await supabase
    .from("programs")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!program) redirect("/");

  const { data: portrait } = await supabase
    .from("portraits")
    .select("content")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .maybeSingle();

  const content = (portrait?.content || EMPTY_PORTRAIT) as PortraitContent;
  const isEmpty = content.exercises_completed === 0;
  const progressPct = Math.round((content.exercises_completed / TOTAL_EXERCISES) * 100);

  const hasPatterns = content.nice_guy_patterns.patterns.length > 0;
  const hasInsights = content.key_insights.length > 0;
  const hasFamily = content.family_system.summary.length > 0;
  const hasDefense = content.defense_mechanisms.mechanisms.length > 0;
  const hasGrowth = content.growth_zones.observations.length > 0;
  const isPartial = !isEmpty && content.exercises_completed <= 3;
  const hasAnySections = hasPatterns || hasInsights || hasFamily || hasDefense || hasGrowth;

  return (
    <div className="content-scroll">
      <div className="portrait-container">
        {/* Header */}
        <div className="portrait-header">
          <h1 className="portrait-title">Портрет</h1>
          <div className="portrait-progress-label">
            Пройдено упражнений: {content.exercises_completed} / {TOTAL_EXERCISES}
          </div>
          <div className="portrait-progress-track">
            <div
              className="portrait-progress-bar"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {isEmpty ? (
          /* Empty state */
          <div className="portrait-empty">
            <div className="portrait-empty-icon">&#x25CE;</div>
            <div className="portrait-empty-text">
              Твой портрет формируется по мере прохождения упражнений.
              Каждый разговор помогает AI лучше понять твои паттерны и зоны роста.
            </div>
            <Link href={`/program/${slug}/exercises`} className="portrait-empty-btn">
              Перейти к упражнениям
            </Link>
          </div>
        ) : (
          <>
            {/* Patterns */}
            {hasPatterns && (
              <div className="portrait-section">
                <h2 className="portrait-section-title">Паттерны</h2>
                <div className="portrait-patterns">
                  {content.nice_guy_patterns.patterns.map((p, i) => (
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
                      <div className="portrait-card-context">{p.context}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Insights */}
            {hasInsights && (
              <div className="portrait-section">
                <h2 className="portrait-section-title">Инсайты</h2>
                <div className="portrait-insights">
                  {content.key_insights.map((ins, i) => (
                    <div key={i} className="portrait-insight">
                      <span className="portrait-insight-dot" />
                      <div>
                        <div className="portrait-insight-text">{ins.text}</div>
                        <div className="portrait-insight-meta">
                          {ins.source_title} &middot; {ins.added_at}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Family system */}
            {hasFamily && (
              <div className="portrait-section">
                <h2 className="portrait-section-title">Семейная система</h2>
                <p className="portrait-text">{content.family_system.summary}</p>
              </div>
            )}

            {/* Defense mechanisms */}
            {hasDefense && (
              <div className="portrait-section">
                <h2 className="portrait-section-title">Защитные механизмы</h2>
                <div className="portrait-mechanisms">
                  {content.defense_mechanisms.mechanisms.map((m, i) => (
                    <div key={i} className="portrait-mechanism">
                      <div className="portrait-mechanism-name">{m.name}</div>
                      <div className="portrait-mechanism-example">{m.example}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Growth zones */}
            {hasGrowth && (
              <div className="portrait-section">
                <h2 className="portrait-section-title">Зоны роста</h2>
                <div className="portrait-growth">
                  {content.growth_zones.observations.map((obs, i) => (
                    <div key={i} className="portrait-observation">
                      <span className="portrait-observation-check">&#x2713;</span>
                      <div>
                        <div className="portrait-observation-text">{obs.text}</div>
                        <div className="portrait-observation-meta">{obs.added_at}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Partial state hint */}
            {isPartial && (
              <div className="portrait-hint">
                Остальные секции появятся по мере прохождения упражнений
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
