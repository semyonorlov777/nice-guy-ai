/**
 * mini/__SLUG__/lib/ai.ts
 *
 * Локальная обёртка над Gemini SDK для этого мини-проекта.
 * Не импортируется из основного @/lib/ai — это сознательная копия, плата за изоляцию.
 *
 * Использование:
 *   import { chatModel, CHAT_PROVIDER_OPTIONS } from "@mini/__SLUG__/lib/ai";
 *   import { streamText } from "ai";
 *
 *   const result = streamText({
 *     model: chatModel(),
 *     providerOptions: CHAT_PROVIDER_OPTIONS,
 *     messages: [...],
 *   });
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY!,
});

export const CHAT_MODEL_ID = "gemini-2.5-flash";

export const chatModel = () => google(CHAT_MODEL_ID);

export const CHAT_PROVIDER_OPTIONS = {
  google: { thinkingConfig: { thinkingBudget: 0 } },
};
