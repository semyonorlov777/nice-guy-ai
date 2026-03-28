"use client";

import { useRouter } from "next/navigation";
import { ThemeCard } from "./ThemeCard";
import type { ProgramTheme } from "@/lib/queries/themes";

interface ThemeCardsGridProps {
  themes: ProgramTheme[];
  engagedKeys: string[];
  recommendedKeys: string[];
  slug: string;
}

export function ThemeCardsGrid({ themes, engagedKeys, recommendedKeys, slug }: ThemeCardsGridProps) {
  const router = useRouter();

  return (
    <div className="hub-themes">
      {themes.slice(0, 6).map((theme) => {
        const href = `/program/${slug}/chat/new?topic=${theme.key}`;

        return (
          <ThemeCard
            key={theme.key}
            theme={theme}
            isEngaged={engagedKeys.includes(theme.key)}
            isRecommended={recommendedKeys.includes(theme.key)}
            onClick={() => router.push(href)}
          />
        );
      })}
    </div>
  );
}
