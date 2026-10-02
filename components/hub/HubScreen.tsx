"use client";

import type { ProgramModeWithTemplate, LastActiveMode } from "@/types/modes";
import type { ProgramTheme } from "@/lib/queries/themes";
import { HubHero } from "./HubHero";
import { HubMobileHeader } from "./HubMobileHeader";
import { AIMessage } from "./AIMessage";
import { HubContinueCard } from "./HubContinueCard";
import { ThemeCardsGrid } from "./ThemeCardsGrid";
import { InstrumentList } from "./InstrumentList";
import { useRouter } from "next/navigation";
import InputBar from "@/components/InputBar/InputBar";
import { LockIcon } from "@/components/icons/hub-icons";
import "@/components/voice-practice/voice-practice.css";

type HubState =
  | "first"
  | "returning-test"
  | "returning-notest"
  | "anketa-only"
  | "anketa-and-test";

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
  themes: ProgramTheme[];
  engagedKeys: string[];
  recommendedKeys: string[];
  hasTestResult: boolean;
  balance?: number;
  aiMessage: string;
  showAnketaCta?: boolean;
  /** Голосовой практикум: без теста, тем и текстового ввода. */
  voice?: { hasAccess: boolean };
}

export function HubScreen({
  state,
  modes,
  lastActive,
  program,
  themes,
  engagedKeys,
  recommendedKeys,
  hasTestResult,
  balance,
  aiMessage,
  showAnketaCta = false,
  voice,
}: HubScreenProps) {
  const router = useRouter();
  const isFirst = state === "first";
  const isReturning = state !== "first";
  const showTestCta =
    state === "first" ||
    state === "returning-notest" ||
    state === "anketa-only";
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
        <div className={voice ? "hub-inner vp-hub" : "hub-inner"}>
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

          {voice && !voice.hasAccess && (
            <div className="hub-anketa-cta">
              <div className="hub-anketa-cta-content">
                <div className="hub-anketa-cta-title">Доступ к практикуму выдаёт куратор</div>
                <div className="hub-anketa-cta-body">
                  Напишите куратору своего потока — после этого здесь откроются учебные консультации.
                </div>
              </div>
            </div>
          )}

          {!voice && showAnketaCta && (
            <a href={`/program/${program.slug}/anketa`} className="hub-anketa-cta">
              <div className="hub-anketa-cta-content">
                <div className="hub-anketa-cta-title">Расскажи о себе</div>
                <div className="hub-anketa-cta-body">
                  Подскажи в чём ты — Система настроится под тебя за 2 минуты
                </div>
              </div>
              <span className="hub-anketa-cta-action">Начать</span>
            </a>
          )}

          {!voice && showTestCta && (
            <>
              <a href={`/program/${program.slug}/test`} className="hub-cta-primary">
                Пройти тест
              </a>
              <a href={`/program/${program.slug}/chat/new?tool=free-chat`} className="hub-cta-secondary">
                Или просто начни общаться →
              </a>
            </>
          )}

          {!voice && isReturning && themes.length > 0 && (
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
            modes={modes}
            exerciseCount={program.exerciseCount}
            hasTestResult={hasTestResult}
          />
        </div>
      </div>
      {!voice && (
      <div className="hub-input-wrap">
        <InputBar
          mode="chat"
          placeholder="Просто напишите, о чём думаете…"
          onSend={(text) => {
            router.push(
              `/program/${program.slug}/chat/new?tool=free-chat&initialMessage=${encodeURIComponent(text)}`,
            );
          }}
          footer={
            <span className="hub-privacy">
              <LockIcon size={10} />
              Диалог анонимизирован и зашифрован
            </span>
          }
        />
      </div>
      )}
    </>
  );
}
