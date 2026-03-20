import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { requireProgramFeature } from "@/lib/queries/program";

export default async function TestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  await requireProgramFeature(supabase, slug, "test");

  redirect(`/program/${slug}/test/issp`);
}
