// Разбор учебной консультации: счётчики кодом → оценщик (Gemini, JSON) → проверка цитат кодом.
// Структура разбора — как в учебной тройке: клиент о том, как ему было, → наблюдатель
// (что сработало, что попробовать иначе) → один фокус на следующую попытку.
// ensureDebrief — единственная точка входа, идемпотентна: строку захватывает один вызов.
import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lowThinking, withModelFallback } from "./models";
import { createServiceClient } from "@/lib/supabase-server";
import { getConfig } from "@/lib/config";
import { computeClientFlags, computeCounters, type CodeCounters, type TurnLite } from "./counters";

const MODEL = process.env.VOICE_DEBRIEF_MODEL || "gemini-3.8-flash";
export const RUBRIC_VERSION = "2026-10-02.troika";
const MIN_STUDENT_TURNS = 2;

// Порядок полей важен: модель сначала находит поворотные моменты, потом пишет разбор.
const OUTPUT_SHAPE = `{
  "data_sufficient": true,
  "integrity": { "valid": true, "flags": [] },
  "turning_points": [{ "client_turn": "C9", "kind": "open|close|missed", "trigger_turn": "S8", "note": "..." }],
  "counters_model": { "open_q": 0, "closed_q": 0, "double_questions": [{ "turn": "S9", "quote": "..." }], "reflections_content": 0, "reflections_feeling": 0 },
  "counter_disputes": [],
  "position": { "advice_or_ready_solutions": { "ok": true, "turn": null, "quote": null }, "evaluation": { "ok": true, "turn": null, "quote": null }, "promises": { "ok": true, "turn": null, "quote": null } },
  "stages": [{ "stage": 1, "name": "Контакт и договорённость", "status": "present|partial|absent", "evidence": { "turn": "S3", "quote": "..." }, "missing": "..." }],
  "skills": [{ "id": "reflect_feeling", "name": "Отражение чувств", "tier": 1, "occasion": true, "level": 2, "evidence": [{ "turn": "S11", "quote": "..." }], "client_reaction": { "turn": "C12", "note": "..." } }],
  "hidden_layer": { "reached": false, "disclosed_at_turn": null, "trigger_turn": null, "trigger_quote": null, "closest_attempt_turn": null, "what_could_open": null },
  "safety": { "level": "none|watch|risk", "note": null },
  "feedback": {
    "client_voice": {
      "text": "Вся речь клиента, 2–4 предложения, от первого лица",
      "heard": { "turn": "S5", "quote": "...", "client_turn": "C6" },
      "closed": { "turn": "S9", "quote": "...", "client_turn": "C10" },
      "unsaid": "..."
    },
    "worked": [{ "turn": "S11", "quote": "...", "skill": "...", "effect": "...", "client_turn": "C12" }],
    "try": [{ "client_turn": "C7", "client_line": "...", "turn": "S8", "quote": "...", "skill": "...", "alternative": "...", "why": "..." }],
    "stuck_stage": { "stage": 3, "name": "Жалоба → запрос → цель", "note": "..." },
    "focus": { "text": "В следующий раз ...", "practice_turn": "C7", "client_line": "...", "skill": "..." }
  },
  "curator": { "headline": "...", "attention": ["..."], "ai_context": "..." }
}`;

interface Quote {
  turn?: string | null;
  quote?: string | null;
}
type Item = Quote & { skill?: string; effect?: string; client_turn?: string; [k: string]: unknown };

export interface DebriefFeedback {
  client_voice?: { text?: string; heard?: Item | null; closed?: Item | null; unsaid?: string | null } | null;
  worked?: Item[] | null;
  try?: Item[] | null;
  stuck_stage?: { stage?: number; name?: string; note?: string } | null;
  focus?: { text?: string; practice_turn?: string; client_line?: string; skill?: string } | null;
}

export type DebriefResult = Record<string, unknown> & {
  feedback?: DebriefFeedback;
  curator?: Record<string, unknown>;
  hidden_layer?: { reached?: boolean };
  integrity?: { valid?: boolean };
};

