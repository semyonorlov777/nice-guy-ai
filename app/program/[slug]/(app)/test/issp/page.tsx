import { createClient } from "@/lib/supabase-server";
import { requireProgramFeature } from "@/lib/queries/program";
import { getTestConfigByProgram } from "@/lib/queries/test-config";
import { ISSPTestClient } from "./client";

export default async function ISSPTestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  await requireProgramFeature(supabase, slug, "test");

  const testConfig = await getTestConfigByProgram(slug);

  return <ISSPTestClient testConfig={testConfig} />;
}
