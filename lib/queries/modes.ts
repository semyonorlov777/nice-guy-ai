import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProgramModeWithTemplate, LastActiveMode } from "@/types/modes";

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
