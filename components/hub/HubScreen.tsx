"use client";

import type { ProgramModeWithTemplate, LastActiveMode } from "@/types/modes";
import { BookHero } from "./BookHero";
import { ContinueBlock } from "./ContinueBlock";
import { ModeCard } from "./ModeCard";

interface HubScreenProps {
  modes: ProgramModeWithTemplate[];
  lastActive: LastActiveMode | null;
  program: {
    title: string;
    author: string;
    coverUrl: string | null;
    slug: string;
    exerciseCount?: number;
  };
}

export function HubScreen({ modes, lastActive, program }: HubScreenProps) {
  return (
    <div className="hub-scroll">
      <div className="hub-inner">
        <BookHero
          title={program.title}
          author={program.author}
          coverUrl={program.coverUrl}
          exerciseCount={program.exerciseCount}
        />

        {lastActive && (
          <ContinueBlock lastActive={lastActive} slug={program.slug} />
        )}

        <div className="hub-section-title">Выберите режим работы</div>

        <div className="hub-modes-grid" role="navigation">
          {modes.map((mode) => (
            <ModeCard key={mode.key} mode={mode} slug={program.slug} />
          ))}
        </div>
      </div>
    </div>
  );
}
