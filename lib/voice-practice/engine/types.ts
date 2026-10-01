// Контракт голосового движка. Ядро ретранслятора знает только этот интерфейс;
// обходы для движков без какой-то возможности живут в ядре, а не в адаптере.

export interface EngineCapabilities {
  /** Можно засеять историю разговора текстом перед первой репликой. */
  historySeed: boolean;
  /** Движок сам замолкает, когда студент перебивает. */
  bargeIn: boolean;
  /** Можно передать модели скрытый текст (сигналы [СИСТЕМА: …]) без озвучки. */
  hiddenText: boolean;
  /** Движок отдаёт расшифровку речи студента и клиента. */
  transcripts: boolean;
  /** Движок заранее предупреждает о скором обрыве соединения. */
  goAway: boolean;
}

export interface HistoryTurn {
  role: "student" | "client";
  text: string;
}

export interface EngineConnectOptions {
  instruction: string;
  voiceName: string;
  history?: HistoryTurn[];
  silenceMs: number;
}

export interface EngineUsage {
  promptTokens: number;
  responseTokens: number;
  /** Разбивка по видам данных, как отдаёт движок. */
  details?: unknown;
}

export interface EngineTranscript {
  role: "student" | "client";
  text: string;
}

export interface EngineHandlers {
  onAudio(pcm24k: Buffer): void;
  onTranscript(t: EngineTranscript): void;
  onInterrupted(): void;
  onTurnComplete(): void;
  onGoAway(timeLeftMs: number): void;
  onUsage(u: EngineUsage): void;
  onClose(reason: { code?: number; message?: string }): void;
}

export interface VoiceEngine {
  readonly name: "gemini" | "mock" | "yandex";
  readonly capabilities: EngineCapabilities;
  connect(opts: EngineConnectOptions, handlers: EngineHandlers): Promise<void>;
  /** PCM16 моно 16 кГц. */
  sendAudio(pcm16k: Buffer): void;
  /** Скрытая вводная для модели, не озвучивается студенту. */
  sendHiddenText(text: string): void;
  close(): Promise<void>;
}

export class EngineUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineUnavailableError";
  }
}