type LabeledTurn = TurnLite & { id: string; at: string };

export type DebriefInput =
  | { kind: "short"; counters: CodeCounters }
  | { kind: "ready"; counters: CodeCounters; labeled: LabeledTurn[]; userMessage: string };

/** Захватить разбор и запустить его. Возвращает функцию для after() или null, если не нужно. */
export async function claimDebrief(sessionId: string): Promise<(() => Promise<void>) | null> {
  const db = createServiceClient();
  await db.from("voice_debriefs").upsert({ session_id: sessionId, status: "queued" }, { onConflict: "session_id", ignoreDuplicates: true });
  const stale = new Date(Date.now() - 3 * 60_000).toISOString();
  const { data } = await db
    .from("voice_debriefs")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .or(`status.eq.queued,and(status.eq.processing,started_at.lt.${stale})`)
    .select("attempts")
    .maybeSingle();
  if (!data) return null;
  await db.from("voice_debriefs").update({ attempts: (data.attempts ?? 0) + 1 }).eq("session_id", sessionId);
  return () => runDebrief(sessionId);
}

/** Собрать вход оценщика: расшифровка с номерами ходов, карточка персонажа, счётчики. */
export async function prepareDebriefInput(db: SupabaseClient, sessionId: string): Promise<DebriefInput> {
  const { data: s } = await db
    .from("voice_sessions")
    .select("id, kind, client_id, program_mode_id, integrity_flags, status")
    .eq("id", sessionId)
    .single();
  const { data: turnsRaw } = await db
    .from("voice_turns")
    .select("seq, role, text, t_start_ms, t_end_ms")
    .eq("session_id", sessionId)
    .order("seq");
  const turns = (turnsRaw ?? []) as TurnLite[];
  const counters = computeCounters(turns);
  const clientFlags = computeClientFlags(turns);
  if (clientFlags.length) {
    await db.from("voice_sessions").update({ integrity_flags: clientFlags }).eq("id", sessionId);
  }
  if (!s || counters.student_turns < (s.kind === "drill" ? 1 : MIN_STUDENT_TURNS)) return { kind: "short", counters };

  const [{ data: client }, { data: pm }] = await Promise.all([
    s.client_id
      ? db.from("voice_clients").select("display_name, level, summary_public, prompt, hidden_layer, version").eq("id", s.client_id).single()
      : Promise.resolve({ data: null }),
    db.from("program_modes").select("config, mode_templates!inner(name, key)").eq("id", s.program_mode_id).single(),
  ]);
  const mt = pm?.mode_templates as unknown as { name: string; key: string } | undefined;
  // Режим оценки задаёт program_modes.config.voice.debrief_mode («closing» — только завершение встречи).
  const debriefMode = s.kind === "drill" ? "drill" : (pm?.config as { voice?: { debrief_mode?: string } } | null)?.voice?.debrief_mode ?? "full";

  let sN = 0;
  let cN = 0;
  const labeled = turns.map((t) => {
    const id = t.role === "student" ? `S${++sN}` : `C${++cN}`;
    const at = t.t_start_ms != null ? `${String(Math.floor(t.t_start_ms / 60000)).padStart(2, "0")}:${String(Math.floor((t.t_start_ms % 60000) / 1000)).padStart(2, "0")}` : "--:--";
    return { id, at, ...t };
  });

  const userMessage = [
    `РЕЖИМ: ${debriefMode} («${mt?.name ?? ""}»).`,
    `КАРТОЧКА ПЕРСОНАЖА (для оценщика, студент её не видел):\nУровень ${client?.level ?? "?"}. ${client?.display_name ?? ""}. ${client?.summary_public ?? ""}\nСкрытый слой: ${JSON.stringify(client?.hidden_layer ?? [])}\nОписание роли:\n${client?.prompt ?? ""}`,
    `СЧЁТЧИКИ ПРОГРАММЫ: ${JSON.stringify(counters)}`,
    `ОТМЕТКИ СБОЕВ КЛИЕНТА: ${JSON.stringify(clientFlags)}`,
    `УВЕРЕННОСТЬ СТУДЕНТА ДО СЕССИИ: null`,
    `РАСШИФРОВКА (распознана автоматически, возможны ошибки распознавания — не вини за них студента):\n${labeled.map((t) => `[${t.at} ${t.id}] ${t.text}`).join("\n")}`,
    `ФОРМА ОТВЕТА (JSON, поля и их порядок как в примере; лишних полей не добавляй):\n${OUTPUT_SHAPE}`,
  ].join("\n\n");
  return { kind: "ready", counters, labeled, userMessage };
}

