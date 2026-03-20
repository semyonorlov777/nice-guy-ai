"use client";

import { SessionsIcon, TimeIcon } from "./mode-icons";

interface BookHeroProps {
  title: string;
  author: string;
  coverUrl: string | null;
  exerciseCount?: number;
  sessionCount?: number;
  totalTime?: string;
}

export function BookHero({
  title,
  author,
  coverUrl,
  exerciseCount,
  sessionCount,
  totalTime,
}: BookHeroProps) {
  const authorLine = exerciseCount
    ? `${author} · ${exerciseCount} упражнений`
    : author;

  return (
    <div className="hub-hero">
      <div className="hub-hero-cover">
        {coverUrl ? (
          <img src={coverUrl} alt={title} />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(135deg, var(--accent), var(--accent-dark))",
            }}
          />
        )}
      </div>
      <div className="hub-hero-info">
        <div className="hub-hero-title">{title}</div>
        <div className="hub-hero-author">{authorLine}</div>
        {(sessionCount || totalTime) && (
          <div className="hub-hero-stats">
            {sessionCount != null && (
              <span>
                <SessionsIcon />
                {sessionCount} сессий
              </span>
            )}
            {totalTime && (
              <span>
                <TimeIcon />
                {totalTime}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
