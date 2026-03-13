"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface AnalyzingScreenProps {
  chatId: string | null;
  onResultReady: (resultId: string) => void;
}

type StepState = "pending" | "active" | "done";

const STEPS = [
  "Подсчёт баллов по 7 шкалам",
  "Определение ключевых паттернов",
  "Генерация персональной интерпретации",
];

export function AnalyzingScreen({ chatId, onResultReady }: AnalyzingScreenProps) {
  const [stepStates, setStepStates] = useState<StepState[]>(["active", "pending", "pending"]);
  const [status, setStatus] = useState("Это займёт 15–30 секунд");
  const onResultReadyRef = useRef(onResultReady);
  onResultReadyRef.current = onResultReady;

  const poll = useCallback(async () => {
    if (!chatId) return null;
    try {
      const res = await fetch(`/api/test/result?chat_id=${encodeURIComponent(chatId)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, [chatId]);

  useEffect(() => {
    // Step animation (cosmetic)
    const t1 = setTimeout(() => {
      setStepStates(["done", "active", "pending"]);
    }, 3000);

    const t2 = setTimeout(() => {
      setStepStates(["done", "done", "active"]);
    }, 6000);

    // Poll for result every 3 seconds
    let stopped = false;
    const pollInterval = setInterval(async () => {
      if (stopped) return;
      const data = await poll();
      if (!data || stopped) return;

      if (data.status === "error") {
        setStatus("Произошла ошибка при анализе. Обновите страницу.");
        setStepStates(["done", "done", "done"]);
        clearInterval(pollInterval);
        return;
      }

      if (data.ready && data.result_id) {
        stopped = true;
        clearInterval(pollInterval);
        setStepStates(["done", "done", "done"]);
        setStatus("Готово!");
        // Small delay so animation doesn't cut off abruptly
        setTimeout(() => {
          onResultReadyRef.current(data.result_id);
        }, 1000);
      }
    }, 3000);

    // Timeout after 2 minutes
    const tFallback = setTimeout(() => {
      setStatus("Анализ занимает больше времени. Обновите страницу.");
    }, 120_000);

    return () => {
      stopped = true;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(tFallback);
      clearInterval(pollInterval);
    };
  }, [poll]);

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
