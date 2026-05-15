import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@/lib/ai";
import { createRateLimit } from "@/lib/rate-limit";
import {
  NEXT_QUESTION_SYSTEM_PROMPT,
  buildNextQuestionUserPrompt,
} from "@/lib/funnel/prompts";
import { MAX_QUESTIONS, MIN_QUESTIONS_BEFORE_FINAL } from "@/lib/funnel/types";
import type { FunnelAnswer, FunnelQuestion } from "@/lib/funnel/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const checkRateLimit = createRateLimit({ windowMs: 60_000, max: 30 });

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const trimmed = raw.trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON object in model output");
  }
  return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
}

interface ModelOutput {
  isFinal?: boolean;
  questionText?: string;
  type?: "scale" | "choice" | "open";
  options?: string[];
  scaleLabels?: string[];
  placeholder?: string;
  hint?: string;
}

function buildQuestion(
  raw: ModelOutput,
  questionId: string,
): FunnelQuestion | null {
  if (!raw.questionText || !raw.type) return null;
  const q: FunnelQuestion = {
    id: questionId,
    text: raw.questionText,
    type: raw.type,
  };
  if (raw.type === "choice" && Array.isArray(raw.options) && raw.options.length >= 2) {
    q.options = raw.options.slice(0, 4);
  }
  if (raw.type === "scale" && Array.isArray(raw.scaleLabels) && raw.scaleLabels.length === 5) {
    q.scaleLabels = raw.scaleLabels as [string, string, string, string, string];
  }
  if (raw.placeholder) q.placeholder = raw.placeholder;
  if (raw.hint) q.hint = raw.hint;
  return q;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 },
    );
  }

  let body: { answers?: FunnelAnswer[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const answers = Array.isArray(body.answers) ? body.answers : [];
  if (answers.length === 0) {
    return NextResponse.json({ error: "No answers provided" }, { status: 400 });
  }
  if (answers.length >= MAX_QUESTIONS) {
    return NextResponse.json({ question: null, isFinal: true });
  }

  const userPrompt = buildNextQuestionUserPrompt(answers);
  const formatHint = `
Верни строго JSON следующего формата (без обёртки в code fence):
{
  "isFinal": false,
  "questionText": "текст вопроса",
  "type": "scale" | "choice" | "open",
  "options": ["вариант 1", "вариант 2", "вариант 3"],
  "scaleLabels": ["метка 1", "метка 2", "метка 3", "метка 4", "метка 5"],
  "placeholder": "подсказка в поле ответа (опционально)",
  "hint": "подсказка под вопросом (опционально)"
}

Поля options нужно только если type = "choice".
Поле scaleLabels нужно только если type = "scale".
Если isFinal = true — остальные поля можно опустить.
`;

  try {
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      system: NEXT_QUESTION_SYSTEM_PROMPT + "\n\n" + formatHint,
      prompt: userPrompt,
      temperature: 0.8,
    });

    let parsed: ModelOutput;
    try {
      parsed = extractJson(text) as ModelOutput;
    } catch (err) {
      console.error("[funnel/next-question] JSON parse failed:", err, "raw:", text);
      return NextResponse.json(
        { error: "Model output parse failed" },
        { status: 502 },
      );
    }

    const forceFinal = answers.length >= MAX_QUESTIONS - 1;
    const canFinal = answers.length >= MIN_QUESTIONS_BEFORE_FINAL;
    const isFinal = forceFinal || (canFinal && parsed.isFinal === true);

    if (isFinal) {
      return NextResponse.json({ question: null, isFinal: true });
    }

    const nextId = `ai_${answers.length + 1}`;
    const question = buildQuestion(parsed, nextId);
    if (!question) {
      console.error("[funnel/next-question] invalid question shape:", parsed);
      return NextResponse.json(
        { error: "Model produced invalid question" },
        { status: 502 },
      );
    }

    return NextResponse.json({ question, isFinal: false });
  } catch (err) {
    console.error("[funnel/next-question] generation failed:", err);
    return NextResponse.json(
      { error: "Generation failed" },
      { status: 500 },
    );
  }
}