/** Спросить оценщика. Один повтор, если JSON оборвался. */
export async function generateDebrief(
  rubric: string,
  userMessage: string,
): Promise<{ result: DebriefResult; usage: GenerateContentResponse["usageMetadata"] | null; model: string }> {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });
  // Длинная встреча (40+ реплик) не помещалась в 8k вместе с размышлениями модели —
  // ответ обрывался посреди JSON. Запас больше, размышления короче, одна повторная попытка.
  let usedModel = MODEL;
  const ask = async () => {
    const { result, model } = await withModelFallback(
      MODEL,
      (m) =>
        ai.models.generateContent({
          model: m,
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          config: {
            systemInstruction: rubric,
            responseMimeType: "application/json",
            maxOutputTokens: 32768,
            thinkingConfig: lowThinking(m),
          },
        }),
      "voice-debrief",
    );
    usedModel = model;
    return result;
  };
  const parse = (r: GenerateContentResponse) => JSON.parse((r.text ?? "").replace(/^```json\s*|\s*```$/g, "")) as DebriefResult;
  let resp = await ask();
  let result: DebriefResult;
  try {
    result = parse(resp);
  } catch {
    resp = await ask();
    result = parse(resp);
  }
  return { result, usage: resp.usageMetadata ?? null, model: usedModel };
}

// Распознавание иногда пишет русское слово латинскими буквами («A что», «no») — сводим похожие буквы.
const LATIN_LOOKALIKE: Record<string, string> = { a: "а", b: "в", c: "с", e: "е", h: "н", k: "к", m: "м", o: "о", p: "р", t: "т", x: "х", y: "у" };
const norm = (x: string) =>
  x
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[abcehkmoptxy]/g, (ch) => LATIN_LOOKALIKE[ch])
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
/** Цитата с пропуском («начало … конец») — каждый кусок должен быть в источнике, по порядку. */
function quoteIn(src: string, quote: string): boolean {
  const s = norm(src);
  let from = 0;
  for (const part of quote.split(/<?(?:\.\.\.|…)>?/).map(norm).filter(Boolean)) {
    const at = s.indexOf(part, from);
    if (at < 0) return false;
    from = at + part.length;
  }
  return from > 0;
}

/**
 * Проверка цитат: цитата студента должна быть в его реплике с этим номером (или хотя бы
 * где-то в его речи). Цитаты внутри речи клиента («Когда вы сказали „…“») ищутся по всей речи студента.
 * Возвращает колонки строки voice_debriefs, которые читают экран итога и страница куратора.
 */
