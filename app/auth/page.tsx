import type { Metadata } from "next";
import { getProgramBrand, programSlugFromPath } from "@/lib/queries/program-brand";
import { AuthPageClient } from "./AuthPageClient";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Вход в программу со своим брендом (практикум института) — её название
// и только её способы входа. Остальные программы — как раньше.
async function brandFor(searchParams: SearchParams) {
  const { redirect } = await searchParams;
  const slug = programSlugFromPath(typeof redirect === "string" ? redirect : null);
  return slug ? getProgramBrand(slug) : null;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const brand = await brandFor(searchParams);
  return brand ? { title: `Вход · ${brand.brandName}` } : {};
}

export default async function AuthPage({ searchParams }: { searchParams: SearchParams }) {
  const brand = await brandFor(searchParams);
  return (
    <AuthPageClient
      brandName={brand?.brandName}
      providers={brand?.providers ?? undefined}
    />
  );
}
