import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

const PORTRAIT_MODEL = process.env.GEMINI_PORTRAIT_MODEL || "gemini-2.5-pro";

export async function analyzeForPortrait(
  systemPrompt: string,
  userMessage: string,
  options?: { maxOutputTokens?: number }
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: PORTRAIT_MODEL,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.3,
      // 4096 не хватало для тестов с 12+ шкалами — JSON обрезался на середине строки
      // и JSON.parse падал. 8192 даёт ~6000 слов, хватает с запасом.
      maxOutputTokens: options?.maxOutputTokens ?? 8192,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
  }, { timeout: 60_000 });
  return result.response.text();
}
