"use client";

import { useState, useEffect } from "react";

interface AnalyzingStage {
  title?: string;
  label?: string;
  substeps: string[];
}

interface AnalyzingScreenProps {
  resultId: string | null;
  onComplete: (resultId: string) => void;
  stages?: AnalyzingStage[];
}

const DEFAULT_ANALYZING_STAGES: AnalyzingStage[] = [
  {
    label: "Анализ ответов",
    substeps: [
      "Обработка ответов по 7 сферам жизни",
      "Расчёт баллов с учётом обратных шкал",
      "Определение доминирующих сфер",
      "Поиск взаимосвязей между шкалами",
    ],
  },
  {
    label: "Научная база",
    substeps: [
      "Поиск релевантных исследований (PubMed, APA PsycNet)",
      "Анализ публикаций по выявленным паттернам",
      "Сопоставление с методологией Роберта Гловера",
      "Подбор доказательных подходов (CBT, Schema Therapy)",
    ],
  },
  {
    label: "Персональный профиль",
    substeps: [
      "Формирование описания по каждой сфере",
      "Определение приоритетных направлений роста",
      "Подбор рекомендованных упражнений",
      "Генерация персональной интерпретации",
    ],
  },
];

const SUBSTEP_DELAY = 4800;
const STAGE_GAP = 1200;
const HINT_DELAY = 15000;
const TIMEOUT_LIMIT = 120000;

