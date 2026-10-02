// Одно WebSocket-соединение голосовой сессии: билет → движок → звук туда-обратно,
// расшифровка в voice_turns, учёт секунд, сигналы клиенту-модели, завершение.
// Состояние разговора живёт в БД, поэтому соединение можно в любой момент открыть заново
// (обрыв сети, сворачивание, предел длительности функции Vercel) — движок
// переоткрывается с историей из voice_turns.
import { randomBytes } from "node:crypto";
import type { WebSocket, RawData } from "ws";
import { createServiceClient } from "@/lib/supabase-server";
import { getConfigs } from "@/lib/config";
import { createEngine } from "./engine";
import type { HistoryTurn, VoiceEngine } from "./engine/types";
import { EngineUnavailableError } from "./engine/types";
import { buildInstruction } from "./prompt";
import { hashTicket } from "./ticket";
import type { ClientMessage, EndReason, ErrorCode, ServerMessage } from "./protocol";

type Db = ReturnType<typeof createServiceClient>;

const LIVE = ["created", "active", "paused", "reconnecting"];
const TICK_MS = 15_000;
/** Через сколько после открытия соединения попросить браузер переподключиться (предел функции 300 с). */
const ROTATE_AFTER_MS = 270_000;
const MODEL_SILENCE_MS = 7_000;
const AFTER_TIME_UP_MS = 25_000;
/** Прощание студента: после ответа клиента встреча закрывается сама, без «до свидания» по кругу. */
const FAREWELL_RE = /(до свидания|всего (хорошего|доброго)|до (встречи|следующей)|увидимся|прощайте|на сегодня (всё|все|заканчиваем))/iu;
/** Студент молчит после реплики клиента — клиенту сигнал «психолог выдерживает паузу». */
const STUDENT_PAUSE_MS = 8_000;

interface SessionRow {
  id: string;
  user_id: string;
  program_mode_id: string;
  client_id: string | null;
  status: string;
  seconds_limit: number;
  seconds_used: number;
  started_at: string | null;
  usage: Record<string, number> | null;
  reconnects: number;
  kind: string;
  drill_moment_id: string | null;
}

export interface DrillMoment {
  id: string;
  client_slug: string;
  title: string;
  context: string;
  line: string;
  tone?: string;
  /** Заголовок рамки вместо «Трудного момента» (разминка «Первые слова»); место во встрече — в context. */
  scene?: string;
}

/** Рамка «Трудного момента» и разминки: клиент сам начинает с реплики и отвечает один раз. */
function drillFrame(m: DrillMoment): string {
  return [
    m.scene ?? "РЕЖИМ: ТРУДНЫЙ МОМЕНТ",
    m.scene ? m.context : `Это середина встречи. ${m.context}`,
    `Когда получишь сигнал [СИСТЕМА: начинай], сразу произнеси ровно эту реплику${m.tone ? ` (${m.tone})` : ""}: «${m.line}». Не здоровайся, ничего не добавляй до неё.`,
    "Потом жди ответа психолога. На его ответ отреагируй одной репликой строго по своим правилам: если он попал — чуть теплеешь и говоришь больше; если оправдывался, советовал, утешал шаблонно или спорил — закрываешься. Если психолог продолжает разговор — продолжай по своим правилам, как на обычной встрече: тема та же, скрытое по-прежнему раскрывается только при выполнении условий.",
  ].join("\n");
}

export async function runVoiceSession(ws: WebSocket): Promise<void> {
  const db = createServiceClient();
  const send = (m: ServerMessage) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
  };
  const fail = (code: ErrorCode, message: string) => {
    send({ t: "error", code, message });
    ws.close(1008, code);
  };

  const ticket = await waitForAuth(ws);
  if (!ticket) return fail("auth_timeout", "Нет билета подключения");

  const { data: session } = await db
    .from("voice_sessions")
    .update({ ticket_hash: null, ticket_expires_at: null, conn_id: randomBytes(8).toString("hex") })
    .eq("ticket_hash", hashTicket(ticket))
    .gt("ticket_expires_at", new Date().toISOString())
    .in("status", LIVE)
    .select("id, user_id, program_mode_id, client_id, status, seconds_limit, seconds_used, started_at, usage, reconnects, kind, drill_moment_id, conn_id")
    .maybeSingle();
  if (!session) return fail("ticket_invalid", "Билет недействителен — обновите страницу");

  const s = session as SessionRow & { conn_id: string };
  const conn = new VoiceConnection(ws, db, s, send);
  await conn.start();
}

