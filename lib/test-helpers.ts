import {
  parseAIResponse,
  extractScoreFromUserMessage,
} from "@/lib/test-parser";
import type { TestAnswer } from "@/lib/test-scoring";
import type { TestConfig, TestQuestion } from "@/lib/test-config";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TestState = {
  current_question: number;
  status: string;
  started_at: string;
  answers: TestAnswer[];
};

export interface TestSession {
  id: string;
  session_id: string;
  test_slug: string;
  status: string;
  current_question: number;
  answers: TestAnswer[];
  messages: Array<{ role: string; content: string }>;
  created_at: string;
  updated_at: string;
}

export function buildAnswer(
  score: number,
  questionIdx: number,
  message: string,
  questions: TestQuestion[],
  answerRange: [number, number],
): TestAnswer {
  const question = questions[questionIdx];
  const reverseBase = answerRange[0] + answerRange[1];
  return {
    q: question.q,
    scale: question.scale,
    type: question.type,
    rawAnswer: score,
    score: question.type === "reverse" ? reverseBase - score : score,
    text: /^\d$/.test(message.trim()) ? undefined : message,
  };
}

/**
 * Overload for answer/route.ts which passes TestConfig directly.
 */
export function buildAnswerFromConfig(
  score: number,
  questionIdx: number,
  message: string,
  testConfig: TestConfig,
): TestAnswer {
  return buildAnswer(
    score,
    questionIdx,
    message,
    testConfig.questions,
    testConfig.scoring.answer_range,
  );
}

export function extractScores(
  message: string,
  aiText: string,
): { scores: number[]; source: string } {
  const userScore = extractScoreFromUserMessage(message);
  const parsed = parseAIResponse(aiText, message);

  if (parsed.isConfirmation && parsed.scores.length > 0) {
    return { scores: parsed.scores, source: "ai_confirmation" };
  }
  if (userScore !== null) {
    return { scores: [userScore], source: "user_message" };
  }
  return { scores: [], source: "no_score" };
}
