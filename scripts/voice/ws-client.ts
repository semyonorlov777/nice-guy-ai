// Сквозная проверка голосовой сессии без браузера: создаёт сессию тестовому
// пользователю (service role), подключается к WebSocket сайта, озвучивает реплики
// «студента» через TTS, пишет ответ клиента в WAV и печатает расшифровку из БД.
//
// npx tsx --env-file=.env.local scripts/voice/ws-client.ts --user <uuid> [--url wss://…/api/practice/ws]
//   [--mode voice_first_minutes] [--client vera] [--rotate] [--out <папка>]
//   [--lines <файл>] [--seconds <лимит>] [--json <файл>] [--tts-cache <папка>] [--tts gemini|say]
// --rotate  после первой реплики переподключиться по новому билету (проверка продолжения разговора).
// --lines   свои реплики студента: по одной в строке, «#» — комментарий, «[тишина N]» — молчать N секунд.
// --client-first  клиент заговорит первым (режим без момента, например voice_closing).
// --until-ended  (с --moment) ждать, пока сервер сам закроет попытку, а не конца хода клиента.
// --burst   реплики студента слать разом, а не в темпе речи (как браузер досылает звук после обрыва).
// --json    сохранить итог прогона: реплики, длительность и задержку ответа клиента, расшифровку из БД.
// --text    реплики студента текстом, без озвучки (стенд проверки: пользователь должен быть в app_config.voice_stand_users).
// --persona <файл>  студент-бот: следующую реплику пишет модель по описанию студента и ходу разговора
//           (вместо готовых строк; во встрече — до конца времени или «[КОНЕЦ]», в разборе — по этапам).
// --debrief <id встречи>  голосовой разбор этой встречи (встреча — того же --user): голоса говорят первыми,
//           реплики студента — после каждой их реплики; передача слова между голосами — через rotate.
import { GoogleGenAI, Modality } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { newTicket } from "../../lib/voice-practice/ticket";
import { createOrResumeDebrief } from "../../lib/voice-practice/debrief-voice";
import { claimDebrief } from "../../lib/voice-practice/debrief";
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
const TTS_CACHE = arg("--tts-cache", "./ws-client-out/tts-cache")!;
const TTS_ENGINE = arg("--tts", "gemini")!;
const UNTIL_ENDED = args.includes("--until-ended");
// --client-first  клиент говорит первым и без момента («Мягкая посадка»).
const CLIENT_FIRST = args.includes("--client-first");
const BURST = args.includes("--burst");
const DEBRIEF = arg("--debrief");
const TEXT = args.includes("--text") || args.includes("--persona");
const PERSONA_FILE = arg("--persona");
const PERSONA = PERSONA_FILE ? readFileSync(PERSONA_FILE, "utf8") : null;
/** Студент-бот: сколько реплик во встрече самое большее. */
const PERSONA_MAX_TURNS = 60;

const DRILL_LINES = ["Да, я учусь. А что для вас важно в этом вопросе?"];
const FULL_LINES = [
  "Здравствуйте, Вера. Меня зовут Мария, я психолог. Расскажите, что вас привело?",
  "Похоже, вы очень устали за эти два месяца. Чего вы ожидаете от нашего разговора?",
  "У нас сегодня около сорока минут, и к концу я хотела бы понять, с чем именно вы хотите работать.",
];
// Разбор: реплики по этапам («## 1» — о себе, «## 2» — клиенту вне роли, «## 3» — наблюдателю, «## 4» — проба фразы клиенту в роли).
const DEBRIEF_LINES = [
  "## 1",
  "Немного волновалась, но в целом нормально.",
  "Мне кажется, получилось подвести итог. А труднее всего было, когда она сказала, что муж говорит, что она выдумывает. Я не знала, что ответить.",
  "Растерянность, наверное.",
  "## 2",
  "Да. Что бы вам помогло, когда я посоветовала побыть одной?",
  "Спасибо, понятно.",
  "## 3",
  "Да, давайте.",
  "Наверное, ей стало неловко, будто я её не слышу и сразу советую.",
  "Сначала откликаться на чувства клиента, а советы потом.",
  "## 4",
  "Вы так устали, а ещё и вините себя за то, что срываетесь. Это очень тяжело.",
];
const LINES: string[] = PERSONA ? [] : LINES_FILE
  ? readFileSync(LINES_FILE, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && (!l.startsWith("#") || l.startsWith("## ")))
  : DEBRIEF ? DEBRIEF_LINES : MOMENT ? DRILL_LINES : FULL_LINES;
