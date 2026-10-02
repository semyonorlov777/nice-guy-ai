// «Первые слова»: подсказка после попытки. Попытка — короткая живая сессия (kind=drill):
// Вера сказала реплику, студент ответил, Вера отреагировала голосом. Здесь — только карточка
// «получилось / попробуйте» по расшифровке из voice_turns, без аудио (~1 с).
// Условия реакции и рубрика — app_config.voice_warmup_lines (тексты вне git).
import { lowThinking, withModelFallback } from "@/lib/voice-practice/models";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { apiError, requireAuth } from "@/lib/api-helpers";
import { createRateLimit } from "@/lib/rate-limit";
import { hasVoiceAccess } from "@/lib/queries/voice";
import { DEFAULT_WARMUP_SET, getWarmupConfig, type WarmupReaction } from "@/lib/voice-practice/warmup";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// 2.5-flash отвечает за ~1 с и реже перегружен, чем 3.8-flash.
const MODEL = process.env.VOICE_WARMUP_MODEL || "gemini-2.5-flash";
const limiter = createRateLimit({ windowMs: 60_000, max: 20 });
/** Реплика студента пишется в voice_turns без ожидания — если её ещё нет, читаем ещё раз. */
const TURNS_RETRY_MS = 800;

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reaction: { type: Type.STRING, enum: ["warm", "neutral", "cold"] },
    got: { type: Type.STRING },
    try: { type: Type.STRING },
    reflection: { type: Type.BOOLEAN },
    open_q: { type: Type.BOOLEAN },
    why: { type: Type.BOOLEAN },
    advice: { type: Type.BOOLEAN },
  },
  required: ["reaction", "got", "try", "reflection", "open_q", "why", "advice"],
};

interface Verdict {
  reaction: WarmupReaction;
  got: string;
  try: string;
  reflection: boolean;
  open_q: boolean;
  why: boolean;
  advice: boolean;
}

type Turn = { seq: number; role: "student" | "client"; text: string };

/** Ответ студента — всё, что он сказал после первой реплики клиента; реакция — что клиент сказал после ответа. */
function splitAttempt(turns: Turn[]): { answer: string; reply: string } {
  const first = turns.findIndex((t) => t.role === "client");
  const after = first < 0 ? [] : turns.slice(first + 1);
  const firstStudent = after.findIndex((t) => t.role === "student");
  if (firstStudent < 0) return { answer: "", reply: "" };
  const rest = after.slice(firstStudent);
  const join = (role: Turn["role"]) => rest.filter((t) => t.role === role).map((t) => t.text).join(" ").trim();
  return { answer: join("student"), reply: join("client") };
}

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
    ((await db.from("voice_turns").select("seq, role, text").eq("session_id", s.id).order("seq")).data ?? []) as Turn[];
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

  const task = [
    `Учебный клиент: ${set.client_name}. Что тренируем на этой реплике: ${line.focus}.`,
    `Реплика клиента: «${line.line}»`,
    `Реакция warm, если: ${line.warm_if}`,
    `Реакция neutral, если: ${line.neutral_if}`,
    `Реакция cold, если: ${line.cold_if}`,
    `Пример хорошего ответа (для ориентира, студенту дословно не повторять): «${line.example}»`,
    `Ответ студента (расшифровка живой речи, возможны ошибки распознавания): «${answer}»`,
    reply ? `Клиент на это ответил голосом: «${reply}»` : "Клиент на ответ не отреагировал.",
    "Аудио нет — оценивай по тексту. reaction — как клиент отреагировал на самом деле, по его ответу и условиям выше.",
    "Верни JSON по схеме.",
  ].join("\n");

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });
    const t0 = Date.now();
    const { result: r } = await withModelFallback(
      MODEL,
      (model) =>
        ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: task }] }],
          config: {
            systemInstruction: cfg.rubric,
            responseMimeType: "application/json",
            responseSchema: SCHEMA,
            maxOutputTokens: 1024,
            thinkingConfig: lowThinking(model),
          },
        }),
      "warmup",
    );
    console.log("[warmup] card", { modelMs: Date.now() - t0 });
    const v = JSON.parse(r.text ?? "") as Verdict;
    const reaction: WarmupReaction = ["warm", "neutral", "cold"].includes(v.reaction) ? v.reaction : "neutral";
    return Response.json({
      speech: true,
      transcript: answer,
      clientReply: reply,
      lineText: line.line,
      reaction,
      got: v.got,
      try: v.try,
      flags: { reflection: !!v.reflection, openQ: !!v.open_q, why: !!v.why, advice: !!v.advice },
    });
  } catch (e) {
    console.error("[warmup] card failed", e);
    return Response.json({ speech: true, transcript: answer, clientReply: reply, lineText: line.line, cardFailed: true });
  }
}
