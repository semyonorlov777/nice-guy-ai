// Сквозная проверка голосовой сессии без браузера: создаёт сессию тестовому
// пользователю (service role), подключается к WebSocket сайта, озвучивает реплики
// «студента» через TTS, пишет ответ клиента в WAV и печатает расшифровку из БД.
//
// npx tsx --env-file=.env.local scripts/voice/ws-client.ts --user <uuid> [--url wss://…/api/practice/ws]
//   [--mode voice_first_minutes] [--client vera] [--rotate] [--out <папка>]
// --rotate  после первой реплики переподключиться по новому билету (проверка продолжения разговора).
import { GoogleGenAI, Modality } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { mkdirSync, writeFileSync } from "node:fs";
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

const DRILL_LINES = ["Да, я учусь. А что для вас важно в этом вопросе?"];
const FULL_LINES = [
  "Здравствуйте, Вера. Меня зовут Мария, я психолог. Расскажите, что вас привело?",
  "Похоже, вы очень устали за эти два месяца. Чего вы ожидаете от нашего разговора?",
  "У нас сегодня около сорока минут, и к концу я хотела бы понять, с чем именно вы хотите работать.",
];
const LINES = MOMENT ? DRILL_LINES : FULL_LINES;

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
      seconds_limit: MOMENT ? 120 : 240,
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
  let ws = await connect(t.ticket);
  let lastAudio = 0;
  function wire(sock: WebSocket) {
    sock.on("message", (data, isBinary) => {
      if (isBinary) {
        clientAudio.push(data as Buffer);
        lastAudio = Date.now();
      } else {
        const m = JSON.parse(String(data));
        if (m.t !== "state") console.log("  ←", JSON.stringify(m));
      }
    });
  }
  wire(ws);

  if (MOMENT) {
    // Клиент начинает сам: ждём его реплику.
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      ws.send(quietNoise(40, 16000));
      await sleep(40);
      if (lastAudio && Date.now() - lastAudio > 1500) break;
    }
    console.log(`  (реплика клиента: ${clientAudio.length} кадров)`);
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
    for (let o = 0; o < audio[i].length; o += 1280) {
      ws.send(audio[i].subarray(o, o + 1280));
      await sleep(40);
    }
    const started = Date.now();
    lastAudio = 0;
    // тишина, пока клиент не договорит (1,5 с без звука после начала ответа) или 20 с
    while (Date.now() - started < 20000) {
      ws.send(quietNoise(40, 16000));
      await sleep(40);
      if (lastAudio && Date.now() - lastAudio > 1500) break;
    }
  }

  ws.send(JSON.stringify({ t: "end" }));
  await sleep(3000);
  const { data: turns } = await db.from("voice_turns").select("seq, role, text").eq("session_id", s.id).order("seq");
  const { data: fin } = await db.from("voice_sessions").select("status, end_reason, seconds_used, reconnects, usage").eq("id", s.id).single();
  console.log("\nРасшифровка из БД:");
  for (const tr of turns ?? []) console.log(`  ${tr.seq}. ${tr.role === "client" ? "КЛИЕНТ" : "СТУДЕНТ"}: ${tr.text}`);
  console.log("\nСессия:", JSON.stringify(fin));
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "client.wav"), wavFile(Buffer.concat(clientAudio), 24000));
  console.log("звук:", join(OUT, "client.wav"));
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
