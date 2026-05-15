import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProgramFeatures } from "@/types/program";

export interface ProgramSwitcherItem {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  author: string | null;
  features: ProgramFeatures | null;
}

interface LandingDataBook {
  book?: {
    cover_url?: string;
    author_top?: string;
  };
}

export async function getAllPrograms(
  supabase: SupabaseClient,
): Promise<ProgramSwitcherItem[]> {
  const { data } = await supabase
    .from("programs")
    .select("id, slug, title, landing_data, features")
    .order("created_at");

  if (!data) return [];

  return data.map((p) => {
    const landing = p.landing_data as LandingDataBook | null;
    return {
      id: p.id as string,
      slug: p.slug as string,
      title: p.title as string,
      coverUrl: landing?.book?.cover_url ?? null,
      author: landing?.book?.author_top ?? null,
      features: (p.features ?? null) as ProgramFeatures | null,
    };
  });
}
