import type { SupabaseClient } from "@supabase/supabase-js";
import type { WelcomeReply, WelcomeConfig } from "@/types/welcome";

export interface ProgramTheme {
  key: string;
  title: string;
  description: string | null;
  icon_key: string;
  sort_order: number;
  welcome_mode_label: string | null;
  welcome_title: string | null;
  welcome_subtitle: string | null;
  welcome_ai_message: string | null;
  welcome_replies: WelcomeReply[];
  welcome_system_context: string | null;
  issp_scale_key: string | null;
}

/**
 * Загружает все включённые темы для программы, отсортированные по sort_order.
 */
export async function getProgramThemes(
  supabase: SupabaseClient,
  programId: string,
): Promise<ProgramTheme[]> {
  const { data, error } = await supabase
    .from("program_themes")
    .select(
      "key, title, description, icon_key, sort_order, welcome_mode_label, welcome_title, welcome_subtitle, welcome_ai_message, welcome_replies, welcome_system_context, issp_scale_key",
    )
    .eq("program_id", programId)
    .eq("enabled", true)
    .order("sort_order");

  if (error || !data) return [];

  return data.map((row) => ({
    ...row,
    welcome_replies: (row.welcome_replies as WelcomeReply[]) ?? [],
  }));
}

/**
 * Сортирует темы по баллам ISSP-теста (наивысший балл первый).
 * Если баллов нет — возвращает в порядке sort_order.
 */
export function getThemesOrdered(
  themes: ProgramTheme[],
  testScores?: Record<string, number> | null,
): ProgramTheme[] {
  if (!testScores) return themes;

  return [...themes].sort((a, b) => {
    const scoreA = testScores[a.issp_scale_key ?? a.key] ?? 0;
    const scoreB = testScores[b.issp_scale_key ?? b.key] ?? 0;
    return scoreB - scoreA;
  });
}

/**
 * Преобразует тему в WelcomeConfig для NewChatScreen.
 */
export function themeToWelcomeConfig(theme: ProgramTheme): WelcomeConfig {
  return {
    modeLabel: theme.welcome_mode_label ?? "Работа с темой",
    title: theme.welcome_title ?? theme.title,
    subtitle: theme.welcome_subtitle ?? theme.description ?? "",
    aiMessage: theme.welcome_ai_message ?? "",
    replies: theme.welcome_replies,
    systemContext: theme.welcome_system_context ?? undefined,
  };
}
