"use client";

import { useRouter } from "next/navigation";
import { ThemeCard } from "./ThemeCard";
import type { ThemeData } from "@/lib/hub-data";

interface ThemeCardsGridProps {
  themes: ThemeData[];
  engagedKeys: string[];
  recommendedKeys: string[];
  slug: string;
}

export function ThemeCardsGrid({ themes, engagedKeys, recommendedKeys, slug }: ThemeCardsGridProps) {
  const router = useRouter();

  return (
    <div className="hub-themes">
      {themes.map((theme) => (
        <ThemeCard
          key={theme.key}
          theme={theme}
          isEngaged={engagedKeys.includes(theme.key)}
          isRecommended={recommendedKeys.includes(theme.key)}
          onClick={() => router.push(`/program/${slug}/chat/new?topic=${theme.key}`)}
        />
      ))}
    </div>
  );
}
