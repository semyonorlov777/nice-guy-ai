import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Локальная копия для изолированного мини-проекта funnel.
// Используем существующую переменную GOOGLE_GEMINI_API_KEY
// (@ai-sdk/google по умолчанию ищет GOOGLE_GENERATIVE_AI_API_KEY).
export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY!,
});
