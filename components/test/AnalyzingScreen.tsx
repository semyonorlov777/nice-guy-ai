"use client";

import { useState, useEffect, useRef } from "react";

interface AnalyzingScreenProps {
  onComplete: () => void;
}

type StepState = "pending" | "active" | "done";

const STEPS = [
  "Подсчёт баллов по 7 шкалам",
  "Определение ключевых паттернов",
  "Генерация персональной интерпретации",
];

export function AnalyzingScreen({ onComplete }: AnalyzingScreenProps) {
  const [stepStates, setStepStates] = useState<StepState[]>(["active", "pending", "pending"]);
  const [status, setStatus] = useState("Это займёт 15–30 секунд");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const t1 = setTimeout(() => {
      setStepStates(["done", "active", "pending"]);
    }, 3000);

    const t2 = setTimeout(() => {
      setStepStates(["done", "done", "active"]);
    }, 6000);

    const t3 = setTimeout(() => {
      setStepStates(["done", "done", "done"]);
      setStatus("Готово!");
    }, 9000);

    const t4 = setTimeout(() => {
      onCompleteRef.current();
    }, 10000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  return (
    <div className="tc-screen tc-analyzing-screen">
      <div className="tc-analyzing-orb">
        <div className="tc-analyzing-orb-inner">🔬</div>
      </div>

      <h2>Анализируем ответы</h2>
      <p className="tc-analyzing-status">{status}</p>

      <div className="tc-analyzing-steps">
        {STEPS.map((label, i) => (
          <div key={i} className={`tc-analyzing-step ${stepStates[i]}`}>
            <div className="tc-analyzing-step-icon">
              {stepStates[i] === "done" ? "✓" : i + 1}
            </div>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
