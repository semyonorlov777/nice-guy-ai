"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ScaleResult } from "@/lib/test-scoring";
import {
  isFallbackInterpretation,
  type TestInterpretation,
} from "@/lib/test-interpretation";
import { useCountUp } from "./useCountUp";
import { useScrollReveal } from "./useScrollReveal";
import { ShareButtons } from "./ShareButtons";
import { THEME_ICON_MAP } from "@/components/icons/theme-icon-map";
import { AIBubble } from "@/components/chat/ChatMessage";

// Radar — тяжёлый SVG + анимации, грузим только в браузере, чтобы не блокировать
// первичный paint мобильного устройства.
const RadarChart = dynamic(
  () => import("./RadarChart").then((m) => m.RadarChart),
  {
    ssr: false,
    loading: () => (
      <div className="tr-radar-section">
        <div className="tr-radar-wrapper tr-radar-skeleton" aria-hidden="true" />
      </div>
    ),
  }
);

// ── Types ──

type ScoreDirection = "higher_is_better" | "lower_is_better";

export interface TestResultsProps {
  id: string;
  totalScore: number;
  scoresByScale: Record<string, ScaleResult>;
  topScales: string[];
  recommendedExercises: number[];
  interpretation: TestInterpretation | null;
  isOwner: boolean;
  createdAt: string;
  programSlug: string;
  testTitle?: string;
  scaleOrder: string[];
  scaleNames: Record<string, string>;
  scaleExercises: Record<string, number[]>;
  radarLabels: Record<string, string[]>;
  heroSubtitle?: string;
  ctaText?: string;
  testSlug?: string;
  scoreDirection?: ScoreDirection;
  levelLabels?: string[];
  levelThresholds?: number[];
}

// ── Constants ──

const DEFAULT_LEVEL_LABELS = ["Низкий уровень", "Умеренный уровень", "Выраженный уровень", "Высокий уровень"];
const DEFAULT_LEVEL_THRESHOLDS = [25, 50, 75];

// Программы где упражнения проходятся строго последовательно
// (по требованию автора: без фундамента старшие упражнения не работают).
// Для них на странице результатов теста добавляется блок «Что делать с этим»
// с призывом начать/продолжить программу по порядку. Зоны фокуса при этом
// сохраняют свой обычный вид с кликабельными ссылками на упражнения.
const SEQUENTIAL_METHODOLOGY_PROGRAMS = new Set(["nice-guy"]);

function getLevelClass(score: number, direction: ScoreDirection): string {
  // Visual semantics: "low" = green pill, "high" = red pill, "moderate" = accent pill.
  // For higher_is_better invert: high score = "low" CSS class (green good), low score = "high" (red alarm).
  const isLowerBetter = direction === "lower_is_better";
  if (score <= 30) return isLowerBetter ? "low" : "high";
  if (score <= 60) return "moderate";
  return isLowerBetter ? "high" : "low";
}

function getLevelLabel(score: number, levelLabels: string[], levelThresholds: number[]): string {
  for (let i = 0; i < levelThresholds.length; i++) {
    if (score <= levelThresholds[i]) return levelLabels[i] ?? `level_${i}`;
  }
  return levelLabels[levelThresholds.length] ?? "high";
}

function colorClass(pct: number, direction: ScoreDirection): string {
  const isLowerBetter = direction === "lower_is_better";
  const high = isLowerBetter ? "red" : "green";
  const low = isLowerBetter ? "green" : "red";
  if (pct >= 60) return high;
  if (pct >= 40) return "yellow";
  return low;
}

// ── Sub-components ──

function Divider() {
  return <div className="tr-divider" />;
}

function HeroScore({
  totalScore,
  levelLabel,
  resultId,
  testTitle,
  heroSubtitle,
  scoreDirection,
}: {
  totalScore: number;
  levelLabel: string;
  resultId: string;
  testTitle?: string;
  heroSubtitle?: string;
  scoreDirection: ScoreDirection;
}) {
  const displayScore = useCountUp(totalScore);
  const levelClass = getLevelClass(totalScore, scoreDirection);

  return (
    <div className="tr-hero">
      <div className="tr-hero-label">{testTitle || "Результат теста"}</div>
      <div className="tr-hero-score">
        <span>{displayScore}</span>
        <span className="tr-denominator">/100</span>
      </div>
      <div className={`tr-hero-level ${levelClass}`}>{levelLabel}</div>
      {heroSubtitle && (
        <div className="tr-hero-subtitle">{heroSubtitle}</div>
      )}
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
      <AIBubble text={text} className="tr-interp-block" />
    </div>
  );
}

