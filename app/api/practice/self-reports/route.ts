// Самоотчёты студента: анкета первого входа, уверенность «до» и «после».
// Запись — service role (у таблицы только политика чтения для владельца).
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { apiError, requireAuth } from "@/lib/api-helpers";
import { createRateLimit } from "@/lib/rate-limit";
import { practiceDay } from "@/lib/voice-practice/day";
import {
  ANKETA_QUESTIONS,
  MAX_ANSWER_LENGTH,
  fearFromProblem,
  parseConfidence,
} from "@/lib/voice-practice/self-report";

export const dynamic = "force-dynamic";

const limiter = createRateLimit({ windowMs: 60_000, max: 10 });
const KINDS = ["anketa", "confidence_pre", "confidence_post"] as const;
type Kind = (typeof KINDS)[number];

interface ReportIn {
  kind?: string;
  answers?: unknown;
  sessionId?: string;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { user, response } = await requireAuth(supabase);
  if (response) return response;
  if (!limiter(user.id)) return apiError("Слишком часто, подождите минуту", 429);

  const body = (await req.json().catch(() => null)) as { programSlug?: string; reports?: ReportIn[] } | null;
  const reports = Array.isArray(body?.reports) ? body.reports : [];
  if (!body?.programSlug || reports.length === 0 || reports.length > 2) return apiError("Не хватает данных", 400);

  const db = createServiceClient();
  const { data: program } = await db.from("programs").select("id, features").eq("slug", body.programSlug).single();
  if (!program || !(program.features as { voice?: boolean } | null)?.voice) return apiError("Не найдено", 404);
  const { data: access } = await db
    .from("voice_access")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .maybeSingle();
  if (!access) return apiError("Доступ к практикуму выдаёт куратор", 403, { code: "no_access" });

  const day = practiceDay();
  const rows: { kind: Kind; answers: Record<string, unknown>; sum: number | null; session_id: string | null }[] = [];
  for (const r of reports) {
    if (!KINDS.includes(r.kind as Kind)) return apiError("Неизвестный тип ответа", 400);
    const kind = r.kind as Kind;
    if (kind === "anketa") {
      const a = (r.answers ?? {}) as Record<string, unknown>;
      const answers: Record<string, string | null> = {};
      for (const q of ANKETA_QUESTIONS) {
        const v = typeof a[q.key] === "string" ? (a[q.key] as string).trim().slice(0, MAX_ANSWER_LENGTH) : "";
        if (!v) return apiError("Ответьте на все три вопроса", 400);
        answers[q.key] = v;
      }
      answers.problem_fear = fearFromProblem(answers.problem);
      rows.push({ kind, answers, sum: null, session_id: null });
    } else {
      const c = parseConfidence(r.answers);
      if (!c) return apiError("Отметьте все три утверждения от 0 до 10", 400);
      let sessionId: string | null = null;
      if (kind === "confidence_post" && r.sessionId) {
        const { data: s } = await db
          .from("voice_sessions")
          .select("id")
          .eq("id", r.sessionId)
          .eq("user_id", user.id)
          .eq("program_id", program.id)
          .maybeSingle();
        sessionId = s?.id ?? null;
      }
      rows.push({ kind, answers: c, sum: c.c1 + c.c2 + c.c3, session_id: sessionId });
    }
  }

  const saved: Kind[] = [];
  const skipped: Kind[] = [];
  for (const row of rows) {
    const { error } = await db
      .from("voice_self_reports")
      .insert({ ...row, user_id: user.id, program_id: program.id, day });
    // Уверенность — не чаще раза в день (уникальный индекс): повтор не ошибка.
    if (error?.code === "23505") skipped.push(row.kind);
    else if (error) return apiError("Не удалось сохранить, попробуйте ещё раз", 500);
    else saved.push(row.kind);
  }
  return Response.json({ ok: true, saved, skipped });
}