class VoiceConnection {
  private engine: VoiceEngine | null = null;
  private ended = false;
  private paused = false;
  private secondsLeft: number;
  private lastTickAt = Date.now();
  private seq = 0;
  private buf: { role: "student" | "client"; text: string; startMs: number } | null = null;
  private timers: NodeJS.Timeout[] = [];
  private silenceTimer: NodeJS.Timeout | null = null;
  private pauseTimer: NodeJS.Timeout | null = null;
  private signalsSent = new Set<string>();
  private usage = { prompt: 0, response: 0 };
  private sessionStartMs = 0;
  private drill: DrillMoment | null = null;
  private clientTurns = 0;
  private clientSpoke = false;
  private clientInterrupted = false;
  private studentWords = 0;

  constructor(
    private ws: WebSocket,
    private db: Db,
    private s: SessionRow & { conn_id: string },
    private send: (m: ServerMessage) => void,
  ) {
    this.secondsLeft = Math.max(0, s.seconds_limit - s.seconds_used);

  }

  async start() {
    const { db, s } = this;
    if (this.secondsLeft <= 0) return this.end("time_limit");

    const [{ data: mode }, { data: client }, cfg, { data: turns }] = await Promise.all([
      db.from("voice_modes").select("frame_prompt, engine, drill_moments, program_modes!inner(mode_templates!inner(key))").eq("program_mode_id", s.program_mode_id).maybeSingle(),
      s.client_id
        ? db.from("voice_clients").select("prompt, voice_name").eq("id", s.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
      getConfigs(["voice_global_rules", "voice_silence_ms", "voice_engine"]),
      db.from("voice_turns").select("seq, role, text").eq("session_id", s.id).order("seq"),
    ]);
    if (!mode || !client) {
      this.send({ t: "error", code: "session_not_found", message: "Режим или учебный клиент не настроены" });
      return this.end("engine_error");
    }

    const history: HistoryTurn[] = (turns ?? []).map((t) => ({ role: t.role as HistoryTurn["role"], text: t.text }));
    this.seq = turns?.length ? Math.max(...turns.map((t) => t.seq)) : 0;
    const resumed = history.length > 0;
    const modeKey = (mode?.program_modes as unknown as { mode_templates: { key: string } } | null)?.mode_templates?.key;
    this.autoEndDrill = modeKey !== "voice_hard_moments";
    if (s.kind === "drill") {
      const moments = (mode.drill_moments as DrillMoment[] | null) ?? [];
      this.drill = moments.find((m) => m.id === s.drill_moment_id) ?? null;
      if (!this.drill) {
        this.send({ t: "error", code: "session_not_found", message: "Трудный момент не найден" });
        return this.end("engine_error");
      }
    }
    const startedAt = s.started_at ? new Date(s.started_at).getTime() : Date.now();
    this.sessionStartMs = startedAt;

    const engineName = (mode.engine as string | null) || (cfg.voice_engine as string | undefined) || process.env.VOICE_ENGINE || "gemini";
    try {
      this.engine = createEngine(engineName);
      await this.engine.connect(
        {
          instruction: buildInstruction({
            globalRules: String(cfg.voice_global_rules ?? ""),
            framePrompt: this.drill
              ? `${mode.frame_prompt}\n\n${drillFrame(this.drill)}`
              : mode.frame_prompt,
            personaPrompt: client.prompt,
            resumed,
          }),
          voiceName: client.voice_name,
          history: resumed ? history : undefined,
          silenceMs: Number(cfg.voice_silence_ms ?? 900),
        },
        {
          onAudio: (pcm) => {
            if (!this.clientSpoke) {
              this.turnAudioBytes = 0;
              this.turnAudioStartAt = Date.now();
            }
            this.turnAudioBytes += pcm.length;
            this.clientSpoke = true;
            this.clearSilenceTimer();
            this.setSpeaking("client");
            if (this.ws.readyState === this.ws.OPEN) this.ws.send(pcm, { binary: true });
          },
          onTranscript: (t) => this.addTranscript(t.role, t.text),
          onInterrupted: () => {
            this.clientInterrupted = true;
            this.send({ t: "interrupted" });
          },
          onTurnComplete: () => {
            const spoke = this.clientSpoke;
            // Студент попрощался (или время вышло) — клиент ответил, закрываем встречу.
            if (spoke && !this.drill && (this.farewellHeard || this.signalsSent.has("time_up"))) {
              // Звук генерируется быстрее, чем звучит: ждём, пока реплика доиграет у студента.
              const playMs = this.turnAudioBytes / 48; // PCM16 24 кГц = 48 байт/мс
              const wait = Math.max(1500, this.turnAudioStartAt + playMs - Date.now() + 800);
              this.timers.push(setTimeout(() => void this.end(this.signalsSent.has("time_up") ? "time_limit" : "student"), wait));
            }
            const cut = this.clientInterrupted;
            this.clientSpoke = false;
            this.clientInterrupted = false;
            if (spoke) this.armStudentPause();
            // Студент сделал паузу посреди ответа, клиент начал реагировать, студент продолжил —
            // перебитая реплика реакцией не считается: клиент ответит, когда студент договорит.
            if (this.drill && spoke && !(cut && this.clientTurns >= 1)) {
              this.clientTurns += 1;
              // Попытка окончена, когда после настоящего ответа студента (≥2 слов)
              // клиент отреагировал. Эхо и «угу» ответом не считаются.
              if (this.studentWords >= 2 && this.clientTurns >= 2 && !this.attemptDone) {
                this.attemptDone = true;
                if (this.autoEndDrill) {
                  // Разминка: одна реплика — один ответ — одна реакция, дальше подсказка.
                  const wait = Math.max(1500, this.turnAudioStartAt + this.turnAudioBytes / 48 - Date.now() + 800);
                  this.timers.push(setTimeout(() => void this.end("student"), wait));
                } else {
                  // Трудный момент: попытка засчитана, но студент может продолжить разговор
                  // и «дожать» клиента; к разбору — кнопкой.
                  this.send({ t: "attempt_done" });
                }
              }
            }
            this.flushTurn();
            this.setSpeaking("idle");
          },
          onGoAway: (ms) => {
            console.log("[voice] goAway", s.id, ms);
            this.send({ t: "rotate" });
          },
          onUsage: (u) => {
            this.usage.prompt += u.promptTokens;
            this.usage.response += u.responseTokens;
          },
          onClose: (r) => {
            if (!this.ended && !this.paused) {
              console.error("[voice] engine closed", s.id, r);
              this.send({ t: "rotate" });
            }
          },
        },
      );
    } catch (e) {
      const unavailable = e instanceof EngineUnavailableError;
      this.send({ t: "error", code: "engine_unavailable", message: unavailable ? e.message : "Учебный клиент недоступен, попробуйте через минуту" });
      console.error("[voice] engine connect failed", s.id, e);
      await this.db.from("voice_sessions").update({ status: s.status === "created" ? "failed" : "reconnecting", end_reason: "engine_error" }).eq("id", s.id);
      this.ws.close(1011, "engine_unavailable");
      return;
    }

    await db
      .from("voice_sessions")
      .update({
        status: "active",
        started_at: s.started_at ?? new Date(startedAt).toISOString(),
        paused_at: null,
        last_heartbeat_at: new Date().toISOString(),
        reconnects: s.status === "created" ? s.reconnects : s.reconnects + 1,
      })
      .eq("id", s.id);

    console.log("[voice] connected", s.id, { from: s.status, resumed, secondsLeft: this.secondsLeft });
    this.send({ t: "ready", sessionId: s.id, secondsLeft: this.secondsLeft, resumed });

    this.ws.on("message", (data: RawData, isBinary: boolean) => this.onMessage(data, isBinary));
    this.ws.on("close", (code: number, reason: Buffer) => {
      console.log("[voice] socket closed", s.id, { code, reason: String(reason), paused: this.paused, ended: this.ended });
      void this.onSocketClose();
    });
    this.timers.push(setInterval(() => void this.tick(), TICK_MS));
    this.timers.push(setTimeout(() => this.send({ t: "rotate" }), ROTATE_AFTER_MS));
    if (this.drill && !resumed) this.engine.kick("[СИСТЕМА: начинай]");
    this.lastTickAt = Date.now();
  }

  private onMessage(data: RawData, isBinary: boolean) {
    if (this.ended) return;
    if (isBinary) {
      if (!this.paused) this.engine?.sendAudio(data as Buffer);
      return;
    }
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    if (msg.t === "end") void this.end("student");
    else if (msg.t === "pause") this.paused = true;
  }

  private setSpeaking(speaking: "client" | "student" | "idle") {
    this.send({ t: "state", speaking, secondsLeft: this.secondsLeft });
  }

  /** Модель Live сама на тишину не отвечает: без сигнала выдержанная пауза студента повисает. */
  private armStudentPause() {
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.pauseTimer = setTimeout(() => {
      this.pauseTimer = null;
      if (this.ended || this.paused) return;
      this.engine?.kick("[СИСТЕМА: психолог молчит]");
    }, STUDENT_PAUSE_MS);
  }

  private farewellHeard = false;
  private attemptDone = false;
  /** Разминка закрывает попытку сама; «Трудный момент» — по кнопке студента. */
  private autoEndDrill = true;
  private turnAudioBytes = 0;
  private turnAudioStartAt = 0;

  private addTranscript(role: "student" | "client", text: string) {
    if (role === "student" && FAREWELL_RE.test(text)) this.farewellHeard = true;
    if (role === "student" && this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
    if (role === "student" && this.clientTurns >= 1) this.studentWords += text.split(/\s+/).filter(Boolean).length;
    if (this.buf && this.buf.role !== role) this.flushTurn();
    if (!this.buf) this.buf = { role, text: "", startMs: Date.now() - this.sessionStartMs };
    this.buf.text += text;
    if (role === "student") {
      this.setSpeaking("student");
      this.armSilenceTimer();
    }
  }

  private flushTurn() {
    const b = this.buf;
    this.buf = null;
    if (!b || !b.text.trim()) return;
    this.seq += 1;
    void this.db
      .from("voice_turns")
      .insert({
        session_id: this.s.id,
        seq: this.seq,
        role: b.role,
        text: b.text.trim(),
        t_start_ms: b.startMs,
        t_end_ms: Date.now() - this.sessionStartMs,
      })
      .then(({ error }) => {
        if (error) console.error("[voice] turn insert failed", this.s.id, error.message);
      });
  }

  /** Студент договорил, а модель молчит: один толчок, потом подсказка в браузер. */
  private armSilenceTimer() {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      this.engine?.sendHiddenText("[СИСТЕМА: продолжай]");
      this.silenceTimer = setTimeout(() => {
        console.log("[voice] client silent", this.s.id);
        this.send({ t: "client_silent" });
      }, MODEL_SILENCE_MS);
    }, MODEL_SILENCE_MS);
  }

