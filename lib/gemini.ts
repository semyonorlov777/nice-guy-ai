import { GoogleGenerativeAI, Content } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes("429") ||
      error.message.includes("Resource has been exhausted") ||
      error.message.includes("RESOURCE_EXHAUSTED")
    );
  }
  return false;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function streamChat(
  systemPrompt: string,
  history: Content[],
  userMessage: string
) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
  });

  const chat = model.startChat({ history });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await chat.sendMessageStream(userMessage);
    } catch (error) {
      if (isRateLimitError(error) && attempt < MAX_RETRIES - 1) {
        console.warn(
          `[gemini] Rate limited (429), retrying in ${RETRY_DELAY_MS}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`
        );
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw error;
    }
  }

  throw new Error("Unreachable");
}
