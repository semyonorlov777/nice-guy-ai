"use client";

import { useEffect, useState } from "react";

const STAGES = [
  "Слушаю ваши ответы",
  "Ищу сквозную линию",
  "Связываю детали",
  "Подбираю формулировки",
  "Готовлю разбор",
];

const TOTAL_STAGE_TIME_MS = 70_000;

interface AnalyzingScreenProps {
  ready: boolean;
}

export function AnalyzingScreen({ ready }: AnalyzingScreenProps) {
  const [stageIndex, setStageIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const stageMs = TOTAL_STAGE_TIME_MS / STAGES.length;
    const interval = setInterval(() => {
      setStageIndex((prev) => {
        if (prev < STAGES.length - 1) return prev + 1;
        return prev;
      });
    }, stageMs);

    const start = Date.now();
    const tick = setInterval(() => {
      setElapsed(Date.now() - start);
    }, 200);

    return () => {
      clearInterval(interval);
      clearInterval(tick);
    };
  }, []);

  const progress = Math.min((elapsed / TOTAL_STAGE_TIME_MS) * 100, 99);
  const showReady = ready && elapsed >= TOTAL_STAGE_TIME_MS;

  return (
    <div className="funnel-screen funnel-analyzing">
      <div className="funnel-analyzing-inner">
        <div className="funnel-analyzing-orb">
          <div className="funnel-orb-ring funnel-orb-ring-1" />
          <div className="funnel-orb-ring funnel-orb-ring-2" />
          <div className="funnel-orb-ring funnel-orb-ring-3" />
          <div className="funnel-orb-core" />
        </div>

        <h2 className="funnel-analyzing-title">Готовлю ваш разбор</h2>

        <div className="funnel-analyzing-stages">
          {STAGES.map((stage, i) => (
            <div
              key={stage}
              className={`funnel-analyzing-stage${
                i < stageIndex
                  ? " done"
                  : i === stageIndex
                    ? " active"
                    : ""
              }`}
            >
              <span className="funnel-stage-marker">
                {i < stageIndex ? "✓" : i === stageIndex ? "" : ""}
              </span>
              <span className="funnel-stage-text">{stage}</span>
            </div>
          ))}
        </div>

        <div className="funnel-analyzing-progress">
          <div
            className="funnel-analyzing-progress-fill"
            style={{ width: `${showReady ? 100 : progress}%` }}
          />
        </div>

        <div className="funnel-analyzing-note">
          {showReady
            ? "Готово. Открываю разбор…"
            : "Это не предзаписанный шаблон — разбор строится индивидуально под ваши ответы. Займёт около минуты."}
        </div>
      </div>
    </div>
  );
}
