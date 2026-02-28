export interface PortraitPattern {
  name: string;
  context: string;
  intensity: 'high' | 'medium' | 'noticed';
  sources: string[];
  first_seen: string;
  last_updated?: string;
}

export interface PortraitInsight {
  text: string;
  source: string;
  source_title: string;
  added_at: string;
}

export interface PortraitFamilyDetail {
  source: string;
  insight: string;
  added_at: string;
}

export interface PortraitDefenseMechanism {
  name: string;
  example: string;
  source: string;
}

export interface PortraitGrowthObservation {
  text: string;
  source: string;
  added_at: string;
}

export interface PortraitContent {
  version: number;
  last_updated: string;
  exercises_completed: number;

  nice_guy_patterns: {
    summary: string;
    patterns: PortraitPattern[];
  };

  key_insights: PortraitInsight[];

  family_system: {
    summary: string;
    details: PortraitFamilyDetail[];
  };

  defense_mechanisms: {
    summary: string;
    mechanisms: PortraitDefenseMechanism[];
  };

  growth_zones: {
    summary: string;
    observations: PortraitGrowthObservation[];
  };

  ai_context: string;
}

export const EMPTY_PORTRAIT: PortraitContent = {
  version: 1,
  last_updated: new Date().toISOString(),
  exercises_completed: 0,
  nice_guy_patterns: { summary: '', patterns: [] },
  key_insights: [],
  family_system: { summary: '', details: [] },
  defense_mechanisms: { summary: '', mechanisms: [] },
  growth_zones: { summary: '', observations: [] },
  ai_context: '',
};
