import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Локальная копия для изолированного мини voice.
// Используем существующую переменную GOOGLE_GEMINI_API_KEY
// (@ai-sdk/google по умолчанию ищет GOOGLE_GENERATIVE_AI_API_KEY).
export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY!,
});

// gemini-2.5-flash дешевле и быстрее, чем pro; для транскрипции качества хватает.
export const TRANSCRIBE_MODEL_ID = process.env.VOICE_TRANSCRIBE_MODEL ?? "gemini-2.5-flash";

export const transcribeModel = () => google(TRANSCRIBE_MODEL_ID);
