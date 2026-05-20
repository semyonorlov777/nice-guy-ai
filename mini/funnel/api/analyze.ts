import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@mini/funnel/lib/ai";
import { createRateLimit } from "@mini/funnel/lib/rate-limit";
import {
  ANALYZE_SYSTEM_PROMPT,
  buildAnalyzeUserPrompt,
} from "@mini/funnel/lib/prompts";
import type { FunnelAnswer } from "@mini/funnel/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const checkRateLimit = createRateLimit({ windowMs: 60_000, max: 5 });

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
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
  if (answers.length < 5) {
    return NextResponse.json(
      { error: "Need at least 5 answers" },
      { status: 400 },
    );
  }

  try {
    const { text } = await generateText({
      model: google("gemini-2.5-pro"),
      system: ANALYZE_SYSTEM_PROMPT,
      prompt: buildAnalyzeUserPrompt(answers),
      temperature: 0.85,
    });

    if (!text || text.trim().length < 200) {
      console.error("[funnel/analyze] result too short:", text);
      return NextResponse.json(
        { error: "Result too short" },
        { status: 502 },
      );
    }

    return NextResponse.json({ result: text.trim() });
  } catch (err) {
    console.error("[funnel/analyze] generation failed:", err);
    return NextResponse.json(
      { error: "Generation failed" },
      { status: 500 },
    );
  }
}
