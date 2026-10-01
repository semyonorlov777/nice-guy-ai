import type { Metadata } from "next";
import { getProgramBrand, programSlugFromPath } from "@/lib/queries/program-brand";
import { ConfirmClient } from "./ConfirmClient";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Подтверждение входа по ссылке из письма. Для программы со своим брендом
// (практикум) — её название во вкладке и тексты на «вы».
async function brandFor(searchParams: SearchParams) {
  const { redirect } = await searchParams;
  const slug = programSlugFromPath(typeof redirect === "string" ? redirect : null);
  return slug ? getProgramBrand(slug) : null;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const brand = await brandFor(searchParams);
  return brand ? { title: `Вход · ${brand.brandName}` } : {};
}

export default async function ConfirmPage({ searchParams }: { searchParams: SearchParams }) {
  const brand = await brandFor(searchParams);
  return <ConfirmClient formal={!!brand} />;
}
