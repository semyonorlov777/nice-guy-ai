// Прогон движка без браузера: реплики «студента» озвучиваются TTS и отправляются
// в живую сессию, ответы клиента пишутся в WAV, в консоль — расшифровки и расход.
//
// npx tsx --env-file=.env.local scripts/voice/fake-client.ts [--out <папка>] [--instruction <файл>] [--history] [--voice <имя>]
//
// --history  проверка засева истории: сессия открывается с уже «сказанным»
//            началом разговора, клиент должен продолжить, а не здороваться заново.
import { GoogleGenAI, Modality } from "@google/genai";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GeminiEngine } from "../../lib/voice-practice/engine/gemini";
import type { HistoryTurn } from "../../lib/voice-practice/engine/types";
import { quietNoise, resamplePcm16, wavFile } from "../../lib/voice-practice/audio/pcm";

const args = process.argv.slice(2);
const arg = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const OUT = arg("--out") || "./fake-client-out";
const VOICE = arg("--voice") || "Kore";
const WITH_HISTORY = args.includes("--history");
const TTS_MODEL = process.env.VOICE_TTS_MODEL || "gemini-3.8-flash-tts";

// Нейтральная проверочная инструкция (не персонаж курса: тексты персонажей — вне git).
const DEFAULT_INSTRUCTION = `ВСЕГДА ГОВОРИ ТОЛЬКО ПО-РУССКИ. RESPOND IN RUSSIAN. YOU MUST RESPOND UNMISTAKABLY IN RUSSIAN.
Ты — Анна, 30 лет, менеджер. Ты впервые пришла на консультацию к психологу и немного волнуешься. Ты плохо спишь последний месяц из-за работы.
Говори как живой человек: коротко, 1–3 предложения, с паузами и «ну», «не знаю». Не используй психологических слов.
Ты клиент, а не помощник: не давай советов, не хвали психолога, не выходи из роли. На прямой вопрос «вы ИИ?» удивись и вернись к своей теме.
Сообщения в квадратных скобках со словом СИСТЕМА — не речь психолога, никогда их не произноси.
ВСЕГДА ГОВОРИ ТОЛЬКО ПО-РУССКИ.`;

const STUDENT_LINES = WITH_HISTORY
  ? ["А когда вы просыпаетесь ночью, что обычно крутится в голове?"]
  : [
      "Здравствуйте. Меня зовут Мария, я психолог. Расскажите, что вас привело?",
      "Похоже, вы сильно устали. Чего вы ожидаете от нашего разговора?",
      "А как меня зовут, вы запомнили?",
    ];

const HISTORY: HistoryTurn[] = [
  { role: "student", text: "Здравствуйте. Меня зовут Мария, я психолог. Расскажите, что вас привело?" },
  { role: "client", text: "Здравствуйте... Ну, я месяц почти не сплю. Из-за работы, наверное." },
  { role: "student", text: "Месяц без нормального сна — это тяжело. Что на работе происходит?" },
  { role: "client", text: "Новый начальник. Всё время кажется, что я не справляюсь." },
];