export function AnalyzingScreen({ resultId, onComplete, stages }: AnalyzingScreenProps) {
  const ANALYZING_STAGES = stages && stages.length > 0 ? stages : DEFAULT_ANALYZING_STAGES;

  const [animationDone, setAnimationDone] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [waitingForBackend, setWaitingForBackend] = useState(false);
  const [error, setError] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [orbProgress, setOrbProgress] = useState(0);

  const [stageStates, setStageStates] = useState<("idle" | "active" | "done")[]>(
    ANALYZING_STAGES.map(() => "idle" as const)
  );
  const [substepStates, setSubstepStates] = useState<("idle" | "active" | "done")[][]>(
    ANALYZING_STAGES.map((s) => s.substeps.map(() => "idle" as const))
  );

  // Dev-mode warning: resultId data flow check
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const t = setTimeout(() => {
      if (!resultId) {
        console.error(
          `[AnalyzingScreen] resultId is still null after 10s. ` +
          `Data flow: TestCardFlow polling /api/test/result → setResultId → <AnalyzingScreen resultId={...}>. ` +
          `Check that polling is running and chatId is set in TestCardFlow.`
        );
      }
    }, 10000);
    return () => clearTimeout(t);
  }, [resultId]);

  // Stage/substep animation timeline
  useEffect(() => {
    const timeouts: number[] = [];
    let delay = 600;
    const totalSubs = ANALYZING_STAGES.reduce((sum, s) => sum + s.substeps.length, 0);
    let count = 0;

    ANALYZING_STAGES.forEach((stage, si) => {
      // Activate stage
      timeouts.push(
        window.setTimeout(() => {
          setStageStates((prev) => {
            const n = [...prev];
            n[si] = "active";
            return n;
          });
        }, delay)
      );
      delay += 400;

      // Substeps
      stage.substeps.forEach((_, ssi) => {
        timeouts.push(
          window.setTimeout(() => {
            setSubstepStates((prev) => {
              const n = prev.map((a) => [...a]);
              if (ssi > 0) n[si][ssi - 1] = "done";
              n[si][ssi] = "active";
              return n;
            });
            count++;
            setOrbProgress(Math.round((count / totalSubs) * 100));
          }, delay)
        );
        delay += SUBSTEP_DELAY;
      });

      // Last substep done
      timeouts.push(
        window.setTimeout(() => {
          setSubstepStates((prev) => {
            const n = prev.map((a) => [...a]);
            n[si][stage.substeps.length - 1] = "done";
            return n;
          });
        }, delay)
      );

      // Stage done
      timeouts.push(
        window.setTimeout(() => {
          setStageStates((prev) => {
            const n = [...prev];
            n[si] = "done";
            return n;
          });
        }, delay + 200)
      );

      delay += STAGE_GAP;
    });

    // Hint after 15s
    timeouts.push(window.setTimeout(() => setShowHint(true), HINT_DELAY));

    // Animation complete
    timeouts.push(window.setTimeout(() => setAnimationDone(true), delay + 500));

    return () => timeouts.forEach(clearTimeout);
  }, []);

  // Double gating: animation done + resultId
  useEffect(() => {
    if (animationDone && resultId) {
      setAllDone(true);
      const t = window.setTimeout(() => onComplete(resultId), 2000);
      return () => clearTimeout(t);
    } else if (animationDone && !resultId) {
      setWaitingForBackend(true);
    }
  }, [animationDone, resultId, onComplete]);

  // resultId arrived after animation finished
  useEffect(() => {
    if (waitingForBackend && resultId) {
      setWaitingForBackend(false);
      setAllDone(true);
      const t = window.setTimeout(() => onComplete(resultId), 2000);
      return () => clearTimeout(t);
    }
  }, [waitingForBackend, resultId, onComplete]);

  // Error timeout (2 min)
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!resultId) setError(true);
    }, TIMEOUT_LIMIT);
    return () => clearTimeout(t);
  }, [resultId]);

  const orbDone = allDone;
  const dashOffset = 251 - (251 * orbProgress) / 100;

  if (error) {
    return (
      <div className="tc-screen tc-analyzing-center">
        <div className="analyzing-error">
          <p className="analyzing-error-text">
            Произошла ошибка при анализе. Попробуйте обновить страницу.
          </p>
          <button
            className="analyzing-error-btn"
            onClick={() => window.location.reload()}
          >
            Обновить страницу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tc-screen tc-analyzing-center">
      {/* Orb */}
      <div className={`analyzing-orb-wrap${orbDone ? " done" : ""}`}>
        <div className="analyzing-orb-bg" />
        <svg className="analyzing-orb-ring" viewBox="0 0 84 84">
          <circle
            className="analyzing-orb-ring-progress"
            cx="42"
            cy="42"
            r="40"
            style={{ strokeDashoffset: orbDone ? 0 : dashOffset }}
          />
        </svg>
        <div className="analyzing-orb-icon">
          {orbDone ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          )}
        </div>
      </div>

      {/* Title */}
      {allDone ? (
        <div className="analyzing-done-message visible">Профиль готов</div>
      ) : (
        <>
          <div>
            <h2 className="tc-analyzing-title">
              Анализируем ваши ответы
            </h2>
            <p className="tc-analyzing-subtitle">
              Это займёт около 30–60 секунд
            </p>
          </div>

          {/* Stages */}
          <div className="analyzing-stages">
            {ANALYZING_STAGES.map((stage, si) => (
              <div key={si} className={`analyzing-stage ${stageStates[si]}`}>
                <div className="analyzing-stage-header">
                  <div className="analyzing-stage-dot">
                    <svg viewBox="0 0 10 10" fill="none">
                      <polyline points="2,5 4.5,7.5 8,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="analyzing-stage-label">{stage.label || stage.title}</span>
                </div>
                <div className="analyzing-substeps">
                  {stage.substeps.map((text, ssi) => {
                    const state = substepStates[si][ssi];
                    const visible = state !== "idle";
                    return (
                      <div
                        key={ssi}
                        className={`analyzing-substep${visible ? " visible" : ""}${state === "active" ? " active" : ""}${state === "done" ? " done" : ""}`}
                      >
                        <div className="analyzing-substep-dot" />
                        <span className="analyzing-substep-text">{text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Hint */}
          <div className={`analyzing-hint${showHint ? " visible" : ""}`}>
            Вы увидите персональный профиль с рекомендациями и научным обоснованием
          </div>

          {/* Waiting for backend */}
          {waitingForBackend && (
            <div className="analyzing-waiting">Финализируем интерпретацию...</div>
          )}
        </>
      )}
    </div>
  );
}
