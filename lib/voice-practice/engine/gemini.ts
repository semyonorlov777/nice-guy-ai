import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import type {
  EngineConnectOptions,
  EngineHandlers,
  VoiceEngine,
} from "./types";
import { EngineUnavailableError } from "./types";

const MODEL = process.env.VOICE_GEMINI_MODEL || "gemini-3.8-live";

export class GeminiEngine implements VoiceEngine {
  readonly name = "gemini" as const;
  readonly capabilities = {
    historySeed: true,
    bargeIn: true,
    hiddenText: true,
    transcripts: true,
    goAway: true,
  };

  private session: Session | null = null;
  private closedByUs = false;

  async connect(opts: EngineConnectOptions, h: EngineHandlers): Promise<void> {
    const apiKey = process.env.GOOGLE_GEMINI_VOICE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) throw new EngineUnavailableError("Нет ключа Gemini для голоса");
    const ai = new GoogleGenAI({ apiKey });
    const seed = opts.history?.length ? opts.history : null;

    this.session = await ai.live.connect({
      model: MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: opts.instruction,
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.voiceName } } },
        // Без подсказки языка расшифровка студента сбивается на японский/немецкий на коротких «угу».
        inputAudioTranscription: { languageCodes: ["ru-RU"] },
        outputAudioTranscription: { languageCodes: ["ru-RU"] },
        realtimeInputConfig: {
          automaticActivityDetection: { silenceDurationMs: opts.silenceMs, prefixPaddingMs: 300 },
        },
        ...(seed ? { historyConfig: { initialHistoryInClientContent: true } } : {}),
      },
      callbacks: {
        onmessage: (m: LiveServerMessage) => this.handle(m, h),
        onerror: (e: ErrorEvent) => h.onClose({ message: String(e?.message ?? e) }),
        onclose: (e: CloseEvent) => {
          if (!this.closedByUs) h.onClose({ code: e?.code, message: e?.reason });
        },
      },
    });

    if (seed) {
      this.session.sendClientContent({
        turns: seed.map((t) => ({
          role: t.role === "student" ? "user" : "model",
          parts: [{ text: t.text }],
        })),
        turnComplete: false,
      });
    }
  }

  private handle(m: LiveServerMessage, h: EngineHandlers) {
    const sc = m.serverContent;
    if (sc?.interrupted) h.onInterrupted();
    for (const p of sc?.modelTurn?.parts ?? []) {
      const data = p.inlineData?.data;
      if (data) h.onAudio(Buffer.from(data, "base64"));
    }
    if (sc?.inputTranscription?.text) h.onTranscript({ role: "student", text: sc.inputTranscription.text });
    if (sc?.outputTranscription?.text) h.onTranscript({ role: "client", text: sc.outputTranscription.text });
    if (sc?.turnComplete) h.onTurnComplete();
    if (m.goAway) h.onGoAway(parseDurationMs(m.goAway.timeLeft));
    if (m.usageMetadata) {
      h.onUsage({
        promptTokens: m.usageMetadata.promptTokenCount ?? 0,
        responseTokens: m.usageMetadata.responseTokenCount ?? 0,
        details: m.usageMetadata.promptTokensDetails,
      });
    }
  }

  sendAudio(pcm16k: Buffer): void {
    this.session?.sendRealtimeInput({
      audio: { data: pcm16k.toString("base64"), mimeType: "audio/pcm;rate=16000" },
    });
  }

  sendHiddenText(text: string): void {
    this.session?.sendClientContent({ turns: [{ role: "user", parts: [{ text }] }], turnComplete: false });
  }

  async close(): Promise<void> {
    this.closedByUs = true;
    this.session?.close();
    this.session = null;
  }
}

function parseDurationMs(v: unknown): number {
  if (typeof v === "string") {
    const s = parseFloat(v.replace(/s$/, ""));
    return Number.isFinite(s) ? s * 1000 : 0;
  }
  return 0;
}
