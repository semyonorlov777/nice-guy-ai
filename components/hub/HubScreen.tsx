"use client";

import type { ProgramModeWithTemplate, LastActiveMode } from "@/types/modes";
import type { HubState, ThemeData } from "@/lib/hub-data";
import { getAIMessage } from "@/lib/hub-data";
import { HubHero } from "./HubHero";
import { HubMobileHeader } from "./HubMobileHeader";
import { AIMessage } from "./AIMessage";
import { HubContinueCard } from "./HubContinueCard";
import { ThemeCardsGrid } from "./ThemeCardsGrid";
import { InstrumentList } from "./InstrumentList";
import { HubInputBar } from "./HubInputBar";

interface HubScreenProps {
  state: HubState;
  modes: ProgramModeWithTemplate[];
  lastActive: LastActiveMode | null;
  program: {
    title: string;
    author: string;
    coverUrl: string | null;
    slug: string;
    exerciseCount?: number;
  };
  themes: ThemeData[];
  engagedKeys: string[];
  recommendedKeys: string[];
  hasTestResult: boolean;
  balance?: number;
}

export function HubScreen({
  state,
  lastActive,
  program,
  themes,
  engagedKeys,
  recommendedKeys,
  hasTestResult,
  balance,
}: HubScreenProps) {
  const isFirst = state === "first";
  const isReturning = state !== "first";
  const showTestCta = state === "first" || state === "returning-notest";
  const aiMessage = getAIMessage(state);
  const subtitle = `${program.author}${program.exerciseCount ? ` · ${program.exerciseCount} упражнений` : ""}`;

  return (
    <>
      <HubMobileHeader
        title={program.title}
        subtitle={subtitle}
        coverUrl={program.coverUrl}
        balance={balance}
      />
      <div className="hub-scroll">
        <div className="hub-inner">
          <HubHero
            title={program.title}
            author={program.author}
            coverUrl={program.coverUrl}
            exerciseCount={program.exerciseCount}
            compact={isReturning}
          />

          {isReturning && lastActive && (
            <HubContinueCard lastActive={lastActive} slug={program.slug} />
          )}

          <AIMessage text={aiMessage} />

          {showTestCta && (
            <>
              <a href={`/program/${program.slug}/test/issp`} className="hub-cta-primary">
                Пройти тест
              </a>
              <a href={`/program/${program.slug}/chat/new?tool=free-chat`} className="hub-cta-secondary">
                Или просто начни общаться →
              </a>
            </>
          )}

          {isReturning && (
            <>
              <div className="hub-section-label">
                {hasTestResult ? "Твои темы" : "Темы для работы"}
              </div>
              <ThemeCardsGrid
                themes={themes}
                engagedKeys={engagedKeys}
                recommendedKeys={recommendedKeys}
                slug={program.slug}
              />
            </>
          )}

          <div className="hub-section-label" style={isReturning ? { marginTop: 4 } : { marginTop: 8 }}>
            Инструменты
          </div>
          <InstrumentList
            slug={program.slug}
            exerciseCount={program.exerciseCount}
            hasTestResult={hasTestResult}
          />
        </div>
      </div>
      <HubInputBar slug={program.slug} />
    </>
  );
}
