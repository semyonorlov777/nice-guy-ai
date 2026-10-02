// Голосовой разбор встречи: создать или продолжить — по кнопке «Начать разбор» (жест для звука на iPhone).
// Заодно запускает текстовый разбор встречи, если он ещё не считается: голоса опираются на него.
import { after } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { apiError, requireAuth } from "@/lib/api-helpers";
import { createRateLimit } from "@/lib/rate-limit";
import { claimDebrief } from "@/lib/voice-practice/debrief";
import { createOrResumeDebrief, type DebriefDenied } from "@/lib/voice-practice/debrief-voice";

export const dynamic = "force-dynamic";
export const maxDuration = 150; // текстовый разбор с повторной попыткой — в after()

const limiter = createRateLimit({ windowMs: 60_000, max: 10 });

const DENIED: Record<DebriefDenied, [number, string]> = {
  not_found: [404, "Встреча не найдена"],
  not_full: [409, "Голосовой разбор — только после полной встречи"],
  not_ended: [409, "Встреча ещё идёт"],
  mode_off: [409, "В этом режиме разбор — текстом"],
  too_short: [409, "Встреча получилась слишком короткой для разбора голосом"],
  safety: [409, "Эту встречу лучше разобрать текстом"],
  done: [409, "Разбор этой встречи уже прошёл"],
  busy: [409, "Сейчас идёт другая учебная консультация"],
};

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, response } = await requireAuth(supabase);
  if (response) return response;
  if (!limiter(user.id)) return apiError("Слишком часто, подождите минуту", 429);

  const db = createServiceClient();
  const r = await createOrResumeDebrief(db, user.id, id);
  if (!r.ok) {
    const [status, message] = DENIED[r.reason];
    return apiError(message, status, { code: r.reason });
  }
  const run = await claimDebrief(id);
  if (run) after(run);
  return Response.json({ sessionId: r.sessionId, ticket: r.ticket, resumed: r.resumed });
}
