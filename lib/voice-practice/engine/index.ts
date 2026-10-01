import { GeminiEngine } from "./gemini";
import type { VoiceEngine } from "./types";
import { EngineUnavailableError } from "./types";

export function createEngine(name: string): VoiceEngine {
  if (name === "gemini") return new GeminiEngine();
  throw new EngineUnavailableError(`Движок «${name}» пока не подключён`);
}
