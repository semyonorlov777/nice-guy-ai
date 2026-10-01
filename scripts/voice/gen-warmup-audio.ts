// Озвучка разминки «Первые слова»: реплика клиента + три реакции (теплеет / ровно / закрывается).
// Тексты — вне git (приватная папка), в git попадает только звук.
//
// npx tsx --env-file=.env.local scripts/voice/gen-warmup-audio.ts <warmup-lines.json> [--set vera/1] [--only 1-line,3-cold] [--force]
//
// Пишет public/audio/warmup/<set>/<n>-{line,warm,neutral,cold}.mp3 (нужен ffmpeg в PATH).
// Уже готовые файлы пропускает — переозвучить: --force или --only.
import { GoogleGenAI, Modality } from "@google/genai";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { wavFile } from "../../lib/voice-practice/audio/pcm";

interface WarmupLine {
  n: number;
  line: string;
  warm: string;
  neutral: string;
  cold: string;
}
interface WarmupSet {
  voice: string;
  tts_style?: string;
  lines: WarmupLine[];
}

const args = process.argv.slice(2);
const arg = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const FILE = args[0];
const SET = arg("--set") || "vera/1";
const ONLY = arg("--only")?.split(",");
const FORCE = args.includes("--force");
const TTS_MODEL = process.env.VOICE_TTS_MODEL || "gemini-3.8-flash-tts";
const RATE = 24000;
const KINDS = ["line", "warm", "neutral", "cold"] as const;

async function tts(ai: GoogleGenAI, voice: string, style: string, text: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await ai.models.generateContent({
        model: TTS_MODEL,
        // Манера речи — только тегом в квадратных скобках перед текстом: системную инструкцию
        // модель не принимает, а обычную фразу-указание зачитывает вслух.
        contents: [{ parts: [{ text: style ? `${style} ${text}` : text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      });
      const data = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
      if (!data) throw new Error("TTS не вернул звук");
      return Buffer.from(data, "base64");
    } catch (e) {
      // Предел TTS — 10 запросов в минуту: на 429 ждём и повторяем.
      if (attempt >= 6 || (e as { status?: number }).status !== 429) throw e;
      console.warn(`  повтор ${attempt}: ${(e as Error).message.slice(0, 80)}`);
      await new Promise((r) => setTimeout(r, 15_000));
    }
  }
}

async function main() {
  if (!FILE) throw new Error("Укажите путь к warmup-lines.json");
  const all = JSON.parse(readFileSync(FILE, "utf8")) as { sets: Record<string, WarmupSet> };
  const set = all.sets[SET];
  if (!set) throw new Error(`Набор ${SET} не найден`);
  const outDir = join("public/audio/warmup", SET);
  mkdirSync(outDir, { recursive: true });
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });

  for (const l of set.lines) {
    for (const kind of KINDS) {
      const name = `${l.n}-${kind}`;
      const mp3 = join(outDir, `${name}.mp3`);
      if (ONLY ? !ONLY.includes(name) : existsSync(mp3) && !FORCE) continue;
      const pcm = await tts(ai, set.voice, set.tts_style ?? "", l[kind]);
      const wav = join(outDir, `${name}.wav`);
      writeFileSync(wav, wavFile(pcm, RATE));
      // Тишина в начале и в конце срезается, моно 64 кбит/с — около 8 КБ на секунду.
      execFileSync("ffmpeg", [
        "-y", "-loglevel", "error", "-i", wav,
        "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,apad=pad_dur=0.15",
        "-ac", "1", "-b:a", "64k", mp3,
      ]);
      execFileSync("rm", [wav]);
      console.log(`${mp3}  ${(pcm.length / 2 / RATE).toFixed(1)} с`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
