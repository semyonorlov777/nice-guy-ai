import type { SupabaseClient } from "@supabase/supabase-js";
import type { WelcomeConfig } from "@/types/welcome";
import { normalizeWelcomeReplies } from "@/types/welcome";
import { themeToWelcomeConfig } from "@/lib/queries/themes";
import { modeToWelcomeConfig } from "@/lib/queries/modes";
import type { ProgramModeWithTemplate } from "@/types/modes";

/**
 * Получает WelcomeConfig из БД по topic или tool.
 * Заменяет хардкод из lib/welcome-config.ts.
 */
export async function getWelcomeConfig(
  supabase: SupabaseClient,
  programId: string,
  params: { topic?: string; tool?: string },
): Promise<WelcomeConfig> {
  // 1. По теме
  if (params.topic) {
    const { data: theme } = await supabase
      .from("program_themes")
      .select(
        "key, title, description, icon_key, sort_order, welcome_mode_label, welcome_title, welcome_subtitle, welcome_ai_message, welcome_replies, welcome_system_context, test_scale_key",
      )
      .eq("program_id", programId)
      .eq("key", params.topic)
      .eq("enabled", true)
      .maybeSingle();

    if (theme) {
      return themeToWelcomeConfig({
        ...theme,
        welcome_replies: normalizeWelcomeReplies(theme.welcome_replies),
      });
    }
  }

  // 2. По инструменту (tool key → mode_template key mapping)
  if (params.tool) {
    // Known aliases where URL key differs from DB key beyond simple hyphen→underscore
    const toolAliases: Record<string, string> = {
      author: "author_chat",
      selfcheck: "self_work",
    };
    // First check aliases, then auto-convert hyphens to underscores
    const modeKey = toolAliases[params.tool] ?? params.tool.replace(/-/g, "_");

    const { data: row } = await supabase
      .from("program_modes")
      .select(
        `
        sort_order, access_type, welcome_message, config,
        welcome_mode_label, welcome_title, welcome_subtitle,
        welcome_ai_message, welcome_replies, welcome_system_context,
        color_class, badge,
        mode_templates!inner (
          key, name, description, icon, chat_type, route_suffix, is_chat_based
        )
      `,
      )
      .eq("program_id", programId)
      .eq("enabled", true)
      .eq("mode_templates.key", modeKey)
      .maybeSingle();

    if (row) {
      const mt = row.mode_templates as unknown as {
        key: string;
        name: string;
        description: string | null;
        icon: string;
        chat_type: string | null;
        route_suffix: string;
        is_chat_based: boolean;
      };
      const mode: ProgramModeWithTemplate = {
        key: mt.key,
        name: mt.name,
        description: mt.description,
        icon: mt.icon,
        chat_type: mt.chat_type,
        route_suffix: mt.route_suffix,
        is_chat_based: mt.is_chat_based,
        sort_order: row.sort_order,
        access_type: row.access_type as "free" | "paid",
        welcome_message: row.welcome_message,
        config: (row.config as Record<string, unknown>) ?? {},
        welcome_mode_label: row.welcome_mode_label ?? null,
        welcome_title: row.welcome_title ?? null,
        welcome_subtitle: row.welcome_subtitle ?? null,
        welcome_ai_message: row.welcome_ai_message ?? null,
        welcome_replies: normalizeWelcomeReplies(row.welcome_replies),
        welcome_system_context: row.welcome_system_context ?? null,
        color_class: (row.color_class as string) ?? "accent",
        badge: row.badge ?? null,
      };
      return modeToWelcomeConfig(mode);
    }
  }

  // 3. Fallback: free_chat mode
  const { data: fallback } = await supabase
    .from("program_modes")
    .select(
      `
      sort_order, access_type, welcome_message, config,
      welcome_mode_label, welcome_title, welcome_subtitle,
      welcome_ai_message, welcome_replies, welcome_system_context,
      color_class, badge,
      mode_templates!inner (
        key, name, description, icon, chat_type, route_suffix, is_chat_based
      )
    `,
    )
    .eq("program_id", programId)
    .eq("mode_templates.key", "free_chat")
    .maybeSingle();

  if (fallback) {
    const mt = fallback.mode_templates as unknown as {
      key: string;
      name: string;
      description: string | null;
      icon: string;
      chat_type: string | null;
      route_suffix: string;
      is_chat_based: boolean;
    };
    const mode: ProgramModeWithTemplate = {
      key: mt.key,
      name: mt.name,
      description: mt.description,
      icon: mt.icon,
      chat_type: mt.chat_type,
      route_suffix: mt.route_suffix,
      is_chat_based: mt.is_chat_based,
      sort_order: fallback.sort_order,
      access_type: fallback.access_type as "free" | "paid",
      welcome_message: fallback.welcome_message,
      config: (fallback.config as Record<string, unknown>) ?? {},
      welcome_mode_label: fallback.welcome_mode_label ?? null,
      welcome_title: fallback.welcome_title ?? null,
      welcome_subtitle: fallback.welcome_subtitle ?? null,
      welcome_ai_message: fallback.welcome_ai_message ?? null,
      welcome_replies: normalizeWelcomeReplies(fallback.welcome_replies),
      welcome_system_context: fallback.welcome_system_context ?? null,
      color_class: (fallback.color_class as string) ?? "accent",
      badge: fallback.badge ?? null,
    };
    return modeToWelcomeConfig(mode);
  }

  // Ultimate fallback (should never happen)
  return {
    modeLabel: "Свободный чат",
    title: "Просто поговорить",
    subtitle: "Без темы и ограничений",
    aiMessage: "",
    replies: [],
  };
}
