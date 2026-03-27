import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { requireProgramFeature } from "@/lib/queries/program";
import { getTestConfigByProgram } from "@/lib/queries/test-config";

export default async function TestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  await requireProgramFeature(supabase, slug, "test");

  const testConfig = await getTestConfigByProgram(slug);
  if (!testConfig) notFound();

  redirect(`/program/${slug}/test/${testConfig.slug}`);
}
