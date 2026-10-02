// Разминка «Первые слова»: попытки идут живым голосом (voice_modes.drill_moments режима voice_warmup,
// поле n связывает момент с репликой); условия реакции и рубрика подсказки —
// app_config.voice_warmup_lines (тексты вне git).
import { GoogleGenAI, Type } from "@google/genai";
import { getConfig } from "@/lib/config";
import { lowThinking, withModelFallback } from "./models";

export type WarmupReaction = "warm" | "neutral" | "cold";

export interface WarmupLine {
  n: number;
  line: string;
  focus: string;
  warm_if: string;
  neutral_if: string;
  cold_if: string;
  example: string;
}

export interface WarmupSet {
  client: string;
  level: number;
  client_name: string;
  lines: WarmupLine[];
}

interface WarmupConfig {
  version: string;
  rubric: string;
  sets: Record<string, WarmupSet>;
}

export const DEFAULT_WARMUP_SET = "vera/1";

/** Конфиг разминки из app_config (значение — JSON-строка или объект). null — не задан. */
export async function getWarmupConfig(): Promise<WarmupConfig | null> {
  const raw = await getConfig<unknown>("voice_warmup_lines", null as unknown);
  if (!raw) return null;
  try {
    const cfg = (typeof raw === "string" ? JSON.parse(raw) : raw) as WarmupConfig;
    return cfg?.sets ? cfg : null;
  } catch {
    console.error("[warmup] voice_warmup_lines: не JSON");
    return null;
  }
}

// 2.5-flash отвечает за ~1 с и реже перегружен, чем 3.8-flash.
const WARMUP_MODEL = process.env.VOICE_WARMUP_MODEL || "gemini-2.5-flash";

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

export interface WarmupVerdict {
  reaction: WarmupReaction;
  got: string;
  try: string;
  reflection: boolean;
  open_q: boolean;
  why: boolean;
  advice: boolean;
}

export type WarmupTurn = { seq: number; role: "student" | "client"; text: string };

/** Ответ студента — всё, что он сказал после первой реплики клиента; реакция — что клиент сказал после ответа. */
export function splitAttempt(turns: WarmupTurn[]): { answer: string; reply: string } {
  const first = turns.findIndex((t) => t.role === "client");
  const after = first < 0 ? [] : turns.slice(first + 1);
  const firstStudent = after.findIndex((t) => t.role === "student");
  if (firstStudent < 0) return { answer: "", reply: "" };
  const rest = after.slice(firstStudent);
  const join = (role: WarmupTurn["role"]) => rest.filter((t) => t.role === role).map((t) => t.text).join(" ").trim();
  return { answer: join("student"), reply: join("client") };
}

/** Карточка «сработало / попробуйте иначе» по одной попытке (взгляд наблюдателя). */
export async function warmupVerdict(rubric: string, clientName: string, line: WarmupLine, answer: string, reply: string): Promise<WarmupVerdict> {
  const task = [
    `Учебный клиент: ${clientName}. Что тренируем на этой реплике: ${line.focus}.`,
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
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });
  const { result: r } = await withModelFallback(
    WARMUP_MODEL,
    (model) =>
      ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: task }] }],
        config: {
          systemInstruction: rubric,
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          maxOutputTokens: 1024,
          thinkingConfig: lowThinking(model),
        },
      }),
    "warmup",
  );
  const v = JSON.parse(r.text ?? "") as WarmupVerdict;
  return { ...v, reaction: ["warm", "neutral", "cold"].includes(v.reaction) ? v.reaction : "neutral" };
}
