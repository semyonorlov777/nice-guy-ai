import { GeminiEngine } from "./gemini.ts";
import type { VoiceEngine } from "./types.ts";
import { EngineUnavailableError } from "./types.ts";

export function createEngine(name: string): VoiceEngine {
  if (name === "gemini") return new GeminiEngine();
  throw new EngineUnavailableError(`Движок «${name}» пока не подключён`);
}