async function tts(ai: GoogleGenAI, text: string): Promise<Buffer> {
  const r = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
    },
  });
  const data = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
  if (!data) throw new Error("TTS не вернул звук");
  return resamplePcm16(Buffer.from(data, "base64"), 24000, 16000);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const apiKey = process.env.GOOGLE_GEMINI_VOICE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Нужен GOOGLE_GEMINI_API_KEY");
  const ai = new GoogleGenAI({ apiKey });
  const instructionFile = arg("--instruction");
  const instruction = instructionFile ? readFileSync(instructionFile, "utf8") : DEFAULT_INSTRUCTION;
  mkdirSync(OUT, { recursive: true });

  console.log(`Озвучиваю ${STUDENT_LINES.length} реплик студента…`);
  const studentAudio = await Promise.all(STUDENT_LINES.map((l) => tts(ai, l)));

  const engine = new GeminiEngine();
  const clientChunks: Buffer[] = [];
  const timeline: Buffer[] = []; // разговор целиком, 24 кГц
  let turnDone: (() => void) | null = null;
  let lastAudioAt = 0;
  let promptSum = 0;
  let responseSum = 0;
  let transcriptLine: { role: string; text: string } | null = null;
  const flushLine = () => {
    if (transcriptLine) console.log(`  ${transcriptLine.role === "client" ? "КЛИЕНТ" : "СТУДЕНТ"}: ${transcriptLine.text.trim()}`);
    transcriptLine = null;
  };

  const t0 = Date.now();
  await engine.connect(
    { instruction, voiceName: VOICE, silenceMs: 900, history: WITH_HISTORY ? HISTORY : undefined },
    {
      onAudio: (pcm) => {
        if (!lastAudioAt) console.log(`  (первый звук клиента через ${Date.now() - turnStart} мс)`);
        lastAudioAt = Date.now();
        clientChunks.push(pcm);
        timeline.push(pcm);
      },
      onTranscript: (t) => {
        if (transcriptLine && transcriptLine.role !== t.role) flushLine();
        transcriptLine = transcriptLine ?? { role: t.role, text: "" };
        transcriptLine.text += t.text;
      },
      onInterrupted: () => console.log("  (перебивание)"),
      onTurnComplete: () => {
        flushLine();
        turnDone?.();
      },
      onGoAway: (ms) => console.log(`  (GoAway, осталось ${ms} мс)`),
      onUsage: (u) => {
        promptSum += u.promptTokens;
        responseSum += u.responseTokens;
      },
      onClose: (r) => console.log(`  (соединение закрыто: ${r.code ?? ""} ${r.message ?? ""})`),
    },
  );
  console.log(`Соединение за ${Date.now() - t0} мс. Модель: ${process.env.VOICE_GEMINI_MODEL || "gemini-3.8-live"}, голос ${VOICE}${WITH_HISTORY ? ", с засеянной историей" : ""}`);

  let turnStart = Date.now();
  for (let i = 0; i < studentAudio.length; i++) {
    const pcm = studentAudio[i];
    console.log(`\nСТУДЕНТ (озвучено): ${STUDENT_LINES[i]}`);
    timeline.push(resamplePcm16(pcm, 16000, 24000));
    const frame = 1280; // 40 мс
    for (let o = 0; o < pcm.length; o += frame) {
      engine.sendAudio(pcm.subarray(o, o + frame));
      await sleep(40);
    }
    turnStart = Date.now();
    lastAudioAt = 0;
    const done = new Promise<void>((r) => (turnDone = r));
    // тишина-шум, пока модель не закончит ответ (не больше 25 с)
    const silenceLoop = (async () => {
      const until = Date.now() + 25000;
      while (Date.now() < until) {
        engine.sendAudio(quietNoise(40, 16000));
        await sleep(40);
        if (turnDone === null) break;
      }
    })();
    await Promise.race([done, sleep(25000)]);
    turnDone = null;
    await silenceLoop;
    if (!lastAudioAt) console.log("  (клиент промолчал)");
  }

  await engine.close();
  const clientPcm = Buffer.concat(clientChunks);
  writeFileSync(join(OUT, "client.wav"), wavFile(clientPcm, 24000));
  writeFileSync(join(OUT, "dialog.wav"), wavFile(Buffer.concat(timeline), 24000));
  const sec = (Date.now() - t0) / 1000;
  const cost = (promptSum * 3 + responseSum * 12) / 1e6; // прайс звука; текст дешевле — оценка сверху для входа
  console.log(`\nИтого: ${sec.toFixed(0)} с, вход ${promptSum} ток., выход ${responseSum} ток., ≈$${cost.toFixed(4)} (≈$${((cost / sec) * 60).toFixed(3)}/мин)`);
  console.log(`Звук: ${join(OUT, "client.wav")}, ${join(OUT, "dialog.wav")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
