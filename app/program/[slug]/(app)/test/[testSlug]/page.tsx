import { createClient } from "@/lib/supabase-server";
import { requireProgramFeature } from "@/lib/queries/program";
import { getTestConfig } from "@/lib/queries/test-config";
import { notFound } from "next/navigation";
import { TestClient } from "./client";

export default async function TestPage({
  params,
}: {
  params: Promise<{ slug: string; testSlug: string }>;
}) {
  const { slug, testSlug } = await params;
  const supabase = await createClient();
  await requireProgramFeature(supabase, slug, "test");

  const testConfig = await getTestConfig(testSlug);
  if (!testConfig) notFound();

  return <TestClient testConfig={testConfig} />;
}
