import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { requireProgramFeature } from "@/lib/queries/program";
import { getVoiceModeByTool, hasVoiceAccess } from "@/lib/queries/voice";
import { PrecallScreen } from "@/components/voice-practice/PrecallScreen";

export const dynamic = "force-dynamic";

export default async function VoiceModePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; tool: string }>;
  searchParams: Promise<{ moment?: string }>;
}) {
  const { slug, tool } = await params;
  const { moment } = await searchParams;
  const supabase = await createClient();
  const { id: programId } = await requireProgramFeature(supabase, slug, "voice");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?redirect=/program/${slug}/voice/${tool}`);
  if (!(await hasVoiceAccess(user.id, programId))) redirect(`/program/${slug}/hub`);

  const mode = await getVoiceModeByTool(programId, tool);
  if (!mode) notFound();
  if (mode.comingSoon || mode.clients.length === 0) redirect(`/program/${slug}/hub`);

  return (
    <PrecallScreen
      programSlug={slug}
      modeKey={mode.key}
      modeName={mode.name}
      modeDescription={mode.description}
      precallText={mode.precallText}
      maxMinutes={Math.max(1, Math.round(mode.maxSeconds / 60))}
      clients={mode.clients}
      clientStarts={mode.clientStarts}
      moments={mode.moments}
      initialMoment={moment}
    />
  );
}
