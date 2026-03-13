import { generateText } from "ai";
import { google } from "@/lib/ai";
import { parseAIResponse, extractScoreFromUserMessage } from "@/lib/issp-parser";
import { ISSP_QUESTIONS, ISSP_SCALE_NAMES } from "@/lib/issp-config";
import { buildMiniPrompt } from "@/lib/prompts/issp-mini-prompt";

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DEBUG_ENABLED !== "true") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { answer_text, question_index } = body;

  if (typeof question_index !== "number" || question_index < 0 || question_index >= 35) {
    return Response.json({ error: "Невалидный question_index (0-34)" }, { status: 400 });
  }
  if (!answer_text || typeof answer_text !== "string") {
    return Response.json({ error: "Невалидный answer_text" }, { status: 400 });
  }

  const question = ISSP_QUESTIONS[question_index];
  const questionText = question.text;
  const scaleName = ISSP_SCALE_NAMES[question.scale] || question.scale;
  const fullPrompt = buildMiniPrompt(questionText);

  const startTime = Date.now();

  try {
    const result = await generateText({
      model: google("gemini-2.5-flash"),
      system: fullPrompt,
      messages: [{ role: "user", content: answer_text }],
    });

    const responseTimeMs = Date.now() - startTime;
    const rawResponse = result.text;

    // Parse score
    const parsed = parseAIResponse(rawResponse, answer_text);
    const userScore = extractScoreFromUserMessage(answer_text);

    let parsedScore: number | null = null;
    if (parsed.isConfirmation && parsed.scores.length > 0) {
      parsedScore = parsed.scores[0];
    } else if (userScore !== null) {
      parsedScore = userScore;
    }

    return Response.json({
      question_index,
      question_text: questionText,
      scale_name: scaleName,
      answer_text,
      full_prompt: fullPrompt,
      raw_response: rawResponse,
      parsed_score: parsedScore,
      parse_success: parsedScore !== null,
      response_time_ms: responseTimeMs,
      tokens_used: result.usage?.totalTokens ?? null,
      model: "gemini-2.5-flash",
    });
  } catch (err) {
    console.error("[test/debug] Gemini error:", err);
    return Response.json(
      { error: "Ошибка Gemini: " + (err as Error).message },
      { status: 500 }
    );
  }
}
