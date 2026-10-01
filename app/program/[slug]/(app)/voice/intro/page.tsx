import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { requireProgramFeature } from "@/lib/queries/program";
import { getSelfReports, hasVoiceAccess } from "@/lib/queries/voice";
import { IntroFlow } from "@/components/voice-practice/IntroFlow";

export const dynamic = "force-dynamic";

// Первый вход в практикум. Анкета уже есть → на хаб (?again=1 — пройти заново).
export default async function VoiceIntroPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ again?: string }>;
}) {
  const { slug } = await params;
  const { again } = await searchParams;
  const supabase = await createClient();
  const { id: programId } = await requireProgramFeature(supabase, slug, "voice");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?redirect=/program/${slug}/voice/intro`);
  if (!(await hasVoiceAccess(user.id, programId))) redirect(`/program/${slug}/hub`);

  if (again !== "1") {
    const reports = await getSelfReports(supabase, user.id, programId);
    if (reports.some((r) => r.kind === "anketa")) redirect(`/program/${slug}/hub`);
  }
  return <IntroFlow programSlug={slug} />;
}
