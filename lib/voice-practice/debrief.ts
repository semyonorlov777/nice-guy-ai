// Разбор учебной консультации: счётчики кодом → оценщик (Gemini, JSON) → проверка цитат кодом.
// ensureDebrief — единственная точка входа, идемпотентна: строку захватывает один вызов.
import { GoogleGenAI } from "@google/genai";
import { createServiceClient } from "@/lib/supabase-server";
import { getConfig } from "@/lib/config";
import { computeCounters, type TurnLite } from "./counters";

const MODEL = process.env.VOICE_DEBRIEF_MODEL || "gemini-3.8-flash";
const RUBRIC_VERSION = "2026-10-01.1";
const MIN_STUDENT_TURNS = 2;

const OUTPUT_SHAPE = `{
  "data_sufficient": true,
  "integrity": { "valid": true, "flags": [] },
  "counters_model": { "open_q": 0, "closed_q": 0, "double_questions": [{ "turn": "S9", "quote": "..." }], "reflections_content": 0, "reflections_feeling": 0 },
  "position": { "advice_or_ready_solutions": { "ok": true, "turn": null, "quote": null }, "evaluation": { "ok": true, "turn": null, "quote": null }, "promises": { "ok": true, "turn": null, "quote": null } },
  "stages": [{ "stage": 1, "name": "Контакт и договорённость", "status": "present|partial|absent", "evidence": { "turn": "S3", "quote": "..." }, "missing": "..." }],
  "skills": [{ "id": "reflect_feeling", "name": "Отражение чувств", "tier": 1, "occasion": true, "level": 2, "evidence": [{ "turn": "S11", "quote": "..." }], "client_reaction": { "turn": "C12", "note": "..." } }],
  "hidden_layer": { "reached": false, "disclosed_at_turn": null, "trigger_turn": null, "trigger_quote": null, "closest_attempt_turn": null, "what_could_open": null },
  "safety": { "level": "none|watch|risk", "note": null },
  "feedback": {
    "strength": { "turn": "S11", "quote": "...", "skill": "Отражение чувств", "why": "..." },
    "fix": { "turn": "S5", "quote": "...", "skill": "Без «почему»", "alternative": "...", "why": "..." },
    "repeat": { "turn": "C4", "client_line": "...", "skill": "..." },
    "summary_for_student": "..."
  },
  "curator": { "headline": "...", "attention": ["..."], "ai_context": "..." }
}`;

interface Quote {
  turn?: string | null;
  quote?: string | null;
}

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

async function runDebrief(sessionId: string): Promise<void> {
  const db = createServiceClient();
  try {
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

    if (!s || counters.student_turns < (s.kind === "drill" ? 1 : MIN_STUDENT_TURNS)) {
      await db
        .from("voice_debriefs")
        .update({ status: "none", counters, rubric_version: RUBRIC_VERSION, updated_at: new Date().toISOString() })
        .eq("session_id", sessionId);
      return;
    }

    const [{ data: client }, { data: pm }, rubric] = await Promise.all([
      s.client_id
        ? db.from("voice_clients").select("display_name, level, summary_public, prompt, hidden_layer, version").eq("id", s.client_id).single()
        : Promise.resolve({ data: null }),
      db.from("program_modes").select("mode_templates!inner(name, key)").eq("id", s.program_mode_id).single(),
      getConfig<string>("voice_debrief_prompt", ""),
    ]);
    if (!rubric) throw new Error("voice_debrief_prompt не задан");
    const mt = pm?.mode_templates as unknown as { name: string; key: string } | undefined;

    let sN = 0;
    let cN = 0;
    const labeled = turns.map((t) => {
      const id = t.role === "student" ? `S${++sN}` : `C${++cN}`;
      const at = t.t_start_ms != null ? `${String(Math.floor(t.t_start_ms / 60000)).padStart(2, "0")}:${String(Math.floor((t.t_start_ms % 60000) / 1000)).padStart(2, "0")}` : "--:--";
      return { id, at, ...t };
    });

    const userMessage = [
      `РЕЖИМ: ${s.kind === "drill" ? "drill" : "full"} («${mt?.name ?? ""}»).`,
      `КАРТОЧКА ПЕРСОНАЖА (для оценщика, студент её не видел):\nУровень ${client?.level ?? "?"}. ${client?.display_name ?? ""}. ${client?.summary_public ?? ""}\nСкрытый слой: ${JSON.stringify(client?.hidden_layer ?? [])}\nОписание роли:\n${client?.prompt ?? ""}`,
      `СЧЁТЧИКИ ПРОГРАММЫ: ${JSON.stringify(counters)}`,
      `ОТМЕТКИ СБОЕВ КЛИЕНТА: ${JSON.stringify(s.integrity_flags ?? [])}`,
      `УВЕРЕННОСТЬ СТУДЕНТА ДО СЕССИИ: null`,
      `РАСШИФРОВКА (распознана автоматически, возможны ошибки распознавания — не вини за них студента):\n${labeled.map((t) => `[${t.at} ${t.id}] ${t.text}`).join("\n")}`,
      `ФОРМА ОТВЕТА (JSON, поля как в примере; лишних полей не добавляй):\n${OUTPUT_SHAPE}`,
    ].join("\n\n");

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });
    const resp = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: { systemInstruction: rubric, responseMimeType: "application/json", maxOutputTokens: 8192 },
    });
    const raw = (resp.text ?? "").replace(/^```json\s*|\s*```$/g, "");
    const result = JSON.parse(raw) as Record<string, unknown> & {
      feedback?: { strength?: Quote & Record<string, unknown>; fix?: Quote & Record<string, unknown>; repeat?: Record<string, unknown>; summary_for_student?: string };
      curator?: Record<string, unknown>;
      hidden_layer?: { reached?: boolean };
      integrity?: { valid?: boolean };
    };

    // Проверка цитат: цитата студента должна быть в его реплике с этим номером.
    const byId = new Map(labeled.map((t) => [t.id, t.text]));
    const norm = (x: string) => x.toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();
    const verify = (q?: Quote | null) => {
      if (!q?.quote || !q.turn) return false;
      const src = byId.get(q.turn) ?? turns.filter((t) => t.role === "student").map((t) => t.text).join(" ");
      return norm(src).includes(norm(q.quote));
    };
    const fb = result.feedback ?? {};
    const strengthOk = verify(fb.strength);
    const fixOk = verify(fb.fix);

    await db
      .from("voice_debriefs")
      .update({
        status: "ready",
        is_fallback: false,
        rubric_version: RUBRIC_VERSION,
        model: MODEL,
        result,
        counters,
        strength: fb.strength ? { ...fb.strength, verified: strengthOk } : null,
        fix: fb.fix ? { ...fb.fix, verified: fixOk } : null,
        repeat: fb.repeat ?? null,
        summary: fb.summary_for_student ?? null,
        hidden_layer_reached: result.hidden_layer?.reached ?? null,
        integrity_valid: result.integrity?.valid ?? null,
        curator: result.curator ?? null,
        usage: resp.usageMetadata ?? null,
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
