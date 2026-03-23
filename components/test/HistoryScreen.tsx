"use client";

import { useRouter } from "next/navigation";

export interface TestResultSummary {
  id: string;
  total_score: number;
  created_at: string;
  interpretation?: { level_label?: string } | null;
}

interface HistoryScreenProps {
  results: TestResultSummary[]; // DESC по дате (первый = последний)
  onRetake: () => void;
  isStarting: boolean;
  programSlug: string;
}

const dateFormatter = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** ИССП: снижение балла = прогресс (зелёный), рост = регресс (красный) */
function deltaClass(diff: number): "up" | "down" | "none" {
  if (diff < 0) return "up";   // балл снизился → прогресс
  if (diff > 0) return "down"; // балл вырос → регресс
  return "none";
}

function deltaText(diff: number): string {
  if (diff < 0) return `${diff}`;  // уже с минусом
  if (diff > 0) return `+${diff}`;
  return "—";
}

const ChevronRight = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ArrowUp = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="7 17 12 12 17 17" />
    <line x1="12" y1="12" x2="12" y2="21" />
  </svg>
);

const BadgeIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const LockIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export function HistoryScreen({ results, onRetake, isStarting, programSlug }: HistoryScreenProps) {
  const router = useRouter();
  const latest = results[0];
  const first = results[results.length - 1];
  const hasMultiple = results.length > 1;

  // Дельта между последним и первым прохождением
  const overallDiff = hasMultiple ? latest.total_score - first.total_score : 0;

  return (
    <div className="tc-screen tc-history-screen">
      {/* Badge */}
      <div className="tc-welcome-badge">
        <BadgeIcon />
        Диагностика
      </div>

      {/* Title */}
      <h1>
        Индекс Синдрома<br />
        <span>Славного Парня</span>
      </h1>

      {/* Latest result card */}
      <div
        className="tc-history-card"
        onClick={() => router.push(`/program/${programSlug}/test/results/${latest.id}`)}
      >
        <div className="tc-history-card-label">
          {hasMultiple ? "Последний результат" : "Ваш результат"}
        </div>
        <div className="tc-history-score-row">
          <div className="tc-history-score">{latest.total_score}</div>
          <div className="tc-history-score-max">/ 100</div>
        </div>
        {latest.interpretation?.level_label && (
          <div className="tc-history-level">{latest.interpretation.level_label}</div>
        )}
        <div className="tc-history-date">{formatDate(latest.created_at)}</div>

        {/* Delta chip — only for multiple results */}
        {hasMultiple && overallDiff !== 0 && (
          <div className={`tc-history-delta ${deltaClass(overallDiff)}`}>
            <ArrowUp />
            {deltaText(overallDiff)} с первого раза
          </div>
        )}

        <div className="tc-history-arrow">
          <ChevronRight />
        </div>
      </div>

      {/* Divider + Retake button + Meta */}
      <div className="tc-history-divider" />
      <button
        className="tc-btn-primary tc-history-actions"
        onClick={onRetake}
        disabled={isStarting}
      >
        {isStarting ? "Запуск…" : "Пройти заново"}
      </button>
      <div className="tc-meta-line tc-history-meta">
        <LockIcon />
        Результаты конфиденциальны. Правильных ответов нет.
      </div>

      {/* Previous results */}
      {hasMultiple && (
        <div className="tc-history-prev-section">
          <div className="tc-history-prev-label">Предыдущие</div>
          <div className="tc-history-prev-list">
            {results.slice(1).map((result, i) => {
              // i=0 — предпоследний, i=results.length-2 — самый первый
              const indexInDesc = i + 1; // индекс в исходном DESC массиве (0 = latest, уже показан)
              const attemptNumber = results.length - indexInDesc; // хронологический номер

              // Мини-дельта: разница с предыдущим хронологическим прохождением
              // Предыдущее хронологически = следующий элемент в DESC массиве
              const nextInDesc = results[indexInDesc + 1]; // более старый
              let miniDiff = 0;
              let isFirst = false;
              if (!nextInDesc) {
                isFirst = true; // самое первое прохождение
              } else {
                miniDiff = result.total_score - nextInDesc.total_score;
              }

              return (
                <div
                  key={result.id}
                  className="tc-history-prev-row"
                  onClick={() => router.push(`/program/${programSlug}/test/results/${result.id}`)}
                >
                  <div className="tc-history-prev-num">{attemptNumber}</div>
                  <div className="tc-history-prev-score">{result.total_score}</div>
                  <div className="tc-history-prev-date">{formatDate(result.created_at)}</div>
                  <div className={`tc-history-prev-delta ${isFirst ? "none" : deltaClass(miniDiff)}`}>
                    {isFirst ? "—" : deltaText(miniDiff)}
                  </div>
                  <div className="tc-history-prev-arrow">
                    <ChevronRight size={16} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
