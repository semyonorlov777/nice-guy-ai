import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProgramModeWithTemplate, LastActiveMode } from "@/types/modes";
import type { WelcomeConfig } from "@/types/welcome";
import { normalizeWelcomeReplies } from "@/types/welcome";

/**
 * Загружает все включённые режимы для программы, отсортированные по sort_order.
 */
export async function getProgramModes(
  supabase: SupabaseClient,
  programId: string,
): Promise<ProgramModeWithTemplate[]> {
  const { data, error } = await supabase
    .from("program_modes")
    .select(
      `
      sort_order,
      access_type,
      welcome_message,
      config,
      welcome_mode_label,
      welcome_title,
      welcome_subtitle,
      welcome_ai_message,
      welcome_replies,
      welcome_system_context,
      color_class,
      badge,
      mode_templates!inner (
        key,
        name,
        description,
        icon,
        chat_type,
        route_suffix,
        is_chat_based
      )
    `,
    )
    .eq("program_id", programId)
    .eq("enabled", true)
    .order("sort_order");

  if (error || !data) return [];

  return data.map((row) => {
    const mt = row.mode_templates as unknown as {
      key: string;
      name: string;
      description: string | null;
      icon: string;
      chat_type: string | null;
      route_suffix: string;
      is_chat_based: boolean;
    };
    return {
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
  });
}

/**
 * Возвращает последний активный режим пользователя в программе.
 * Выводится из chats.last_message_at через join на mode_templates.chat_type.
 */
export async function getLastActiveMode(
  supabase: SupabaseClient,
  userId: string,
  programId: string,
): Promise<LastActiveMode | null> {
  const { data, error } = await supabase
    .from("chats")
    .select("id, chat_type, last_message_at")
    .eq("user_id", userId)
    .eq("program_id", programId)
    .eq("status", "active")
    .not("last_message_at", "is", null)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.chat_type) return null;

  // Найти mode_template по chat_type
  const { data: mt } = await supabase
    .from("mode_templates")
    .select("key, name, icon, route_suffix")
    .eq("chat_type", data.chat_type)
    .maybeSingle();

  if (!mt) return null;

  return {
    key: mt.key,
    name: mt.name,
    icon: mt.icon,
    route_suffix: mt.route_suffix,
    last_at: data.last_message_at,
    chat_id: data.id,
  };
}

/**
 * Преобразует режим в WelcomeConfig для NewChatScreen.
 */
export function modeToWelcomeConfig(mode: ProgramModeWithTemplate): WelcomeConfig {
  const chatTypeMap: Record<string, string> = {
    free: "free",
    author: "author",
    exercise: "exercise",
    self_analysis: "self_analysis",
    partner_analysis: "partner_analysis",
    relationship_map: "relationship_map",
    theory: "theory",
    love_translator: "love_translator",
    roleplay: "roleplay",
  };

  return {
    modeLabel: mode.welcome_mode_label ?? mode.name,
    title: mode.welcome_title ?? mode.name,
    subtitle: mode.welcome_subtitle ?? mode.description ?? "",
    aiMessage: mode.welcome_ai_message ?? "",
    replies: mode.welcome_replies,
    chatType: mode.chat_type ? (chatTypeMap[mode.chat_type] ?? mode.chat_type) : undefined,
    systemContext: mode.welcome_system_context ?? undefined,
  };
}