const silenceOf = (line: string) => Number(/^\[тишина (\d+)\]$/.exec(line)?.[1] ?? 0);
const CLIENT_RATE = 24000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!USER) throw new Error("--user <uuid> обязателен");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });

  // Озвучка до создания сессии; кэш на диске — у TTS лимит 10 запросов в минуту.
  console.log("озвучиваю реплики…");
  const audio: Buffer[] = [];
  for (const text of LINES) audio.push(TEXT || silenceOf(text) || text.startsWith("## ") ? Buffer.alloc(0) : await tts(ai, text));
  if (PERSONA && !DEBRIEF) for (let k = 0; k < PERSONA_MAX_TURNS; k++) audio.push(Buffer.alloc(0));
  if (DEBRIEF) return runDebrief(db, DEBRIEF, audio, ai);

  const { data: pm } = await db
    .from("program_modes")
    .select("id, programs!inner(id, slug), mode_templates!inner(key)")
    .eq("programs.slug", "mipp-praktikum")
    .eq("mode_templates.key", MODE)
    .single();
  const { data: client } = await db.from("voice_clients").select("id").eq("slug", CLIENT).single();
  if (!pm || !client) throw new Error("режим или клиент не найдены");
  // Брошенные сессии бота закрываем: живая сессия у пользователя одна (стенд гоняет встречи бота по очереди).
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

  const clientAudio: Buffer[] = [];
  let clientBytes = 0;
  const steps: { student: string; clientSec: number; latencyMs: number | null }[] = [];
  let ws = await connect(t.ticket);
  let lastAudio = 0;
  // Сервер шлёт state idle, когда клиент закончил ход (turnComplete): по нему
  // и ждём конца реплики — паузы внутри реплики бывают длиннее секунды.
  let clientDone = false;
  let serverEnded = false;
  // Подтверждения «звук дошёл» (heard): сколько пришло и самое долгое затишье между ними.
  const heard = { count: 0, lastAt: 0, maxGapMs: 0, speechMs: 0, bytes: 0 };
  // Живой студент дослушивает реплику: звук приходит быстрее, чем звучит, поэтому
  // ждём, пока реплика «доиграла бы» в наушниках (24 кГц PCM16 = 48 байт/мс).
  let replyStartAt = 0;
  let replyBytes = 0;
  const playedOut = () => replyStartAt > 0 && Date.now() >= replyStartAt + replyBytes / 48 + 600;
  const replyOver = () =>
    UNTIL_ENDED && serverEnded
      ? true
      : (clientDone && playedOut() && !UNTIL_ENDED) || (lastAudio > 0 && playedOut() && Date.now() - lastAudio > (UNTIL_ENDED ? 8000 : 4000));
  function wire(sock: WebSocket) {
    sock.on("message", (data, isBinary) => {
      if (isBinary) {
        clientAudio.push(data as Buffer);
        clientBytes += (data as Buffer).length;
        if (!replyStartAt) replyStartAt = Date.now();
        replyBytes += (data as Buffer).length;
        lastAudio = Date.now();
      } else {
        const m = JSON.parse(String(data));
        // idle до первого звука ответа — не конец реплики клиента.
        if (m.t === "state" && m.speaking === "idle" && replyStartAt) clientDone = true;
        if (m.t === "ended") serverEnded = true;
        if (m.t === "heard") {
          const now = Date.now();
          if (heard.lastAt) heard.maxGapMs = Math.max(heard.maxGapMs, now - heard.lastAt);
          heard.lastAt = now;
          heard.count += 1;
          heard.speechMs = m.speechMs;
          heard.bytes = m.bytes;
          return;
        }
        if (m.t !== "state") console.log("  ←", JSON.stringify(m));
      }
    });
  }
  wire(ws);

  if (MOMENT || CLIENT_FIRST) {
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
    if (serverEnded) break;
    if (PERSONA) {
      const line = await personaLine(ai, db, s.id, "встреча");
      if (line === null) break;
      LINES[i] = line;
    }
    console.log(`→ ${LINES[i]}`);
    if (ws.readyState !== ws.OPEN) break;
    // Счёт начинаем до отправки: клиент может заговорить, пока реплика студента ещё идёт
    // (пауза внутри реплики закрывает ход). Тогда задержка выйдет отрицательной.
    const bytesBefore = clientBytes;
    let firstAudio = 0;
    lastAudio = 0;
    clientDone = false;
    replyStartAt = 0;
    replyBytes = 0;
    if (TEXT && !silenceOf(LINES[i])) ws.send(JSON.stringify({ t: "say", text: LINES[i] }));
    for (let o = 0; o < audio[i].length; o += 1280) {
      ws.send(audio[i].subarray(o, o + 1280));
      if (BURST) continue;
      await sleep(40);
      if (lastAudio && !firstAudio) firstAudio = lastAudio;
    }
    const started = Date.now();
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
  console.log(
    `Подтверждения heard: ${heard.count}, самое долгое затишье ${heard.maxGapMs} мс, ` +
      `последнее: ${heard.bytes} байт, речи ${(heard.speechMs / 1000).toFixed(1)} с`,
  );
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "client.wav"), wavFile(Buffer.concat(clientAudio), 24000));
  console.log("звук:", join(OUT, "client.wav"));
  if (JSON_OUT) {
    writeFileSync(JSON_OUT, JSON.stringify({ sessionId: s.id, mode: MODE, client: CLIENT, moment: MOMENT ?? null, steps, turns, session: fin }, null, 2));
    console.log("итог:", JSON_OUT);
  }
  process.exit(0);
}

