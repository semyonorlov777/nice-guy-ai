// Types for the generic multi-book test system.
// All test data lives in the `test_configs` DB table.

export interface TestQuestion {
  q: number;
  scale: string;
  type: "direct" | "reverse";
  text: string;
}

export interface TestScale {
  key: string;
  name: string;
  order: number;
  exercises?: number[];
  radar_label?: string[];
}

export interface TestScoringConfig {
  answer_range: [number, number]; // e.g. [1, 5]
  score_direction: "lower_is_better" | "higher_is_better";
  level_thresholds: number[]; // e.g. [25, 50, 75] → 4 levels
  level_labels: string[]; // e.g. ["Низкий", "Умеренный", "Выраженный", "Высокий"]
}

export interface WelcomeStat {
  num: string;
  label: string;
}

export interface AnalyzingStage {
  title: string;
  substeps: string[];
}

export interface TestUIConfig {
  questions_per_block: number;
  auth_wall_question: number | null; // 0-based index, null = no auth wall
  welcome_stats: WelcomeStat[];
  welcome_title?: string;
  welcome_subtitle?: string;
  welcome_description?: string;
  welcome_badge?: string;
  welcome_cta?: string;
  welcome_meta?: string;
  block_insights: string[];
  quick_answer_labels: string[];
  radar_labels: Record<string, string[]>;
  analyzing_stages?: AnalyzingStage[];
  timeframe_text?: string;
}

export interface TestConfig {
  id: string;
  program_id: string;
  slug: string;
  title: string;
  short_title: string | null;
  description: string | null;
  questions: TestQuestion[];
  total_questions: number;
  scales: TestScale[];
  scoring: TestScoringConfig;
  ui_config: TestUIConfig;
  interpretation_prompt: string | null;
  mini_analysis_prompt_template: string | null;
  is_active: boolean;
}

/** Derive scale order from scales array sorted by `order` field */
export function getScaleOrder(config: TestConfig): string[] {
  return [...config.scales].sort((a, b) => a.order - b.order).map((s) => s.key);
}

/** Derive scale names map from scales array */
export function getScaleNames(config: TestConfig): Record<string, string> {
  const names: Record<string, string> = {};
  for (const s of config.scales) {
    names[s.key] = s.name;
  }
  return names;
}

/** Number of blocks = ceil(total_questions / questions_per_block) */
export function getTotalBlocks(config: TestConfig): number {
  return Math.ceil(
    config.total_questions / config.ui_config.questions_per_block
  );
}
