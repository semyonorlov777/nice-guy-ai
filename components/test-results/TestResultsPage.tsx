"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { ISSP_SCALES, ISSP_SCALE_ORDER } from "@/lib/issp-config";
import type { ScaleResult } from "@/lib/issp-scoring";
import type { ISSPInterpretation } from "@/lib/issp-interpretation";
import { useCountUp } from "./useCountUp";
import { useScrollReveal } from "./useScrollReveal";
import { ShareButtons } from "./ShareButtons";
import { RadarChart } from "./RadarChart";
import { THEME_ICON_MAP } from "@/components/icons/hub-icons";

// ── Types ──

export interface TestResultsProps {
  id: string;
  totalScore: number;
  scoresByScale: Record<string, ScaleResult>;
  topScales: string[];
  recommendedExercises: number[];
  interpretation: ISSPInterpretation | null;
  isOwner: boolean;
  createdAt: string;
  programSlug: string;
}

// ── Constants ──


function getLevelClass(score: number): string {
  if (score <= 30) return "low";
  if (score <= 60) return "moderate";
  return "high";
}

function getLevelLabel(score: number): string {
  if (score <= 25) return "Низкий уровень";
  if (score <= 50) return "Умеренный уровень";
  if (score <= 75) return "Выраженный уровень";
  return "Высокий уровень";
}

function colorClass(pct: number): string {
  if (pct >= 60) return "red";
  if (pct >= 40) return "yellow";
  return "green";
}

// ── Sub-components ──

function Divider() {
  return <div className="tr-divider" />;
}

function HeroScore({
  totalScore,
  levelLabel,
  resultId,
}: {
  totalScore: number;
  levelLabel: string;
  resultId: string;
}) {
  const displayScore = useCountUp(totalScore);
  const levelClass = getLevelClass(totalScore);

  return (
    <div className="tr-hero">
      <div className="tr-hero-label">Индекс синдрома славного парня</div>
      <div className="tr-hero-score">
        <span>{displayScore}</span>
        <span className="tr-denominator">/100</span>
      </div>
      <div className={`tr-hero-level ${levelClass}`}>{levelLabel}</div>
      <div className="tr-hero-subtitle">
        Тест по книге &laquo;Хватит быть славным парнем&raquo; &bull; 35 вопросов &bull; 7 шкал
      </div>
      <ShareButtons resultId={resultId} totalScore={totalScore} />
    </div>
  );
}

function AIInterpretation({ text }: { text: string }) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={`tr-interpretation tr-section-anim${isVisible ? " visible" : ""}`}
    >
      <div className="tr-interp-label">Ваш результат</div>
      <div className="tr-interp-block">
        <p dangerouslySetInnerHTML={{ __html: text }} />
      </div>
    </div>
  );
}