/**
 * Голосовой разбор встречи: голоса говорят первыми; после каждой их реплики (когда она «доиграла»)
 * бот говорит следующую свою. Передача слова: сервер шлёт handover и rotate с билетом — бот
 * переподключается и ждёт реплику следующего голоса.
 */
async function runDebrief(db: ReturnType<typeof createClient>, parentId: string, audio: Buffer[], ai: GoogleGenAI) {
  // Текстовый разбор встречи считается в фоне, пока студент говорит о себе (как в браузере).
  // Сервер закрывает встречу чуть позже, чем бот попрощался: ждём, иначе разбор «not_ended».
  for (let k = 0; k < 30; k++) {
    const { data } = await db.from("voice_sessions").select("status").eq("id", parentId).single();
    if (data?.status === "ended") break;
    if (k === 29) await db.from("voice_sessions").update({ status: "ended", end_reason: "student" }).eq("id", parentId);
    await sleep(2000);
  }
  const run = await claimDebrief(parentId);
  const notesT0 = Date.now();
  if (run) void run().then(() => console.log(`  (текстовый разбор встречи готов за ${Math.round((Date.now() - notesT0) / 1000)} с)`));
  const r = await createOrResumeDebrief(db as never, USER!, parentId);
  if (!r.ok) throw new Error(`разбор недоступен: ${r.reason}`);
  console.log("разбор", r.sessionId, r.resumed ? "(продолжение)" : "");
  const t0 = Date.now();
  const at = () => `${((Date.now() - t0) / 1000).toFixed(1)}с`;
  const aiAudio: Buffer[] = [];
  let ws = await connect(r.ticket);
  let replyStartAt = 0;
  let replyBytes = 0;
  let aiDone = false;
  let ended = false;
  let handover = false;
  let rotateAt = 0;
  let curSeg = 1;
  // Проба (этап 4): клиент в роли ждёт фразу студента — ход сразу за ботом.
  let studentFirst = false;
  const marks: string[] = [];
  // Реплики по этапам: у каждого этапа своя очередь (голоса могут задать лишний вопрос — бот не сбивается).
  const queues: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [] };
  let sec = 1;
  LINES.forEach((l, i) => {
    const m = /^## (\d)/.exec(l);
    if (m) sec = Number(m[1]);
    else queues[sec].push(i);
  });
  const playedOut = () => replyStartAt > 0 && Date.now() >= replyStartAt + replyBytes / 48 + 600;
  const wire = (sock: WebSocket) => {
    sock.on("message", (data, isBinary) => {
      if (sock !== ws) return;
      if (isBinary) {
        aiAudio.push(data as Buffer);
        if (!replyStartAt) {
          replyStartAt = Date.now();
          if (rotateAt) {
            marks.push(`переход: ${Date.now() - rotateAt} мс от rotate до первого звука`);
            rotateAt = 0;
          }
        }
        replyBytes += (data as Buffer).length;
        return;
      }
      const m = JSON.parse(String(data));
      if (m.t === "heard") return;
      if (m.t === "state") {
        if (m.speaking === "idle" && replyStartAt) aiDone = true;
        return;
      }
      console.log(`  ${at()} ←`, JSON.stringify(m));
      if (m.t === "ended") ended = true;
      if (m.t === "handover") handover = true;
      if (m.t === "speaker") {
        curSeg = m.segment;
        if (m.segment === 4) studentFirst = true;
      }
      if (m.t === "rotate") {
        rotateAt = Date.now();
        void (async () => {
          const old = sock;
          ws = await connect(m.ticket);
          wire(ws);
          old.close();
        })();
      }
    });
  };
  wire(ws);
  const tick = async () => {
    if (ws.readyState === ws.OPEN) ws.send(quietNoise(40, 16000));
    await sleep(40);
  };
  /** Дождаться, пока реплика голоса доиграет; после передачи слова — реплику следующего голоса. */
  const waitAi = async (limitMs: number) => {
    const s0 = Date.now();
    while (Date.now() - s0 < limitMs && !ended) {
      await tick();
      if (studentFirst && (!replyStartAt || playedOut())) {
        studentFirst = false;
        handover = false;
        aiDone = false;
        replyStartAt = 0;
        replyBytes = 0;
        return;
      }
      if (aiDone && playedOut()) {
        // Передача слова приходит чуть позже конца реплики.
        for (let k = 0; k < 20; k++) await tick();
        aiDone = false;
        replyStartAt = 0;
        replyBytes = 0;
        if (handover) {
          handover = false;
          continue;
        }
        return;
      }
    }
  };
  while (!ended) {
    await waitAi(60_000);
    if (ended) break;
    let i = queues[curSeg]?.shift();
    if (PERSONA) {
      const line = await personaLine(ai, db, r.sessionId, `разбор, этап ${curSeg}`);
      if (line !== null) {
        LINES.push(line);
        audio.push(Buffer.alloc(0));
        i = LINES.length - 1;
      }
    }
    if (i === undefined) {
      // Реплики этапа кончились — молчим до следующей реплики голоса.
      console.log(`  ${at()} → (молчу)`);
      const s0 = Date.now();
      while (!ended && !replyStartAt && Date.now() - s0 < 40_000) await tick();
      if (!replyStartAt) break;
      continue;
    }
    console.log(`  ${at()} → ${LINES[i]}`);
    const hush = silenceOf(LINES[i]) * 1000;
    if (hush) {
      const s0 = Date.now();
      while (Date.now() - s0 < hush && !ended && !replyStartAt) await tick();
      continue;
    }
    if (TEXT && ws.readyState === ws.OPEN) ws.send(JSON.stringify({ t: "say", text: LINES[i] }));
    for (let o = 0; o < audio[i].length; o += 1280) {
      if (ws.readyState === ws.OPEN) ws.send(audio[i].subarray(o, o + 1280));
      await sleep(40);
    }
  }
  // Реплики кончились — молчим и ждём, пока разбор закончится сам.
  const s0 = Date.now();
  while (!ended && Date.now() - s0 < 150_000) await tick();
  await sleep(1500);
  const { data: turns } = await db.from("voice_turns").select("seq, role, text, segment").eq("session_id", r.sessionId).order("seq");
  const { data: fin } = await db.from("voice_sessions").select("status, end_reason, seconds_used, reconnects, usage, script_state").eq("id", r.sessionId).single();
  const who: Record<string, string> = { student: "СТУДЕНТ", client: "КЛИЕНТ ВНЕ РОЛИ", observer: "НАБЛЮДАТЕЛЬ" };
  console.log("\nРасшифровка разбора из БД:");
  for (const tr of turns ?? []) console.log(`  ${tr.segment}.${tr.seq} ${who[tr.role as string] ?? tr.role}: ${tr.text}`);
  console.log("\nСессия:", JSON.stringify(fin));
  for (const m of marks) console.log(" ", m);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "debrief.wav"), wavFile(Buffer.concat(aiAudio), 24000));
  console.log("звук:", join(OUT, "debrief.wav"));
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ sessionId: r.sessionId, parentId, turns, session: fin, marks }, null, 2));
  process.exit(0);
}

