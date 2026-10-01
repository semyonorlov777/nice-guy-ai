import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProgramCardData } from "@/components/programs/ProgramCard";

interface LandingDataMin {
  book?: {
    cover_url?: string;
    author_top?: string;
  };
  hero_subtitle?: string;
  hidden_from_catalog?: boolean;
  short_description?: string;
  pricing?: {
    is_paid?: boolean;
    price_rub?: number;
    price_label?: string;
  };
}

export const getProgramsForCatalog = cache(
  async (supabase: SupabaseClient): Promise<ProgramCardData[]> => {
    const { data } = await supabase
      .from("programs")
      .select("slug, title, landing_data")
      .order("created_at");

    if (!data) return [];

    return data
      .filter((p) => (p.landing_data as LandingDataMin | null)?.hidden_from_catalog !== true)
      .map((p) => {
      const landing = p.landing_data as LandingDataMin | null;
      const pricing = landing?.pricing;
      return {
        slug: p.slug as string,
        title: p.title as string,
        author: landing?.book?.author_top ?? null,
        coverUrl: landing?.book?.cover_url ?? null,
        description:
          landing?.short_description ?? landing?.hero_subtitle ?? null,
        isPaid: pricing?.is_paid === true,
        priceRub: pricing?.price_rub ?? null,
        priceLabel: pricing?.price_label ?? null,
      };
    });
  },
);