  private clearSilenceTimer() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
  }

  private signalOnce(key: string, text: string) {
    if (this.signalsSent.has(key)) return;
    this.signalsSent.add(key);
    this.engine?.sendHiddenText(text);
  }

  private async tick() {
    if (this.ended) return;
    const now = Date.now();
    const seconds = this.paused ? 0 : Math.round((now - this.lastTickAt) / 1000);
    this.lastTickAt = now;
    // Сессию забрало новое соединение (вторая вкладка, переподключение) — это закрываем.
    const { data: owner } = await this.db.from("voice_sessions").select("conn_id, status").eq("id", this.s.id).single();
    if (owner && (owner.conn_id !== this.s.conn_id || owner.status === "ended")) {
      this.ended = true;
      this.stopTimers();
      await this.engine?.close();
      this.send({ t: "error", code: "superseded", message: "Консультация продолжается в другом окне" });
      if (this.ws.readyState === this.ws.OPEN) this.ws.close(1000, "superseded");
      return;
    }
    const { data, error } = await this.db.rpc("voice_session_tick", { p_session_id: this.s.id, p_seconds: seconds });
    if (error) return console.error("[voice] tick failed", this.s.id, error.message);
    this.secondsLeft = Number(data ?? 0);
    void this.flushUsage();

    const limit = this.s.seconds_limit;
    const used = limit - this.secondsLeft;
    if (used >= limit * 0.5) this.signalOnce("half", "[СИСТЕМА: середина встречи]");
    // Короткий режим (до 6 минут) предупреждаем за минуту, длинный — за две.
    const warnAt = limit >= 360 ? 120 : 60;
    if (this.secondsLeft <= warnAt) {
      this.signalOnce("warn", warnAt === 120 ? "[СИСТЕМА: осталось 2 минуты]" : "[СИСТЕМА: осталась 1 минута]");
      this.send({ t: "state", speaking: "idle", secondsLeft: this.secondsLeft, warn: true });
    }
    if (this.secondsLeft <= 0 && !this.signalsSent.has("time_up")) {
      this.signalOnce("time_up", "[СИСТЕМА: время вышло]");
      this.timers.push(setTimeout(() => void this.end("time_limit"), AFTER_TIME_UP_MS));
    }
  }

  /** Прибавить накопленный расход токенов (не перезаписывая чужие соединения). */
  private async flushUsage() {
    const { prompt, response } = this.usage;
    if (!prompt && !response) return;
    this.usage = { prompt: 0, response: 0 };
    await this.db.rpc("voice_session_add_usage", { p_session_id: this.s.id, p_prompt: prompt, p_response: response });
  }

  private stopTimers() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.pauseTimer = null;
    this.clearSilenceTimer();
  }

  async end(reason: EndReason) {
    if (this.ended) return;
    this.ended = true;
    this.stopTimers();
    this.flushTurn();
    await this.engine?.close();
    const seconds = Math.round((Date.now() - this.lastTickAt) / 1000);
    await this.db.rpc("voice_session_tick", { p_session_id: this.s.id, p_seconds: this.paused ? 0 : seconds });
    await this.db
      .from("voice_sessions")
      .update({
        status: "ended",
        end_reason: reason,
        ended_at: new Date().toISOString(),
      })
      .eq("id", this.s.id)
      .in("status", LIVE);
    await this.flushUsage();
    await this.db.from("voice_debriefs").upsert({ session_id: this.s.id, status: "queued" }, { onConflict: "session_id", ignoreDuplicates: true });
    this.send({ t: "ended", reason });
    if (this.ws.readyState === this.ws.OPEN) this.ws.close(1000, "ended");
  }

  private async onSocketClose() {
    if (this.ended) return;
    this.ended = true;
    this.stopTimers();
    this.flushTurn();
    await this.engine?.close();
    const seconds = this.paused ? 0 : Math.round((Date.now() - this.lastTickAt) / 1000);
    await this.db.rpc("voice_session_tick", { p_session_id: this.s.id, p_seconds: seconds });
    await this.flushUsage();
    // Сессию закрывает не сокет: браузер переподключится по новому билету,
    // а брошенные сессии добирает уборка по last_heartbeat_at.
    await this.db
      .from("voice_sessions")
      .update({
        status: this.paused ? "paused" : "reconnecting",
        paused_at: this.paused ? new Date().toISOString() : null,
      })
      .eq("id", this.s.id)
      .eq("conn_id", this.s.conn_id)
      .in("status", ["active"]);
  }
}

function waitForAuth(ws: WebSocket): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 5000);
    ws.once("message", (data: RawData, isBinary: boolean) => {
      clearTimeout(timer);
      if (isBinary) return resolve(null);
      try {
        const m = JSON.parse(String(data)) as ClientMessage;
        resolve(m.t === "auth" && typeof m.ticket === "string" ? m.ticket : null);
      } catch {
        resolve(null);
      }
    });
  });
}
