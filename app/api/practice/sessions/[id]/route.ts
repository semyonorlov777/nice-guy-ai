// Состояние сессии для страницы звонка и разбора. Без текстов инструкций.
// Если сессия закончена, а разбор ещё не собран (или завис) — запускает его.
import { after } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { apiError, requireAuth } from "@/lib/api-helpers";
import { claimDebrief } from "@/lib/voice-practice/debrief";

export const dynamic = "force-dynamic";
export const maxDuration = 150; // разбор с повторной попыткой при несошедшихся цитатах

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, response } = await requireAuth(supabase);
  if (response) return response;

  // RLS: владелец читает свою сессию и разбор.
  const { data: s } = await supabase
    .from("voice_sessions")
    .select("id, status, end_reason, seconds_limit, seconds_used, started_at, ended_at, voice_debriefs(status, is_fallback, strength, fix, repeat, summary, counters, result)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!s) return apiError("Не найдено", 404);

  const d = (s.voice_debriefs as unknown as { status: string } | null) ?? null;
  if ((s.status === "ended" || s.status === "failed") && (!d || d.status === "queued" || d.status === "processing")) {
    const run = await claimDebrief(id);
    if (run) after(run);
  }
  return Response.json(s, { headers: { "Cache-Control": "no-store" } });
}
