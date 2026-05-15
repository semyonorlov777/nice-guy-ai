export type QuestionType = "scale" | "choice" | "open";

export interface FunnelQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
  scaleLabels?: [string, string, string, string, string];
  placeholder?: string;
  hint?: string;
}

export interface FunnelAnswer {
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  answerText: string;
  answerValue?: number;
}

export interface FunnelSession {
  sessionId: string;
  startedAt: number;
  answers: FunnelAnswer[];
  currentQuestion: FunnelQuestion | null;
  result: string | null;
  status: "in_progress" | "analyzing" | "ready";
}

export interface NextQuestionResponse {
  question: FunnelQuestion | null;
  isFinal: boolean;
}

export interface AnalyzeResponse {
  result: string;
}

export const SESSION_STORAGE_KEY = "funnel:session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_QUESTIONS = 20;
export const MIN_QUESTIONS_BEFORE_FINAL = 14;