export function checkFeedback(result: DebriefResult, labeled: LabeledTurn[]) {
  const byId = new Map(labeled.map((t) => [t.id, t.text]));
  const studentAll = labeled.filter((t) => t.role === "student").map((t) => t.text).join(" ");
  const verify = (q?: Quote | null) => {
    if (!q?.quote || !q.turn) return false;
    return quoteIn(byId.get(q.turn) ?? studentAll, q.quote);
  };
  const inlineQuotesOk = (text?: string) => [...(text ?? "").matchAll(/[«„“]([^»“”]{3,})[»“”]/g)].every((m) => quoteIn(studentAll, m[1]));

  const fb = result.feedback ?? {};
  const mark = (q?: Item | null) => (q ? { ...q, verified: verify(q) } : null);
  const cv = fb.client_voice
    ? { ...fb.client_voice, heard: mark(fb.client_voice.heard), closed: mark(fb.client_voice.closed), verified: inlineQuotesOk(fb.client_voice.text) }
    : null;
  const worked = (fb.worked ?? []).map((w) => ({ ...w, verified: verify(w) }));
  const tries = (fb.try ?? []).map((t) => ({ ...t, verified: verify(t) }));
  result.feedback = { ...fb, client_voice: cv, worked, try: tries };

  const w0 = worked[0];
  const t0 = tries[0];
  return {
    // strength/fix/repeat/summary — общий вид для куратора и старых экранов.
    strength: w0 ? { turn: w0.turn, quote: w0.quote, skill: w0.skill, why: w0.effect, client_turn: w0.client_turn, verified: w0.verified } : null,
    fix: t0 ?? null,
    repeat: fb.focus ? { turn: fb.focus.practice_turn, client_line: fb.focus.client_line, skill: fb.focus.skill } : null,
    summary: fb.focus?.text ?? null,
  };
}

/** Сколько цитат в главном блоке не нашлось в расшифровке (речь клиента, «сработало», «иначе»). */
function unverified(result: DebriefResult): number {
  const fb = result.feedback ?? {};
  const items = [fb.client_voice, ...(fb.worked ?? []), ...(fb.try ?? [])] as ({ verified?: boolean } | null | undefined)[];
  return items.filter((x) => x && x.verified === false).length;
}

/** Разбор с проверкой цитат: если что-то в главном блоке не сходится с расшифровкой — ещё одна попытка, берём точнее. */
export async function debriefChecked(rubric: string, input: Extract<DebriefInput, { kind: "ready" }>) {
  let best = await generateDebrief(rubric, input.userMessage);
  let cols = checkFeedback(best.result, input.labeled);
  let attempts = 1;
  if (unverified(best.result) > 0) {
    attempts = 2;
    const again = await generateDebrief(rubric, input.userMessage).catch(() => null);
    if (again) {
      const againCols = checkFeedback(again.result, input.labeled);
      if (unverified(again.result) < unverified(best.result)) {
        best = again;
        cols = againCols;
      }
    }
  }
  return { ...best, cols, attempts, unverified: unverified(best.result) };
}

async function runDebrief(sessionId: string): Promise<void> {
  const db = createServiceClient();
  try {
    const input = await prepareDebriefInput(db, sessionId);
    if (input.kind === "short") {
      await db
        .from("voice_debriefs")
        .update({ status: "none", counters: input.counters, rubric_version: RUBRIC_VERSION, updated_at: new Date().toISOString() })
        .eq("session_id", sessionId);
      return;
    }
    const rubric = await getConfig<string>("voice_debrief_prompt", "");
    if (!rubric) throw new Error("voice_debrief_prompt не задан");

    const { result, usage, model, cols } = await debriefChecked(rubric, input);

    await db
      .from("voice_debriefs")
      .update({
        status: "ready",
        is_fallback: false,
        rubric_version: RUBRIC_VERSION,
        model,
        result,
        counters: input.counters,
        ...cols,
        hidden_layer_reached: result.hidden_layer?.reached ?? null,
        integrity_valid: result.integrity?.valid ?? null,
        curator: result.curator ?? null,
        usage,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId);
  } catch (e) {
    console.error("[voice-debrief] failed", sessionId, e);
    const { data: turnsRaw } = await db.from("voice_turns").select("seq, role, text, t_start_ms, t_end_ms").eq("session_id", sessionId).order("seq");
    await db
      .from("voice_debriefs")
      .update({
        status: "ready",
        is_fallback: true,
        counters: computeCounters((turnsRaw ?? []) as TurnLite[]),
        rubric_version: RUBRIC_VERSION,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId);
  }
}
