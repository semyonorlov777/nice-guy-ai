// «Первые слова»: ответ студента (аудио) → расшифровка и оценка одним вызовом Gemini Flash →
// реакция клиента (warm | neutral | cold) + «получилось» / «попробуйте».
// Без списания токенов и без квоты; аудио нигде не сохраняется.
import { lowThinking, withModelFallback } from "@/lib/voice-practice/models";
import { GoogleGenAI, Type, type Part } from "@google/genai";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { apiError, requireAuth } from "@/lib/api-helpers";
import { createRateLimit } from "@/lib/rate-limit";
import { hasVoiceAccess } from "@/lib/queries/voice";
import { DEFAULT_WARMUP_SET, getWarmupConfig, type WarmupReaction } from "@/lib/voice-practice/warmup";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Разминка ждёт ответа в реальном времени: 2.5-flash отвечает за ~1 с и не перегружен,
// 3.8-flash — 2–5 с и сейчас часто 503. Поэтому быстрый — основной.
const MODEL = process.env.VOICE_WARMUP_MODEL || "gemini-2.5-flash";
const MAX_BYTES = 2 * 1024 * 1024; // 20 с opus/aac — около 100 КБ, запас на кодеки без сжатия
const limiter = createRateLimit({ windowMs: 60_000, max: 20 });

// Этап 1 — только реакция клиента (маленький ответ, ~1 с): клиент отвечает почти сразу.
const REACT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    transcript: { type: Type.STRING },
    speech: { type: Type.BOOLEAN },
    reaction: { type: Type.STRING, enum: ["warm", "neutral", "cold"] },
  },
  required: ["transcript", "speech", "reaction"],
};

// Этап 2 — карточка «получилось / попробуйте» по расшифровке; готовится, пока звучит реакция.
const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    transcript: { type: Type.STRING },
    speech: { type: Type.BOOLEAN },
    reaction: { type: Type.STRING, enum: ["warm", "neutral", "cold"] },
    got: { type: Type.STRING },
    try: { type: Type.STRING },
    reflection: { type: Type.BOOLEAN },
    open_q: { type: Type.BOOLEAN },
    why: { type: Type.BOOLEAN },
    advice: { type: Type.BOOLEAN },
  },
  required: ["transcript", "speech", "reaction", "got", "try", "reflection", "open_q", "why", "advice"],
};

interface Verdict {
  transcript: string;
  speech: boolean;
  reaction: WarmupReaction;
  got: string;
  try: string;
  reflection: boolean;
  open_q: boolean;
  why: boolean;
  advice: boolean;
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const supabase = await createClient();
  const { user, response } = await requireAuth(supabase);
  if (response) return response;
  if (!limiter(user.id)) return apiError("Слишком часто, подождите минуту", 429);

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  const programSlug = String(form?.get("programSlug") ?? "");
  const setId = String(form?.get("set") ?? DEFAULT_WARMUP_SET);
  const n = Number(form?.get("n"));
  const stage = String(form?.get("stage") ?? "react") === "card" ? "card" : "react";
  const cardTranscript = String(form?.get("transcript") ?? "").slice(0, 2000);
  const cardReaction = String(form?.get("reaction") ?? "");
  if (!programSlug || !Number.isInteger(n)) return apiError("Не хватает данных", 400);
  if (stage === "card" && !cardTranscript.trim()) return apiError("Не хватает данных", 400);
  if (stage === "react" && !(audio instanceof Blob)) return apiError("Не хватает данных", 400);
  if (audio instanceof Blob && (audio.size === 0 || audio.size > MAX_BYTES)) return apiError("Запись слишком длинная или пустая", 400);
  // MediaRecorder: Chrome — audio/webm;codecs=opus, Safari — audio/mp4. Gemini параметры кодека не нужны.
  const mimeType = audio instanceof Blob ? (audio.type || "audio/webm").split(";")[0].trim() : "";
  if (stage === "react" && !mimeType.startsWith("audio/") && mimeType !== "video/webm" && mimeType !== "video/mp4") {
    return apiError("Нужна аудиозапись", 400);
  }

