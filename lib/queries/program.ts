import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProgramFeatures } from "@/types/program";

/**
 * Загружает программу по slug и проверяет feature flag.
 * Если программа не найдена — redirect на /.
 * Если feature отключена — redirect на chat страницу программы.
 */
export async function requireProgramFeature(
  supabase: SupabaseClient,
  slug: string,
  feature: keyof ProgramFeatures,
): Promise<{ id: string; features: ProgramFeatures | null }> {
  const { data: program } = await supabase
    .from("programs")
    .select("id, features")
    .eq("slug", slug)
    .single();

  if (!program) redirect("/");

  const features = program.features as ProgramFeatures | null;
  if (!features?.[feature]) {
    redirect(`/program/${slug}/chat`);
  }

  return { id: program.id, features };
}
