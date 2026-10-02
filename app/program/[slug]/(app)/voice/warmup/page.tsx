import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { requireProgramFeature } from "@/lib/queries/program";
import { getVoiceModeByTool, hasVoiceAccess } from "@/lib/queries/voice";
import { WarmupScreen } from "@/components/voice-practice/WarmupScreen";

export const dynamic = "force-dynamic";

// «Первые слова»: статичный маршрут, приоритетнее /voice/[tool]. Каждая реплика — короткая
// живая сессия на движке звонка (как «Трудный момент»), подсказка — /api/practice/warmup/answer.
export default async function WarmupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { id: programId } = await requireProgramFeature(supabase, slug, "voice");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?redirect=/program/${slug}/voice/warmup`);
  if (!(await hasVoiceAccess(user.id, programId))) redirect(`/program/${slug}/hub`);

  const mode = await getVoiceModeByTool(programId, "warmup");
  if (!mode || mode.comingSoon || !mode.moments.length) redirect(`/program/${slug}/hub`);
  // display_name — «Вера, 34 года»; в репликах разминки нужно только имя.
  const client = mode.clients.find((c) => c.slug === mode.moments[0].clientSlug);

  // Тексты реплик и условия реакции на клиент не уходят — только номера моментов.
  return (
    <WarmupScreen
      programSlug={slug}
      modeKey={mode.key}
      momentIds={mode.moments.map((m) => m.id)}
      clientName={client?.displayName.split(",")[0] ?? "Клиент"}
    />
  );
}
