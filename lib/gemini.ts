import { GoogleGenerativeAI, Content } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

export async function streamChat(
  systemPrompt: string,
  history: Content[],
  userMessage: string
) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
  });

  const chat = model.startChat({ history });

  const result = await chat.sendMessageStream(userMessage);

  return result.stream;
}