  const db = createServiceClient();
  const [{ data: program }, cfg] = await Promise.all([
    db.from("programs").select("id, features").eq("slug", programSlug).maybeSingle(),
    getWarmupConfig(),
  ]);
  if (!program || !(program.features as { voice?: boolean } | null)?.voice) return apiError("Не найдено", 404);
  if (!(await hasVoiceAccess(user.id, program.id))) {
    return apiError("Доступ к практикуму выдаёт куратор", 403, { code: "no_access" });
  }

  const set = cfg?.sets[setId];
  const line = set?.lines.find((l) => l.n === n);
  if (!cfg || !set || !line) return apiError("Реплика не найдена", 404);

  const task = [
    `Учебный клиент: ${set.client_name}. Что тренируем на этой реплике: ${line.focus}.`,
    `Реплика клиента: «${line.line}»`,
    `Реакция warm, если: ${line.warm_if}`,
    `Реакция neutral, если: ${line.neutral_if}`,
    `Реакция cold, если: ${line.cold_if}`,
    `Пример хорошего ответа (для ориентира, студенту дословно не повторять): «${line.example}»`,
    `В аудио — ответ студента на эту реплику. Расшифровывай только то, что реально слышно. Если в записи шум, тишина или неразборчиво — speech=false и пустой transcript; ничего не додумывай.`,
    `Верни JSON по схеме.`,
  ].join("\n");

  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });
  const tPrep = Date.now() - t0;
  const ask = (parts: Part[], schema: object, maxOutputTokens: number) =>
    withModelFallback(
      MODEL,
      (model) =>
        ai.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: {
            systemInstruction: cfg.rubric,
            responseMimeType: "application/json",
            responseSchema: schema,
            maxOutputTokens,
            thinkingConfig: lowThinking(model),
          },
        }),
      "warmup",
    );

  // Этап 2: карточка по уже известной расшифровке — без аудио.
  if (stage === "card") {
    try {
      const t1 = Date.now();
      const { result: r } = await ask(
        [{ text: `${task}\n\nОтвет студента уже расшифрован: «${cardTranscript}». Реакция клиента уже выбрана: ${cardReaction || "по критериям"}. Аудио нет — оцени по тексту.` }],
        SCHEMA,
        1024,
      );
      console.log("[warmup] card", { prepMs: tPrep, modelMs: Date.now() - t1 });
      const v = JSON.parse(r.text ?? "") as Verdict;
      return Response.json({
        got: v.got,
        try: v.try,
        flags: { reflection: !!v.reflection, openQ: !!v.open_q, why: !!v.why, advice: !!v.advice },
        lineText: line.line,
      });
    } catch (e) {
      console.error("[warmup] card failed", e);
      return apiError("Не удалось собрать подсказку", 502, { code: "eval_failed" });
    }
  }

  // Этап 1: только расшифровка и реакция — чтобы клиент ответил почти сразу.
  let verdict: Pick<Verdict, "transcript" | "speech" | "reaction">;
  try {
    const audioB64 = Buffer.from(await (audio as Blob).arrayBuffer()).toString("base64");
    const t1 = Date.now();
    const { result: r } = await ask(
      [{ inlineData: { mimeType, data: audioB64 } }, { text: `${task}\nСейчас нужны только transcript, speech и reaction.` }],
      REACT_SCHEMA,
      400,
    );
    console.log("[warmup] react", { prepMs: tPrep, modelMs: Date.now() - t1 });
    verdict = JSON.parse(r.text ?? "");
  } catch (e) {
    console.error("[warmup] evaluation failed", e);
    return apiError("Не удалось оценить ответ. Попробуйте ещё раз", 502, { code: "eval_failed" });
  }

  if (!verdict.speech || !verdict.transcript?.trim()) {
    return Response.json({ speech: false, transcript: "" });
  }
  const reaction: WarmupReaction = ["warm", "neutral", "cold"].includes(verdict.reaction) ? verdict.reaction : "neutral";
  return Response.json({ speech: true, transcript: verdict.transcript.trim(), reaction, lineText: line.line });
}
