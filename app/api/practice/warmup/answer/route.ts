// «Первые слова»: подсказка после попытки. Попытка — короткая живая сессия (kind=drill):
// Вера сказала реплику, студент ответил, Вера отреагировала голосом. Здесь — только карточка
// «получилось / попробуйте» по расшифровке из voice_turns, без аудио (~1 с).
// Условия реакции и рубрика — app_config.voice_warmup_lines (тексты вне git).
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { apiError, requireAuth } from "@/lib/api-helpers";
import { createRateLimit } from "@/lib/rate-limit";
import { hasVoiceAccess } from "@/lib/queries/voice";
import { DEFAULT_WARMUP_SET, getWarmupConfig, splitAttempt, warmupVerdict, type WarmupTurn } from "@/lib/voice-practice/warmup";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const limiter = createRateLimit({ windowMs: 60_000, max: 20 });
/** Реплика студента пишется в voice_turns без ожидания — если её ещё нет, читаем ещё раз. */
const TURNS_RETRY_MS = 800;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { user, response } = await requireAuth(supabase);
  if (response) return response;
  if (!limiter(user.id)) return apiError("Слишком часто, подождите минуту", 429);

  const body = (await req.json().catch(() => null)) as { sessionId?: string } | null;
  if (!body?.sessionId) return apiError("Не хватает данных", 400);

  const db = createServiceClient();
  const { data: s } = await db
    .from("voice_sessions")
    .select("id, program_id, program_mode_id, drill_moment_id, programs!inner(features)")
    .eq("id", body.sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!s?.drill_moment_id) return apiError("Не найдено", 404);
  if (!(s.programs as unknown as { features: { voice?: boolean } | null }).features?.voice) return apiError("Не найдено", 404);
  if (!(await hasVoiceAccess(user.id, s.program_id))) {
    return apiError("Доступ к практикуму выдаёт куратор", 403, { code: "no_access" });
  }

  const loadTurns = async () =>
    ((await db.from("voice_turns").select("seq, role, text").eq("session_id", s.id).order("seq")).data ?? []) as WarmupTurn[];
  const [{ data: mode }, cfg, firstTurns] = await Promise.all([
    db.from("voice_modes").select("drill_moments").eq("program_mode_id", s.program_mode_id).maybeSingle(),
    getWarmupConfig(),
    loadTurns(),
  ]);
  const moment = ((mode?.drill_moments as { id: string; n?: number }[] | null) ?? []).find((m) => m.id === s.drill_moment_id);
  const set = cfg?.sets[DEFAULT_WARMUP_SET];
  const line = set?.lines.find((l) => l.n === moment?.n);
  if (!cfg || !set || !line) return apiError("Реплика не найдена", 404);

  let { answer, reply } = splitAttempt(firstTurns);
  if (!answer) {
    await new Promise((r) => setTimeout(r, TURNS_RETRY_MS));
    ({ answer, reply } = splitAttempt(await loadTurns()));
  }
  // Меньше двух слов — ответа не было (эхо, «угу»).
  if (answer.split(/\s+/).filter(Boolean).length < 2) {
    return Response.json({ speech: false, lineText: line.line });
  }

  try {
    const t0 = Date.now();
    const v = await warmupVerdict(cfg.rubric, set.client_name, line, answer, reply);
    console.log("[warmup] card", { modelMs: Date.now() - t0 });
    return Response.json({
      speech: true,
      transcript: answer,
      clientReply: reply,
      lineText: line.line,
      reaction: v.reaction,
      got: v.got,
      try: v.try,
      flags: { reflection: !!v.reflection, openQ: !!v.open_q, why: !!v.why, advice: !!v.advice },
    });
  } catch (e) {
    console.error("[warmup] card failed", e);
    return Response.json({ speech: true, transcript: answer, clientReply: reply, lineText: line.line, cardFailed: true });
  }
}
