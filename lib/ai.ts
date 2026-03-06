import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Используем существующую переменную GOOGLE_GEMINI_API_KEY
// (@ai-sdk/google по умолчанию ищет GOOGLE_GENERATIVE_AI_API_KEY)
export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY!,
});