/**
 * Студент-бот: следующая реплика по описанию студента и расшифровке (из БД, как её видит сервер).
 * null — бот закончил («[КОНЕЦ]») или молчит.
 */
async function personaLine(ai: GoogleGenAI, db: ReturnType<typeof createClient>, sessionId: string, where: string): Promise<string | null> {
  const { data: turns } = await db.from("voice_turns").select("role, text").eq("session_id", sessionId).order("seq");
  const who: Record<string, string> = { student: "Я (психолог)", client: "Клиент", observer: "Наблюдатель" };
  const log = (turns ?? []).map((t) => `${who[t.role as string] ?? t.role}: ${t.text}`).join("\n") || "(разговор ещё не начался)";
  const prompt = `${PERSONA}\n\nСЕЙЧАС: ${where}.\nРАСШИФРОВКА ДО ЭТОГО МОМЕНТА:\n${log}\n\nНапиши только свою следующую реплику — одну, устной речью, как сказал бы вслух (без кавычек, без ремарок). Если по описанию тебе пора закончить или сказать нечего — напиши [КОНЕЦ].`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      // Быстрая модель без размышлений: живой студент отвечает за секунды, а не за полминуты.
      const r = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt, config: { temperature: 1, thinkingConfig: { thinkingBudget: 0 } } });
      const text = (r.text ?? "").trim().replace(/^["«]|["»]$/g, "");
      if (!text || text.includes("[КОНЕЦ]")) return null;
      return text;
    } catch (e) {
      console.log("  студент-бот: повтор после ошибки", String(e).slice(0, 120));
      await sleep(3000 * (attempt + 1));
    }
  }
  return null;
}

