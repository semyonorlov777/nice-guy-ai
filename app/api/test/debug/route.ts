import { generateText } from "ai";
import { google } from "@/lib/ai";
import { parseAIResponse, extractScoreFromUserMessage } from "@/lib/issp-parser";
import { ISSP_QUESTIONS, ISSP_SCALE_NAMES } from "@/lib/issp-config";
import { buildMiniPrompt } from "@/lib/prompts/issp-mini-prompt";
import { createServiceClient } from "@/lib/supabase-server";

const MODELS: Record<string, string> = {
  "flash": "gemini-2.5-flash",
  "flash-lite": "gemini-2.5-flash-lite",
};

const VALID_PROMPT_TYPES = ["mini", "full"] as const;
const VALID_MODEL_KEYS = ["flash", "flash-lite"] as const;

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DEBUG_ENABLED !== "true") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { answer_text, question_index } = body;
  const promptType: string = body.prompt_type || "mini";
  const modelKey: string = body.model || "flash";

  if (typeof question_index !== "number" || question_index < 0 || question_index >= 35) {
    return Response.json({ error: "Невалидный question_index (0-34)" }, { status: 400 });
  }
  if (!answer_text || typeof answer_text !== "string") {
    return Response.json({ error: "Невалидный answer_text" }, { status: 400 });
  }
  if (!VALID_PROMPT_TYPES.includes(promptType as typeof VALID_PROMPT_TYPES[number])) {
    return Response.json({ error: "Невалидный prompt_type (mini|full)" }, { status: 400 });
  }
  if (!VALID_MODEL_KEYS.includes(modelKey as typeof VALID_MODEL_KEYS[number])) {
    return Response.json({ error: "Невалидный model (flash|flash-lite)" }, { status: 400 });
  }

  const question = ISSP_QUESTIONS[question_index];
  const questionText = question.text;
  const scaleName = ISSP_SCALE_NAMES[question.scale] || question.scale;
  const modelName = MODELS[modelKey];

  // Build prompt
  let fullPrompt: string;
  if (promptType === "full") {
    const serviceClient = createServiceClient();
    const { data: program } = await serviceClient
      .from("programs")
      .select("test_system_prompt")
      .eq("slug", "nice-guy")
      .single();

    if (!program?.test_system_prompt) {
      return Response.json(
        { error: "test_system_prompt не найден в БД" },
        { status: 404 }
      );
    }
    fullPrompt = program.test_system_prompt;
  } else {
    fullPrompt = buildMiniPrompt(questionText);
  }

  const startTime = Date.now();

  try {
    const result = await generateText({
      model: google(modelName),
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
      prompt_type: promptType,
      model: modelName,
      full_prompt: fullPrompt,
      raw_response: rawResponse,
      parsed_score: parsedScore,
      parse_success: parsedScore !== null,
      response_time_ms: responseTimeMs,
      tokens_used: result.usage?.totalTokens ?? null,
    });
  } catch (err) {
    const responseTimeMs = Date.now() - startTime;
    const errorMessage = (err as Error).message;
    console.error(`[test/debug] Gemini error (${modelName}):`, err);

    // Graceful: return result with error instead of crashing
    return Response.json({
      question_index,
      question_text: questionText,
      scale_name: scaleName,
      answer_text,
      prompt_type: promptType,
      model: modelName,
      full_prompt: fullPrompt,
      raw_response: `Модель недоступна: ${errorMessage}`,
      parsed_score: null,
      parse_success: false,
      response_time_ms: responseTimeMs,
      tokens_used: null,
    });
  }
}