function ScaleCards({
  scoresByScale,
  topScales,
  interpretation,
}: {
  scoresByScale: Record<string, ScaleResult>;
  topScales: string[];
  interpretation: ISSPInterpretation | null;
}) {
  const { ref, isVisible } = useScrollReveal();
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (isVisible && !animated) {
      const timer = setTimeout(() => setAnimated(true), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible, animated]);

  // Sort by pct desc
  const sorted = [...ISSP_SCALE_ORDER].sort(
    (a, b) => (scoresByScale[b]?.pct ?? 0) - (scoresByScale[a]?.pct ?? 0)
  );

  // Build interpretation map
  const interpMap: Record<string, string> = {};
  if (interpretation?.scales) {
    for (const s of interpretation.scales) {
      interpMap[s.scale_key] = s.interpretation;
    }
  }

  return (
    <div
      ref={ref}
      className={`tr-scales-section tr-section-anim${isVisible ? " visible" : ""}`}
    >
      <div className="tr-section-label">Подробнее</div>
      <div className="tr-section-title">Что стоит за каждой</div>

      <div className="tr-cards-grid">
        {sorted.map((key, i) => {
          const s = scoresByScale[key];
          if (!s) return null;
          const color = colorClass(s.pct);
          const isTop = i < 3 && s.pct >= 50;
          const name = ISSP_SCALES[key]?.name ?? key;
          const ThemeIcon = THEME_ICON_MAP[key];

          return (
            <div key={key} className={`tr-scale-card${isTop ? " top-zone" : ""}`}>
              <div className="tr-scale-card-header">
                <span className="tr-scale-card-icon">{ThemeIcon ? <ThemeIcon size={20} /> : null}</span>
                <div className={`tr-scale-card-name color-${color}`}>{name}</div>
              </div>
              <div className={`tr-scale-card-score color-${color}`}>{s.pct}%</div>
              <div className="tr-scale-card-bar">
                <div
                  className={`tr-scale-card-fill fill-${color}`}
                  style={{ width: animated ? `${s.pct}%` : "0%" }}
                />
              </div>
              {interpMap[key] && (
                <div className="tr-scale-card-text">{interpMap[key]}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopZones({
  topZones,
  scoresByScale,
  programSlug,
}: {
  topZones: Array<{ scale_key: string; action_text: string }>;
  scoresByScale: Record<string, ScaleResult>;
  programSlug: string;
}) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={`tr-zones-section tr-section-anim${isVisible ? " visible" : ""}`}
    >
      <div className="tr-section-label">Приоритеты</div>
      <div className="tr-section-title">С чего начать</div>

      <div className="tr-zones-block">
        {topZones.map((zone, i) => {
          const name = ISSP_SCALES[zone.scale_key]?.name ?? zone.scale_key;
          const pct = scoresByScale[zone.scale_key]?.pct ?? 0;
          const exercises = ISSP_SCALES[zone.scale_key]?.exercises ?? [];

          return (
            <div key={zone.scale_key} className="tr-zone-item">
              <div className="tr-zone-number">{i + 1}</div>
              <div className="tr-zone-content">
                <h4>
                  {name} — {pct}%
                </h4>
                <p>{zone.action_text}</p>
                {exercises.length > 0 && (
                  <div className="tr-zone-exercises">
                    {exercises.map((exId) => (
                      <Link
                        key={exId}
                        href={`/program/${programSlug}/exercise/${exId}`}
                        className="tr-zone-exercise-tag"
                      >
                        Упр. {exId}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CTASection({
  isOwner,
  programSlug,
}: {
  isOwner: boolean;
  programSlug: string;
}) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={`tr-cta-section tr-section-anim${isVisible ? " visible" : ""}`}
    >
      {isOwner ? (
        <>
          <Link href={`/program/${programSlug}/exercises`} className="tr-cta-primary">
            Начать путь к изменениям
          </Link>
          <div className="tr-cta-sub">
            46 упражнений по книге &laquo;Хватит быть славным парнем&raquo;
          </div>
        </>
      ) : (
        <div className="tr-cta-guest">
          <div className="tr-cta-guest-title">А какой твой профиль?</div>
          <Link href={`/program/${programSlug}/test/issp`} className="tr-cta-primary">
            Пройти тест бесплатно
          </Link>
        </div>
      )}
    </div>
  );
}

function ResultsFooter() {
  return (
    <div className="tr-footer">
      <div className="tr-footer-disclaimer">
        Этот тест — инструмент самопознания, а не клинический диагноз.
        Результаты помогают увидеть привычные паттерны поведения и наметить
        направления для роста.
      </div>
      <div className="tr-footer-brand">
        <Link href="/">Nice Guy AI</Link>
      </div>
    </div>
  );
}

// ── Main component ──

const POLL_INTERVAL = 5000;
const POLL_TIMEOUT = 90000;

export function TestResultsPage(props: TestResultsProps) {
  const {
    id,
    totalScore,
    scoresByScale,
    topScales,
    interpretation: initialInterpretation,
    isOwner,
    programSlug,
  } = props;

  const [interpretation, setInterpretation] = useState(initialInterpretation);
  const [pollTimedOut, setPollTimedOut] = useState(false);

  useEffect(() => {
    if (interpretation) return;

    let stopped = false;
    const startTime = Date.now();

    const poll = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/test/results/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.interpretation) {
          setInterpretation(data.interpretation);
          stopped = true;
          return;
        }
      } catch {
        // Network error — will retry on next interval
      }

      if (Date.now() - startTime >= POLL_TIMEOUT) {
        setPollTimedOut(true);
        stopped = true;
      }
    };

    const intervalId = setInterval(poll, POLL_INTERVAL);
    // First poll immediately
    poll();

    return () => {
      stopped = true;
      clearInterval(intervalId);
    };
  }, [id, interpretation]);

  const levelLabel = interpretation?.level_label || getLevelLabel(totalScore);

  return (
    <div className="test-results-page">
      <div className="tr-container">
        <HeroScore
          totalScore={totalScore}
          levelLabel={levelLabel}
          resultId={id}
        />

        <Divider />

        {interpretation?.overall ? (
          <>
            <AIInterpretation text={interpretation.overall} />
            <Divider />
          </>
        ) : (
          <>
            <div className="tr-interpretation-unavailable">
              {pollTimedOut
                ? "Интерпретация пока не готова. Обновите страницу позже."
                : "Генерируем вашу интерпретацию…"}
            </div>
            <Divider />
          </>
        )}

        <RadarChart scoresByScale={scoresByScale} />

        <Divider />

        <ScaleCards
          scoresByScale={scoresByScale}
          topScales={topScales}
          interpretation={interpretation}
        />
        <Divider />

        {interpretation?.top_zones &&
          interpretation.top_zones.length > 0 && (
            <>
              <TopZones
                topZones={interpretation.top_zones}
                scoresByScale={scoresByScale}
                programSlug={programSlug}
              />
              <Divider />
            </>
          )}

        <CTASection isOwner={isOwner} programSlug={programSlug} />

        <ResultsFooter />
      </div>
    </div>
  );
}
