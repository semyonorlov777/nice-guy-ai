import { createClient } from "@/lib/supabase-server";
import { requireAuth, apiError } from "@/lib/api-helpers";
import {
  ANKETA_QUESTIONS,
  isAnketaProgram,
  type AnketaProgramSlug,
} from "@/lib/anketa/questions";
import { IDENTITY_QUESTION_IDS } from "@/lib/personalization";

const MAX_ANSWER_LENGTH = 4000;

type AnketaRequestBody = {
  programSlug?: string;
  answers?: Record<string, unknown>;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { user, response } = await requireAuth(supabase);
  if (response) return response;

  let body: AnketaRequestBody;
  try {
    body = (await req.json()) as AnketaRequestBody;
  } catch {
    return apiError("Невалидный JSON", 400);
  }

  const { programSlug, answers } = body;
  if (typeof programSlug !== "string" || !isAnketaProgram(programSlug)) {
    return apiError("Неизвестная программа", 400);
  }
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return apiError("answers обязателен", 400);
  }

  const validSlug: AnketaProgramSlug = programSlug;
  const allowedIds = new Set<string>(
    ANKETA_QUESTIONS[validSlug].map((q) => q.id),
  );
  const knownIds = new Set<string>(IDENTITY_QUESTION_IDS);

  const entries: Array<{ qid: string; text: string }> = [];
  for (const [qid, raw] of Object.entries(answers)) {
    if (!allowedIds.has(qid) || !knownIds.has(qid)) continue;
    if (typeof raw !== "string") continue;
    const text = raw.trim();
    if (!text) continue;
    entries.push({ qid, text: text.slice(0, MAX_ANSWER_LENGTH) });
  }

  if (entries.length === 0) {
    return apiError("Нет заполненных ответов", 400);
  }

  for (const { qid, text } of entries) {
    const { data: existing, error: selectError } = await supabase
      .from("user_profile_responses")
      .select("version")
      .eq("user_id", user.id)
      .eq("question_id", qid)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.error("[anketa] select max(version) error:", selectError);
      return apiError("Не удалось сохранить ответы", 500);
    }

    const nextVersion = (existing?.version ?? 0) + 1;

    const { error: insertError } = await supabase
      .from("user_profile_responses")
      .insert({
        user_id: user.id,
        question_id: qid,
        answer_text: text,
        version: nextVersion,
        source: "anketa",
      });

    if (insertError) {
      console.error("[anketa] insert error:", insertError);
      return apiError("Не удалось сохранить ответы", 500);
    }
  }

  return Response.json({
    ok: true,
    saved: entries.length,
    redirect: `/program/${programSlug}/hub`,
  });
}
