import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Используем существующую переменную GOOGLE_GEMINI_API_KEY
// (@ai-sdk/google по умолчанию ищет GOOGLE_GENERATIVE_AI_API_KEY)
export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY!,
});

export const CHAT_MODEL_ID = process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash";

export const chatModel = () => google(CHAT_MODEL_ID);

export const CHAT_PROVIDER_OPTIONS = {
  google: { thinkingConfig: { thinkingBudget: 0 } },
};