function ScaleCards({
  scoresByScale,
  topScales,
  interpretation,
  scaleOrder,
  scaleNames,
  scoreDirection,
}: {
  scoresByScale: Record<string, ScaleResult>;
  topScales: string[];
  interpretation: TestInterpretation | null;
  scaleOrder: string[];
  scaleNames: Record<string, string>;
  scoreDirection: ScoreDirection;
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
  const sorted = [...scaleOrder].sort(
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
          const color = colorClass(s.pct, scoreDirection);
          // "top zone" = что показывать особо: для lower_is_better это высокий %, для higher_is_better — низкий (зона роста).
          const isTop =
            i < 3 &&
            (scoreDirection === "lower_is_better" ? s.pct >= 50 : s.pct <= 50);
          const name = scaleNames[key] ?? key;
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
  scaleNames,
  scaleExercises,
}: {
  topZones: TestInterpretation["top_zones"];
  scoresByScale: Record<string, ScaleResult>;
  programSlug: string;
  scaleNames: Record<string, string>;
  scaleExercises: Record<string, number[]>;
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
          const name = scaleNames[zone.scale_key] ?? zone.scale_key;
          const pct = zone.score ?? scoresByScale[zone.scale_key]?.pct ?? 0;
          const exercises = scaleExercises[zone.scale_key] ?? [];
          const heading = zone.headline || `${name} — ${pct}%`;
          const itemKey = zone.scale_key || `zone-${i}`;

          return (
            <div key={itemKey} className="tr-zone-item">
              <div className="tr-zone-number">{i + 1}</div>
              <div className="tr-zone-content">
                <h4>{heading}</h4>
                {zone.action_route ? (
                  <>
                    {zone.body && <p>{zone.body}</p>}
                    <Link href={zone.action_route} className="tr-zone-cta">
                      {zone.action_text} →
                    </Link>
                  </>
                ) : (
                  <>
                    <p>{zone.body || zone.action_text}</p>
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
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WhatToDoBlock({ programSlug }: { programSlug: string }) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={`tr-todo-section tr-section-anim${isVisible ? " visible" : ""}`}
    >
      <div className="tr-todo-card">
        <div className="tr-todo-eyebrow">Что делать с этим</div>
        <p className="tr-todo-body">
          46 упражнений Гловера работают только последовательно — каждое опирается на предыдущее. Иди по порядку, не перепрыгивай.
        </p>
        <Link href={`/program/${programSlug}/exercises`} className="tr-cta-primary tr-todo-cta">
          К упражнениям программы
        </Link>
      </div>
    </div>
  );
}

function CTASection({
  isOwner,
  programSlug,
  testTitle,
  ctaText,
  testSlug,
}: {
  isOwner: boolean;
  programSlug: string;
  testTitle?: string;
  ctaText?: string;
  testSlug?: string;
}) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={`tr-cta-section tr-section-anim${isVisible ? " visible" : ""}`}
    >
      {isOwner ? (
        <>
          <Link href={`/program/${programSlug}/hub`} className="tr-cta-primary">
            Начать путь к изменениям
          </Link>
          {ctaText && <div className="tr-cta-sub">{ctaText}</div>}
        </>
      ) : (
        <div className="tr-cta-guest">
          <div className="tr-cta-guest-title">{testTitle || "А какой твой профиль?"}</div>
          <Link href={`/program/${programSlug}/test/${testSlug || "test"}`} className="tr-cta-primary">
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
        <Link href="/">Книжный Спарринг</Link>
      </div>
    </div>
  );
}

function InterpretationStatus({
  resultId,
  isFallback,
  pollTimedOut,
  onRegenerated,
}: {
  resultId: string;
  isFallback: boolean;
  pollTimedOut: boolean;
  onRegenerated: (interp: TestInterpretation) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRetry = isFallback || pollTimedOut;

  async function handleRetry() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/test/results/${resultId}/regenerate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.interpretation) {
        setError(data.error || "Не удалось сгенерировать. Попробуй ещё раз.");
        return;
      }
      onRegenerated(data.interpretation);
    } catch {
      setError("Ошибка сети. Проверь подключение и попробуй ещё раз.");
    } finally {
      setPending(false);
    }
  }

  const message = canRetry
    ? "Подробная интерпретация пока не готова."
    : "Генерируем вашу интерпретацию…";

  return (
    <div className="tr-interpretation-unavailable">
      <div className="tr-interp-status-text">{message}</div>
      {canRetry && (
        <button
          type="button"
          className="tr-cta-secondary tr-interp-retry"
          onClick={handleRetry}
          disabled={pending}
        >
          {pending ? "Генерируем…" : "Сгенерировать заново"}
        </button>
      )}
      {error && <div className="tr-interp-retry-error">{error}</div>}
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
    testTitle,
    scaleOrder,
    scaleNames,
    scaleExercises,
    radarLabels,
    heroSubtitle,
    ctaText,
    testSlug,
    scoreDirection = "lower_is_better",
    levelLabels = DEFAULT_LEVEL_LABELS,
    levelThresholds = DEFAULT_LEVEL_THRESHOLDS,
  } = props;

  const [interpretation, setInterpretation] = useState(initialInterpretation);
  const [pollTimedOut, setPollTimedOut] = useState(false);

  const isFallback = isFallbackInterpretation(interpretation);

  useEffect(() => {
    // Poll while background generation is in progress (interpretation === null).
    // For fallback interpretation, background job already failed — polling won't
    // produce new data, user must trigger regeneration via the retry button.
    if (interpretation) return;

    let stopped = false;
    const startTime = Date.now();

    const poll = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/test/results/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.interpretation && !isFallbackInterpretation(data.interpretation)) {
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

  const levelLabel =
    (interpretation && !isFallback && interpretation.level_label) ||
    getLevelLabel(totalScore, levelLabels, levelThresholds);

  const showWhatToDo =
    isOwner && SEQUENTIAL_METHODOLOGY_PROGRAMS.has(programSlug);

  return (
    <div className="test-results-page">
      <div className="tr-container">
        <HeroScore
          totalScore={totalScore}
          levelLabel={levelLabel}
          resultId={id}
          testTitle={testTitle}
          heroSubtitle={heroSubtitle}
          scoreDirection={scoreDirection}
        />

        <Divider />

        {interpretation && !isFallback ? (
          <>
            <AIInterpretation text={interpretation.overall} />
            <Divider />
          </>
        ) : (
          <>
            <InterpretationStatus
              resultId={id}
              isFallback={isFallback}
              pollTimedOut={pollTimedOut}
              onRegenerated={setInterpretation}
            />
            <Divider />
          </>
        )}

        <RadarChart
          scoresByScale={scoresByScale}
          scaleOrder={scaleOrder}
          radarLabels={radarLabels}
          scoreDirection={scoreDirection}
        />

        <Divider />

        <ScaleCards
          scoresByScale={scoresByScale}
          topScales={topScales}
          interpretation={interpretation}
          scaleOrder={scaleOrder}
          scaleNames={scaleNames}
          scoreDirection={scoreDirection}
        />
        <Divider />

        {interpretation?.top_zones &&
          interpretation.top_zones.length > 0 && (
            <>
              <TopZones
                topZones={interpretation.top_zones}
                scoresByScale={scoresByScale}
                programSlug={programSlug}
                scaleNames={scaleNames}
                scaleExercises={scaleExercises}
              />
              <Divider />
            </>
          )}

        {showWhatToDo && (
          <>
            <WhatToDoBlock programSlug={programSlug} />
            <Divider />
          </>
        )}

        <CTASection isOwner={isOwner} programSlug={programSlug} testTitle={testTitle} ctaText={ctaText} testSlug={testSlug} />

        <ResultsFooter />
      </div>
    </div>
  );
}
