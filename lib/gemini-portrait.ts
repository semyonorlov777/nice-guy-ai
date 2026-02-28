import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

const PORTRAIT_MODEL = process.env.GEMINI_PORTRAIT_MODEL || "gemini-2.5-pro";

export async function analyzeForPortrait(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: PORTRAIT_MODEL,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(userMessage);
  return result.response.text();
}
