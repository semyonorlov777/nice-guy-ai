// Сквозная проверка голосовой сессии без браузера: создаёт сессию тестовому
// пользователю (service role), подключается к WebSocket сайта, озвучивает реплики
// «студента» через TTS, пишет ответ клиента в WAV и печатает расшифровку из БД.
//
// npx tsx --env-file=.env.local scripts/voice/ws-client.ts --user <uuid> [--url wss://…/api/practice/ws]
//   [--mode voice_first_minutes] [--client vera] [--rotate] [--out <папка>]
//   [--lines <файл>] [--seconds <лимит>] [--json <файл>]
// --rotate  после первой реплики переподключиться по новому билету (проверка продолжения разговора).
// --lines   свои реплики студента: по одной в строке, «#» — комментарий, «[тишина N]» — молчать N секунд.
// --json    сохранить итог прогона: реплики, длительность и задержку ответа клиента, расшифровку из БД.
import { GoogleGenAI, Modality } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { newTicket } from "../../lib/voice-practice/ticket";
import { quietNoise, resamplePcm16, wavFile } from "../../lib/voice-practice/audio/pcm";

const args = process.argv.slice(2);
const arg = (k: string, d?: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const USER = arg("--user");
const URL = arg("--url", "wss://nice-guy-ai.vercel.app/api/practice/ws")!;
const MODE = arg("--mode", "voice_first_minutes")!;
const CLIENT = arg("--client", "vera")!;
const OUT = arg("--out", "./ws-client-out")!;
const ROTATE = args.includes("--rotate");
const MOMENT = arg("--moment");
const LINES_FILE = arg("--lines");
const SECONDS = arg("--seconds");
const JSON_OUT = arg("--json");

const DRILL_LINES = ["Да, я учусь. А что для вас важно в этом вопросе?"];
const FULL_LINES = [
  "Здравствуйте, Вера. Меня зовут Мария, я психолог. Расскажите, что вас привело?",
  "Похоже, вы очень устали за эти два месяца. Чего вы ожидаете от нашего разговора?",
  "У нас сегодня около сорока минут, и к концу я хотела бы понять, с чем именно вы хотите работать.",
];
const LINES = LINES_FILE
  ? readFileSync(LINES_FILE, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  : MOMENT ? DRILL_LINES : FULL_LINES;
const silenceOf = (line: string) => Number(/^\[тишина (\d+)\]$/.exec(line)?.[1] ?? 0);
const CLIENT_RATE = 24000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!USER) throw new Error("--user <uuid> обязателен");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });

  const { data: pm } = await db
    .from("program_modes")
    .select("id, programs!inner(id, slug), mode_templates!inner(key)")
    .eq("programs.slug", "mipp-praktikum")
    .eq("mode_templates.key", MODE)
    .single();
  const { data: client } = await db.from("voice_clients").select("id").eq("slug", CLIENT).single();
  if (!pm || !client) throw new Error("режим или клиент не найдены");
  await db.from("voice_sessions").update({ status: "ended", end_reason: "student" }).eq("user_id", USER).in("status", ["created", "active", "paused", "reconnecting"]);
  const t = newTicket();
  const { data: s, error } = await db
    .from("voice_sessions")
    .insert({
      user_id: USER,
      program_id: (pm.programs as unknown as { id: string }).id,
      program_mode_id: pm.id,
      client_id: client.id,
      seconds_limit: SECONDS ? Number(SECONDS) : MOMENT ? 120 : 240,
      kind: MOMENT ? "drill" : "full",
      drill_moment_id: MOMENT ?? null,
      ticket_hash: t.hash,
      ticket_expires_at: t.expiresAt,
    })
    .select("id")
    .single();
  if (error || !s) throw error;
  console.log("сессия", s.id);

  console.log("озвучиваю реплики…");
  const audio = await Promise.all(
    LINES.map(async (text) => {
      if (silenceOf(text)) return Buffer.alloc(0);
      const r = await ai.models.generateContent({
        model: "gemini-3.8-flash-tts",
        contents: [{ parts: [{ text }] }],
        config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } } },
      });
      const data = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
      return resamplePcm16(Buffer.from(data!, "base64"), 24000, 16000);
    }),
  );

  const clientAudio: Buffer[] = [];
  let clientBytes = 0;
  const steps: { student: string; clientSec: number; latencyMs: number | null }[] = [];
  let ws = await connect(t.ticket);
  let lastAudio = 0;
  // Сервер шлёт state idle, когда клиент закончил ход (turnComplete): по нему
  // и ждём конца реплики — паузы внутри реплики бывают длиннее секунды.
  let clientDone = false;
  const replyOver = () => (clientDone && lastAudio > 0) || (lastAudio > 0 && Date.now() - lastAudio > 4000);
  function wire(sock: WebSocket) {
    sock.on("message", (data, isBinary) => {
      if (isBinary) {
        clientAudio.push(data as Buffer);
        clientBytes += (data as Buffer).length;
        lastAudio = Date.now();
      } else {
        const m = JSON.parse(String(data));
        if (m.t === "state" && m.speaking === "idle") clientDone = true;
        if (m.t !== "state") console.log("  ←", JSON.stringify(m));
      }
    });
  }
  wire(ws);

  if (MOMENT) {
    // Клиент начинает сам: ждём его реплику.
    const t0 = Date.now();
    while (Date.now() - t0 < 25000) {
      ws.send(quietNoise(40, 16000));
      await sleep(40);
      if (replyOver()) break;
    }
    console.log(`  (реплика клиента: ${clientAudio.length} кадров)`);
    steps.push({ student: "(клиент начинает)", clientSec: clientBytes / 2 / CLIENT_RATE, latencyMs: null });
  }
  for (let i = 0; i < audio.length; i++) {
    if (ROTATE && i === 1) {
      console.log("— переподключение по новому билету —");
      ws.close();
      await sleep(1500);
      const nt = newTicket();
      await db.from("voice_sessions").update({ ticket_hash: nt.hash, ticket_expires_at: nt.expiresAt }).eq("id", s.id);
      ws = await connect(nt.ticket);
      wire(ws);
    }
    console.log(`→ ${LINES[i]}`);
    if (ws.readyState !== ws.OPEN) break;
    for (let o = 0; o < audio[i].length; o += 1280) {
      ws.send(audio[i].subarray(o, o + 1280));
      await sleep(40);
    }
    const started = Date.now();
    const bytesBefore = clientBytes;
    let firstAudio = 0;
    lastAudio = 0;
    clientDone = false;
    // «[тишина N]» — молчим N секунд целиком; иначе ждём, пока клиент договорит
    // (сигнал сервера или 4 с без звука после начала ответа), но не дольше 25 с.
    const hush = silenceOf(LINES[i]) * 1000;
    while (Date.now() - started < (hush || 25000) && ws.readyState === ws.OPEN) {
      ws.send(quietNoise(40, 16000));
      await sleep(40);
      if (lastAudio && !firstAudio) firstAudio = lastAudio;
      if (!hush && replyOver()) break;
    }
    steps.push({
      student: LINES[i],
      clientSec: Math.round(((clientBytes - bytesBefore) / 2 / CLIENT_RATE) * 10) / 10,
      latencyMs: firstAudio ? firstAudio - started : null,
    });
  }

  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ t: "end" }));
  await sleep(3000);
  const { data: turns } = await db.from("voice_turns").select("seq, role, text").eq("session_id", s.id).order("seq");
  const { data: fin } = await db.from("voice_sessions").select("status, end_reason, seconds_used, reconnects, usage").eq("id", s.id).single();
  console.log("\nРасшифровка из БД:");
  for (const tr of turns ?? []) console.log(`  ${tr.seq}. ${tr.role === "client" ? "КЛИЕНТ" : "СТУДЕНТ"}: ${tr.text}`);
  console.log("\nСессия:", JSON.stringify(fin));
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "client.wav"), wavFile(Buffer.concat(clientAudio), 24000));
  console.log("звук:", join(OUT, "client.wav"));
  if (JSON_OUT) {
    writeFileSync(JSON_OUT, JSON.stringify({ sessionId: s.id, mode: MODE, client: CLIENT, moment: MOMENT ?? null, steps, turns, session: fin }, null, 2));
    console.log("итог:", JSON_OUT);
  }
  process.exit(0);
}

function connect(ticket: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    ws.once("open", () => {
      ws.send(JSON.stringify({ t: "auth", ticket }));
      ws.once("message", (data) => {
        const m = JSON.parse(String(data));
        console.log("  ←", JSON.stringify(m));
        if (m.t === "ready") resolve(ws);
        else reject(new Error(String(data)));
      });
    });
    ws.once("unexpected-response", (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
    ws.once("error", reject);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
