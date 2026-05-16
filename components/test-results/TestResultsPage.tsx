"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import type { ScaleResult } from "@/lib/test-scoring";
import type { TestInterpretation } from "@/lib/test-interpretation";
import type { ExerciseProgress } from "@/lib/queries/exercise-progress";
import { useCountUp } from "./useCountUp";
import { useScrollReveal } from "./useScrollReveal";
import { ShareButtons } from "./ShareButtons";
import { RadarChart } from "./RadarChart";
import { THEME_ICON_MAP } from "@/components/icons/hub-icons";

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
  exerciseProgress: ExerciseProgress;
}

// ── Constants ──

const DEFAULT_LEVEL_LABELS = ["Низкий уровень", "Умеренный уровень", "Выраженный уровень", "Высокий уровень"];
const DEFAULT_LEVEL_THRESHOLDS = [25, 50, 75];

// Программы где упражнения проходятся строго последовательно
// (по требованию автора: без фундамента старшие упражнения не работают).
// Для них на странице результатов теста показывается блок "Что делать"
// с призывом начать/продолжить программу по порядку, а зоны фокуса —
// без прямых ссылок на конкретные упражнения.
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
  sequentialMethodology,
}: {
  topZones: Array<{ scale_key: string; action_text: string }>;
  scoresByScale: Record<string, ScaleResult>;
  programSlug: string;
  scaleNames: Record<string, string>;
  scaleExercises: Record<string, number[]>;
  sequentialMethodology: boolean;
}) {
  const { ref, isVisible } = useScrollReveal();

  const sectionLabel = sequentialMethodology ? "Зоны роста" : "Приоритеты";
  const sectionTitle = sequentialMethodology
    ? "Где у тебя главные пробелы"
    : "С чего начать";

  return (
    <div
      ref={ref}
      className={`tr-zones-section tr-section-anim${isVisible ? " visible" : ""}`}
    >
      <div className="tr-section-label">{sectionLabel}</div>
      <div className="tr-section-title">{sectionTitle}</div>

      <div className="tr-zones-block">
        {topZones.map((zone, i) => {
          const name = scaleNames[zone.scale_key] ?? zone.scale_key;
          const pct = scoresByScale[zone.scale_key]?.pct ?? 0;
          const exercises = scaleExercises[zone.scale_key] ?? [];

          return (
            <div key={zone.scale_key} className="tr-zone-item">
              <div className="tr-zone-number">{i + 1}</div>
              <div className="tr-zone-content">
                <h4>
                  {name} — {pct}%
                </h4>
                <p>{zone.action_text}</p>
                {exercises.length > 0 && (
                  sequentialMethodology ? (
                    <div className="tr-zone-meta">
                      В программе разбирается в упр. {exercises.join(", ")} — дойдёшь до них по ходу.
                    </div>
                  ) : (
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
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WhatToDoBlock({
  programSlug,
  exerciseProgress,
}: {
  programSlug: string;
  exerciseProgress: ExerciseProgress;
}) {
  const { ref, isVisible } = useScrollReveal();
  const { nextNumber, totalCompleted, totalExercises, hasStarted } = exerciseProgress;

  let title: string;
  let body: string;
  let buttonLabel: string;
  let buttonHref: string;

  if (nextNumber === null) {
    title = "Ты прошёл всю программу";
    body = `46 упражнений из 46 — путь пройден целиком. Можешь пройти ещё раз: на втором круге увидишь нюансы, которые в первый раз прошли мимо. Тест выше показывает зоны где у тебя по-прежнему есть над чем работать.`;
    buttonLabel = "Начать ещё раз с упражнения 1";
    buttonHref = `/program/${programSlug}/exercise/1`;
  } else if (totalCompleted === 0 && !hasStarted) {
    title = "С чего начать?";
    body = `Программа Гловера — это 46 упражнений в 9 главах, выстроенных как лестница. Каждое следующее опирается на предыдущее: без главы 1 не сработает глава 5, без главы 3 — глава 7. Тест показал где у тебя зоны роста — встретишь их по ходу. Перепрыгивать в середину бесполезно: упражнения работают только в комплексе.`;
    buttonLabel = `Начать с упражнения ${nextNumber}`;
    buttonHref = `/program/${programSlug}/exercise/${nextNumber}`;
  } else if (hasStarted) {
    title = "Продолжай свой путь";
    body = `Ты сейчас на упражнении ${nextNumber} из ${totalExercises}. Тест показал твои главные зоны роста — в программе ты их прорабатываешь по очереди. Продолжай идти по порядку: так система Гловера и работает.`;
    buttonLabel = `Продолжить с упражнения ${nextNumber}`;
    buttonHref = `/program/${programSlug}/exercise/${nextNumber}`;
  } else {
    title = "Продолжай свой путь";
    body = `Ты завершил ${totalCompleted} из ${totalExercises} упражнений. Следующее по порядку — упражнение ${nextNumber}. Программа цельная: каждое упражнение опирается на то, что было раньше, поэтому идти лучше последовательно.`;
    buttonLabel = `Перейти к упражнению ${nextNumber}`;
    buttonHref = `/program/${programSlug}/exercise/${nextNumber}`;
  }

  return (
    <div
      ref={ref}
      className={`tr-todo-section tr-section-anim${isVisible ? " visible" : ""}`}
    >
      <div className="tr-todo-card">
        <div className="tr-todo-eyebrow">Что делать с этим</div>
        <h3 className="tr-todo-title">{title}</h3>
        <p className="tr-todo-body">{body}</p>
        <Link href={buttonHref} className="tr-cta-primary tr-todo-cta">
          {buttonLabel}
        </Link>
        <div className="tr-todo-meta">
          Все упражнения остаются открытыми — можешь зайти в любое. Но если хочешь чтобы программа сработала так, как задумал автор, — иди по порядку.
        </div>
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
    exerciseProgress,
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

  const levelLabel =
    interpretation?.level_label || getLevelLabel(totalScore, levelLabels, levelThresholds);

  const sequentialMethodology = SEQUENTIAL_METHODOLOGY_PROGRAMS.has(programSlug);

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
                sequentialMethodology={sequentialMethodology}
              />
              <Divider />
            </>
          )}

        {isOwner && sequentialMethodology ? (
          <WhatToDoBlock
            programSlug={programSlug}
            exerciseProgress={exerciseProgress}
          />
        ) : (
          <CTASection
            isOwner={isOwner}
            programSlug={programSlug}
            testTitle={testTitle}
            ctaText={ctaText}
            testSlug={testSlug}
          />
        )}

        <ResultsFooter />
      </div>
    </div>
  );
}
