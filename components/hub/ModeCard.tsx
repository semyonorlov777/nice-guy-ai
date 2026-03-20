"use client";

import Link from "next/link";
import type { ProgramModeWithTemplate } from "@/types/modes";
import { getModeIcon, ArrowRightIcon } from "./mode-icons";

interface ModeCardProps {
  mode: ProgramModeWithTemplate;
  slug: string;
}

export function ModeCard({ mode, slug }: ModeCardProps) {
  const isComingSoon = !!mode.config?.coming_soon;
  const isPremium = mode.access_type === "paid" && !isComingSoon;
  const iconColorClass = mode.access_type === "paid" ? "accent" : "green";
  const href = `/program/${slug}${mode.route_suffix}`;

  const cardClasses = [
    "hub-mode-card",
    isPremium && "premium",
    isComingSoon && "coming-soon",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <div className={`hub-mode-icon ${iconColorClass}`}>
        {getModeIcon(mode.icon)}
      </div>
      <div className="hub-mode-body">
        <div className="hub-mode-top">
          <div className="hub-mode-name">{mode.name}</div>
          {isPremium && (
            <span className="hub-mode-badge">
              <span className="spark">✦</span> Попробовать
            </span>
          )}
          {isComingSoon && (
            <span className="hub-mode-badge coming-soon">Скоро</span>
          )}
        </div>
        {mode.description && (
          <div className="hub-mode-desc">{mode.description}</div>
        )}
      </div>
      <div className="hub-mode-arrow">
        <ArrowRightIcon />
      </div>
    </>
  );

  if (isComingSoon) {
    return <div className={cardClasses}>{content}</div>;
  }

  return (
    <Link href={href} className={cardClasses}>
      {content}
    </Link>
  );
}
