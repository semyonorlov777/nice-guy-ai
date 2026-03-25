"use client";

import { useRouter } from "next/navigation";
import { ThemeCard } from "./ThemeCard";
import type { ProgramTheme } from "@/lib/queries/themes";

// Маппинг: тема (ISSP-шкала) → рекомендованный режим
const THEME_ROUTE_MAP: Record<string, string> = {
  approval: "/syndrome",
  contracts: "/relationships",
  suppression: "/syndrome",
  control: "/syndrome",
  boundaries: "/boundaries",
  masculinity: "/parents",
  attachment: "/relationships",
};

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
        const route = THEME_ROUTE_MAP[theme.key];
        const href = route
          ? `/program/${slug}${route}`
          : `/program/${slug}/chat/new?topic=${theme.key}`;

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
