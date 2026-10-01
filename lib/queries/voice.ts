import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase-server";

export interface VoiceModeView {
  programModeId: string;
  key: string;
  name: string;
  description: string | null;
  comingSoon: boolean;
  precallText: string | null;
  maxSeconds: number;
  clients: { slug: string; displayName: string; level: string; summary: string }[];
  /** «Трудный момент»: список моментов (только публичные поля). */
  moments: { id: string; title: string; context: string; clientSlug: string }[];
}

/** Есть ли у пользователя доступ к голосовому практикуму программы. */
export const hasVoiceAccess = cache(async (userId: string, programId: string): Promise<boolean> => {
  const { data } = await createServiceClient()
    .from("voice_access")
    .select("user_id")
    .eq("user_id", userId)
    .eq("program_id", programId)
    .maybeSingle();
  return !!data;
});

/**
 * Режим практикума по хвосту адреса (/voice/<tool>) — только публичные поля.
 * Тексты инструкций (frame_prompt, prompt) сюда не попадают.
 */
export async function getVoiceModeByTool(programId: string, tool: string): Promise<VoiceModeView | null> {
  const db = createServiceClient();
  const { data: pm } = await db
    .from("program_modes")
    .select("id, enabled, config, mode_templates!inner(key, name, description, route_suffix, interaction)")
    .eq("program_id", programId)
    .eq("mode_templates.route_suffix", `/voice/${tool}`)
    .eq("mode_templates.interaction", "voice")
    .maybeSingle();
  if (!pm || !pm.enabled) return null;
  const mt = pm.mode_templates as unknown as { key: string; name: string; description: string | null };
  const voiceCfg = (pm.config as { voice?: { coming_soon?: boolean; max_seconds?: number } } | null)?.voice;

  const { data: mode } = await db
    .from("voice_modes")
    .select("precall_text, client_slugs, max_seconds, drill_moments")
    .eq("program_mode_id", pm.id)
    .maybeSingle();
  const slugs = (mode?.client_slugs as string[] | undefined) ?? [];
  const { data: clients } = slugs.length
    ? await db
        .from("voice_clients")
        .select("slug, display_name, level, summary_public, sort_order")
        .eq("program_id", programId)
        .eq("enabled", true)
        .in("slug", slugs)
        .order("sort_order")
    : { data: [] };

  return {
    programModeId: pm.id,
    key: mt.key,
    name: mt.name,
    description: mt.description,
    comingSoon: voiceCfg?.coming_soon === true || !mode,
    precallText: mode?.precall_text ?? null,
    maxSeconds: mode?.max_seconds ?? voiceCfg?.max_seconds ?? 0,
    moments: ((mode?.drill_moments as { id: string; title: string; context: string; client_slug: string }[] | null) ?? []).map(
      (m) => ({ id: m.id, title: m.title, context: m.context, clientSlug: m.client_slug }),
    ),
    clients: (clients ?? []).map((c) => ({
      slug: c.slug,
      displayName: c.display_name,
      level: c.level,
      summary: c.summary_public,
    })),
  };
}

export interface SelfReportRow {
  kind: "anketa" | "confidence_pre" | "confidence_post";
  day: string;
  answers: Record<string, unknown>;
  sum: number | null;
  created_at: string;
}

/**
 * Анкета и уверенность студента в программе, по времени (старые первыми).
 * Клиент с cookies: RLS пускает только владельца.
 */
export async function getSelfReports(
  supabase: SupabaseClient,
  userId: string,
  programId: string,
): Promise<SelfReportRow[]> {
  const { data } = await supabase
    .from("voice_self_reports")
    .select("kind, day, answers, sum, created_at")
    .eq("user_id", userId)
    .eq("program_id", programId)
    .in("kind", ["anketa", "confidence_pre", "confidence_post"])
    .order("created_at", { ascending: true })
    .limit(200);
  return (data ?? []) as SelfReportRow[];
}
