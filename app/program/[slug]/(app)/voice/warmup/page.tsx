import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { requireProgramFeature } from "@/lib/queries/program";
import { hasVoiceAccess, isVoiceModeOpen } from "@/lib/queries/voice";
import { DEFAULT_WARMUP_SET, getWarmupConfig, warmupAudioBase } from "@/lib/voice-practice/warmup";
import { WarmupScreen } from "@/components/voice-practice/WarmupScreen";

export const dynamic = "force-dynamic";

// «Первые слова»: статичный маршрут, приоритетнее /voice/[tool]. Живого соединения нет —
// реплики записаны заранее, ответ оценивает /api/practice/warmup/answer.
export default async function WarmupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { id: programId } = await requireProgramFeature(supabase, slug, "voice");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?redirect=/program/${slug}/voice/warmup`);
  if (!(await hasVoiceAccess(user.id, programId))) redirect(`/program/${slug}/hub`);
  if (!(await isVoiceModeOpen(programId, "voice_warmup"))) redirect(`/program/${slug}/hub`);

  const set = (await getWarmupConfig())?.sets[DEFAULT_WARMUP_SET];
  if (!set?.lines.length) redirect(`/program/${slug}/hub`);

  // Тексты реплик на клиент не уходят — только номера и адрес звука.
  return (
    <WarmupScreen
      programSlug={slug}
      setId={DEFAULT_WARMUP_SET}
      lineNumbers={set.lines.map((l) => l.n)}
      clientName={set.client_name}
      audioBase={warmupAudioBase(DEFAULT_WARMUP_SET)}
    />
  );
}
