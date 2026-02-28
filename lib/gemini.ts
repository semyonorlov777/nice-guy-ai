import { GoogleGenerativeAI, Content } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

export async function streamChat(
  systemPrompt: string,
  history: Content[],
  userMessage: string
) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
  });

  const chat = model.startChat({ history });

  return chat.sendMessageStream(userMessage);
}
