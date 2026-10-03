// Растягивание пауз в речи голоса разбора. Модель говорит быстро и почти без пауз, а просьба
// в инструкции «говори медленнее» на темп почти не влияет. Слова не трогаем — между фразами
// удлиняем паузы. Чистая цифровая тишина и растянутые короткие паузы звучат рвано, как обрыв связи,
// поэтому паузу удлиняем её же фоном (повтором тихих кадров этой паузы), а короткие паузы внутри
// фразы по умолчанию не трогаем. Работает потоком: добавка идёт, когда после паузы снова начинается
// речь, поэтому хвост реплики не удлиняется.

export interface PauseStretchConfig {
  /** Пауза короче — не трогаем (паузы внутри слов и между словами). */
  min_pause_ms: number;
  /** С этой длины пауза считается границей предложения. */
  long_pause_ms: number;
  /** Сколько тишины добавить к короткой паузе. */
  short_extra_ms: number;
  /** Сколько тишины добавить к длинной паузе. */
  long_extra_ms: number;
}

export const DEFAULT_PAUSE_STRETCH: PauseStretchConfig = { min_pause_ms: 160, long_pause_ms: 350, short_extra_ms: 0, long_extra_ms: 450 };

const RATE = 24_000; // PCM16 моно 24 кГц — звук голоса Gemini Live
const FRAME_MS = 10;
const FRAME_BYTES = (RATE / 1000) * FRAME_MS * 2;
/** Громкость кадра (RMS 0..1) ниже — тишина. */
const SILENCE_RMS = 0.012;

export class PauseStretcher {
  private rest: Buffer = Buffer.alloc(0);
  private silentMs = 0;
  private spoke = false;
  /** Тихие кадры текущей паузы (её фон) — из них собирается добавка. */
  private pauseFrames: Buffer[] = [];

  constructor(private cfg: PauseStretchConfig = DEFAULT_PAUSE_STRETCH) {}

  /** Новая реплика: счёт пауз с нуля. */
  reset() {
    this.rest = Buffer.alloc(0);
    this.silentMs = 0;
    this.spoke = false;
    this.pauseFrames = [];
  }

  /** Кусок звука → кусок звука с удлинёнными паузами (PCM16 24 кГц). */
  process(pcm: Buffer): Buffer {
    const buf = this.rest.length ? Buffer.concat([this.rest, pcm]) : pcm;
    const whole = buf.length - (buf.length % FRAME_BYTES);
    this.rest = buf.subarray(whole);
    const out: Buffer[] = [];
    for (let at = 0; at < whole; at += FRAME_BYTES) {
      const frame = buf.subarray(at, at + FRAME_BYTES);
      if (rms(frame) < SILENCE_RMS) {
        this.silentMs += FRAME_MS;
        // Середина паузы — самый ровный фон (без хвоста слова и вдоха перед следующим).
        if (this.pauseFrames.length < 40) this.pauseFrames.push(Buffer.from(frame));
      } else {
        // Речь после паузы: перед ней — добавка из фона этой же паузы.
        if (this.spoke && this.silentMs >= this.cfg.min_pause_ms) {
          const extra = this.silentMs >= this.cfg.long_pause_ms ? this.cfg.long_extra_ms : this.cfg.short_extra_ms;
          if (extra > 0) out.push(roomTone(this.pauseFrames, extra));
        }
        this.silentMs = 0;
        this.pauseFrames = [];
        this.spoke = true;
      }
      out.push(frame);
    }
    return out.length === 1 ? out[0] : Buffer.concat(out);
  }

  /** Остаток неполного кадра в конце реплики. */
  flush(): Buffer {
    const r = this.rest;
    this.rest = Buffer.alloc(0);
    return r;
  }
}

function rms(frame: Buffer): number {
  const n = frame.length >> 1;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = frame.readInt16LE(i * 2);
    sum += v * v;
  }
  return Math.sqrt(sum / n) / 0x8000;
}

/** Добавка нужной длины из тихих кадров паузы (без кадров с краёв), с мягкими краями. */
function roomTone(frames: Buffer[], ms: number): Buffer {
  const need = (RATE / 1000) * ms * 2;
  const core = frames.length > 6 ? frames.slice(2, -2) : frames;
  const src = core.length ? Buffer.concat(core) : Buffer.alloc(FRAME_BYTES);
  const out = Buffer.alloc(need);
  for (let i = 0; i < need; i += 2) out.writeInt16LE(src.readInt16LE(i % src.length), i);
  return out;
}
