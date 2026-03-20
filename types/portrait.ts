// ── Section data types ──

export interface PatternsData {
  summary?: string;
  items: Array<{ name: string; description: string; intensity: "high" | "medium" | "noticed" }>;
}

export interface TextData {
  text: string;
}

export interface InsightsData {
  items: Array<{ text: string; source?: string; date?: string }>;
}

export interface TagsData {
  items: string[];
}

// ── Discriminated union ──

export type PortraitSection =
  | { id: string; title: string; icon?: string; type: "patterns"; data: PatternsData }
  | { id: string; title: string; icon?: string; type: "text"; data: TextData }
  | { id: string; title: string; icon?: string; type: "insights"; data: InsightsData }
  | { id: string; title: string; icon?: string; type: "tags"; data: TagsData };

// ── Portrait content ──

export interface PortraitContent {
  version: number;
  exercises_completed: number;
  summary?: string;
  ai_context?: string;
  sections: PortraitSection[];
}

export const EMPTY_PORTRAIT: PortraitContent = {
  version: 2,
  exercises_completed: 0,
  sections: [],
};

// ── Legacy types (for conversion) ──

interface LegacyPortraitContent {
  version: number;
  last_updated: string;
  exercises_completed: number;
  nice_guy_patterns: { summary: string; patterns: Array<{ name: string; context: string; intensity: "high" | "medium" | "noticed"; sources: string[]; first_seen: string; last_updated?: string }> };
  key_insights: Array<{ text: string; source: string; source_title: string; added_at: string }>;
  family_system: { summary: string; details: Array<{ source: string; insight: string; added_at: string }> };
  defense_mechanisms: { summary: string; mechanisms: Array<{ name: string; example: string; source: string }> };
  growth_zones: { summary: string; observations: Array<{ text: string; source: string; added_at: string }> };
  ai_context: string;
}

export function isLegacyPortrait(content: unknown): content is LegacyPortraitContent {
  return !!content && typeof content === "object" && "nice_guy_patterns" in content && !("sections" in content);
}

export function convertLegacyPortrait(old: LegacyPortraitContent): PortraitContent {
  const sections: PortraitSection[] = [];

  if (old.nice_guy_patterns?.patterns?.length > 0) {
    sections.push({
      id: "core_patterns",
      title: "Паттерны",
      icon: "🔄",
      type: "patterns",
      data: {
        summary: old.nice_guy_patterns.summary || undefined,
        items: old.nice_guy_patterns.patterns.map((p) => ({
          name: p.name,
          description: p.context,
          intensity: p.intensity,
        })),
      },
    });
  }

  if (old.key_insights?.length > 0) {
    sections.push({
      id: "key_insights",
      title: "Инсайты",
      icon: "💡",
      type: "insights",
      data: {
        items: old.key_insights.map((i) => ({
          text: i.text,
          source: i.source_title || i.source,
          date: i.added_at,
        })),
      },
    });
  }

  if (old.family_system?.summary) {
    sections.push({
      id: "family_system",
      title: "Семейная система",
      icon: "👨‍👩‍👦",
      type: "text",
      data: { text: old.family_system.summary },
    });
  }

  if (old.defense_mechanisms?.mechanisms?.length > 0) {
    sections.push({
      id: "defense_mechanisms",
      title: "Защитные механизмы",
      icon: "🛡️",
      type: "patterns",
      data: {
        summary: old.defense_mechanisms.summary || undefined,
        items: old.defense_mechanisms.mechanisms.map((m) => ({
          name: m.name,
          description: m.example,
          intensity: "medium" as const,
        })),
      },
    });
  }

  if (old.growth_zones?.observations?.length > 0) {
    sections.push({
      id: "growth_zones",
      title: "Зоны роста",
      icon: "🌱",
      type: "insights",
      data: {
        items: old.growth_zones.observations.map((o) => ({
          text: o.text,
          source: o.source,
          date: o.added_at,
        })),
      },
    });
  }

  return {
    version: 2,
    exercises_completed: old.exercises_completed || 0,
    ai_context: old.ai_context || undefined,
    sections,
  };
}
