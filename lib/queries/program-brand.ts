import { cache } from "react";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase-server";

/** Способы входа, которые умеет AuthSheet. */
export type AuthProvider = "yandex" | "google" | "telegram" | "email";

const KNOWN_PROVIDERS: AuthProvider[] = ["yandex", "google", "telegram", "email"];

/**
 * Собственный бренд программы (например, практикум института):
 * своё название вместо бренда платформы и свой набор способов входа.
 * null — у программы нет своего бренда, всё как у книг.
 */
export interface ProgramBrand {
  slug: string;
  brandName: string;
  /** Разрешённые способы входа; null — все. */
  providers: AuthProvider[] | null;
  voice: boolean;
}

interface LandingDataBrand {
  brand_name?: string;
  auth_providers?: string[];
}

/** Обёрнут в React.cache: layout и страница в одном запросе спрашивают один раз. */
export const getProgramBrand = cache(async (slug: string): Promise<ProgramBrand | null> => {
  const { data } = await createServiceClient()
    .from("programs")
    .select("slug, landing_data, features")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;

  const landing = data.landing_data as LandingDataBrand | null;
  const brandName = landing?.brand_name?.trim();
  if (!brandName) return null;

  const providers = Array.isArray(landing?.auth_providers)
    ? KNOWN_PROVIDERS.filter((p) => landing.auth_providers!.includes(p))
    : null;

  return {
    slug: data.slug as string,
    brandName,
    providers: providers && providers.length > 0 ? providers : null,
    voice: (data.features as { voice?: boolean } | null)?.voice === true,
  };
});

/** slug программы из адреса вида /program/<slug>/... ; иначе null. */
export function programSlugFromPath(path: string | null | undefined): string | null {
  const m = path?.match(/^\/program\/([a-z0-9-]+)(?:[/?#]|$)/);
  return m ? m[1] : null;
}

/**
 * Заголовок вкладки для страниц кабинета: у голосовой программы со своим брендом —
 * её название вместо «Онлайн-тренажёры по книгам». Остальным — как было (пусто).
 */
export async function programBrandMetadata(slug: string): Promise<Metadata> {
  const brand = await getProgramBrand(slug);
  if (!brand?.voice) return {};
  return { title: brand.brandName, description: brand.brandName };
}