/** Голос macOS (Milena) — запасной путь, когда у Gemini TTS кончился дневной лимит. */
function sayTts(text: string): Buffer {
  const tmp = join(TTS_CACHE, `say-${process.pid}.wav`);
  mkdirSync(TTS_CACHE, { recursive: true });
  execFileSync("say", ["-v", "Milena", "-o", tmp, "--file-format=WAVE", "--data-format=LEI16@16000", text]);
  const wav = readFileSync(tmp);
  const at = wav.indexOf("data");
  return wav.subarray(at + 8, at + 8 + wav.readUInt32LE(at + 4));
}

async function tts(ai: GoogleGenAI, text: string): Promise<Buffer> {
  const file = join(TTS_CACHE, createHash("sha1").update(text).digest("hex") + ".pcm");
  if (existsSync(file)) return readFileSync(file);
  if (TTS_ENGINE === "say") return sayTts(text);
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await ai.models.generateContent({
        model: "gemini-3.8-flash-tts",
        contents: [{ parts: [{ text }] }],
        config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } } },
      });
      const data = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
      const pcm = resamplePcm16(Buffer.from(data!, "base64"), 24000, 16000);
      mkdirSync(TTS_CACHE, { recursive: true });
      writeFileSync(file, pcm);
      return pcm;
    } catch (e) {
      if ((e as { status?: number }).status !== 429) throw e;
      if (String(e).includes("per_day") || attempt >= 5) {
        console.log("  дневной лимит озвучки — голос macOS");
        return sayTts(text);
      }
      console.log("  лимит озвучки, жду 30 с…");
      await sleep(30000);
    }
  }
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
