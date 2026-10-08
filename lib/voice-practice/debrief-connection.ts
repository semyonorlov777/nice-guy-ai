// Соединение голосового разбора встречи: три этапа, у каждого свой голос (свой движок).
// Передача слова — прямо на сервере: старый движок закрывается, новый открывается со своей
// инструкцией и голосом и начинает, пока у студента доигрывает хвост прошлой реплики
// (воспроизведение в браузере — очередь, голоса не наложатся). Этап и сказанное — в БД
// (script_state, voice_turns.segment), поэтому обрыв сети, пауза, обновление страницы и предел
// функции Vercel (300 с) переживаются переподключением: новое соединение продолжает тот же этап.
// Внутри этапа шаги ведёт модель по сценарию из app_config.voice_debrief; сервер отвечает за
// границы этапов, тишину студента и лимиты, чтобы разбор обязательно закончился.
import type { WebSocket, RawData } from "ws";
import type { createServiceClient } from "@/lib/supabase-server";
import { createEngine } from "./engine";
import type { VoiceEngine } from "./engine/types";
import { EngineUnavailableError } from "./engine/types";
import { newTicket } from "./ticket";
import { PauseStretcher } from "./audio/pause-stretch";
import { isStandUser, type ClientMessage, type EndReason, type ServerMessage } from "./protocol";
import { getConfig } from "@/lib/config";
import { classifyProbe } from "./meaning";
import type { HistoryTurn } from "./engine/types";
import {
  SIGNAL,
  buildDebriefInstruction,
  buildRehearsal,
  rehearsalTarget,
  endsSegment,
  getDebriefConfig,
  loadDebriefContext,
  observerVoice,
  refreshNotes,
  type DebriefContext,
  type DebriefScriptState,
  type DebriefSegment,
  type DebriefTurn,
  type DebriefVoiceConfig,
} from "./debrief-voice";

type Db = ReturnType<typeof createServiceClient>;

export interface DebriefSessionRow {
  id: string;
  user_id: string;
  status: string;
  seconds_limit: number;
  seconds_used: number;
  started_at: string | null;
  reconnects: number;
  conn_id: string;
}

const LIVE = ["created", "active", "paused", "reconnecting"];
const TICK_MS = 15_000;
/** Предел функции 300 с: после 240 с соединение меняется в ближайшей паузе, после 285 — сразу. */
const ROTATE_SOFT_MS = Number(process.env.VOICE_DEBRIEF_ROTATE_SOFT_MS) || 240_000; // меньше — только для проверки
const ROTATE_HARD_MS = ROTATE_SOFT_MS + 45_000;
const OPEN_TIMEOUT_MS = 20_000;
/** Студент молчит после реплики голоса (считая от конца звучания). */
const STUDENT_PAUSE_MS = 8_000;
/** Проба: студенту нужно время придумать фразу клиенту — молчание дольше этого = «не знаю, что сказать». */
const PROBE_PAUSE_MS = 15_000;
/** Студент договорил, а голос молчит. */
const MODEL_SILENCE_MS = 7_000;
/** Хвост расшифровки реплики приходит чуть позже конца хода. */
const TRANSCRIPT_TAIL_MS = 600;
const HEARD_MS = 1_000;
const VOICE_RMS = 0.03;
/** Модель начинает звучать примерно через столько после «начинай» — новый голос будим заранее. */
const VOICE_LEAD_MS = 1_200;
/** Сколько ждать хвост прошлой реплики перед новым голосом, не больше. */
const MAX_KICK_WAIT_MS = 8_000;
/** Реплика голоса давно доиграла — после обрыва коротко повторить вопрос. */
const RESUME_REPEAT_MS = 15_000;
/** После сигнала «пора» — сколько ещё реплик голоса до принудительного конца этапа. */
const FORCE_AFTER_TURNS = 2;
/** Проба: звук студента, пока открывается голос клиента в роли, копим (до ~10 с) и досылаем. */
const PENDING_MAX_BYTES = 32 * 10_000;
/** Этап 1: «разбор готов» — не раньше второго ответа студента (иначе голос передаёт слово после «как вы»). */
const SEG1_MIN_ANSWERS = 2;
/** Итог сказан: после последнего звука столько тишины — и разбор закрывается (не резко, но сам). */
const CLOSE_AFTER_MS = 1_800;
/** Итог сказан, а конец хода не пришёл: столько без нового звука — считаем, что голос договорил. */
const CLOSE_QUIET_MS = 2_500;
/** Распознавание иногда пишет «угу» студента латиницей — в расшифровке по-русски (как в звонке). */
const LATIN_BACKCHANNEL_RE = /(^|\s)(m+-?h+-?m+|uh-?huh|a+-?ha|y|u+)(?=[\s.,!?…]|$)/giu;
const cyrillicBackchannel = (text: string) =>
  text.replace(LATIN_BACKCHANNEL_RE, (_m, sp: string, w: string) => sp + (/^a/i.test(w) ? "ага" : "угу"));
const wordCount = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

type TurnBuf = { role: DebriefTurn["role"]; text: string; startMs: number };

export class DebriefConnection {
  private cfg!: DebriefVoiceConfig;
  private ctx!: DebriefContext;
  private state: DebriefScriptState = {};
  private seg: DebriefSegment = 1;
  private aiRole: "observer" | "client" = "observer";
  private engine: VoiceEngine | null = null;
  /** Поколение движка: события закрытого (прошлого голоса) не учитываются. */
  private gen = 0;
  /** Голос этапа звучит: звук студента идёт в движок только после этого (иначе двойной ответ). */
  private live = false;
  /** Ждём первый звук нового голоса: сказанное в паузе передачи слова в движок не идёт. */
  private awaitingVoice = false;
  /** Идёт смена голоса — решения и тишина не считаются. */
  private switching = false;
  private ended = false;
  private closing = false;
  private paused = false;
  private rotated = false;
  private secondsLeft: number;
  private lastTickAt = Date.now();
  private connOpenedAt = Date.now();
  private sessionStartMs = 0;
  private seq = 0;
  /**
   * Расшифровка копится отдельно для студента и голоса: распознавание речи студента часто приходит,
   * когда голос уже отвечает, — так реплика студента ложится перед ответом, а не разрывает его.
   */
  private studentBuf: TurnBuf | null = null;
  private aiBuf: TurnBuf | null = null;
  private inserts: Promise<unknown> = Promise.resolve();
  private timers: NodeJS.Timeout[] = [];
  private pauseTimer: NodeJS.Timeout | null = null;
  private silenceTimer: NodeJS.Timeout | null = null;
  private usage = { prompt: 0, response: 0 };
  private aiSpoke = false;
  private aiText = "";
  private turnAudioBytes = 0;
  private turnAudioStartAt = 0;
  private segStudentTurns = 0;
  private segAiTurns = 0;
  private segSilences = 0;
  private signals = new Set<string>();
  private aiTurnsSinceSignal = 0;
  private notesSignaled = false;
  private wantRotate = false;
  private turns: DebriefTurn[] = [];
  private rxBytes = 0;
  private rxSpeechMs = 0;
  private heardBytes = 0;
  /** Звук студента во время смены голоса на пробу (клиент в роли): досылается новому движку. */
  private pendingAudio: Buffer[] | null = null;
  /** Наблюдатель сказал «Разбор окончен» — закрываемся, даже если конец хода затерялся. */
  private closingSaid = false;
  private closeQuietTimer: NodeJS.Timeout | null = null;
  /** Паузы в речи наблюдателя и клиента вне роли длиннее, чем у модели (в пробе клиент звучит как на встрече). */
  private stretcher: PauseStretcher | null = null;
  /** Пользователь стенда проверки: может говорить текстом. */
  private stand = false;
  /** Текст студента, сказанный, пока голос ещё не открылся (стенд). */
  private pendingText: string[] = [];

  constructor(
    private ws: WebSocket,
    private db: Db,
    private s: DebriefSessionRow,
    private send: (m: ServerMessage) => void,
  ) {
    this.secondsLeft = Math.max(0, s.seconds_limit - s.seconds_used);
  }

  async start() {
    const { db, s } = this;
    if (this.secondsLeft <= 0) return this.end("time_limit");
    const [{ data: extra }, cfg, { data: turnsRaw }, standUsers] = await Promise.all([
      db.from("voice_sessions").select("parent_session_id, script_state").eq("id", s.id).single(),
      getDebriefConfig(),
      db.from("voice_turns").select("seq, role, text, segment").eq("session_id", s.id).order("seq"),
      getConfig<unknown>("voice_stand_users", []),
    ]);
    this.stand = isStandUser(standUsers, s.user_id);
    const parentId = extra?.parent_session_id as string | null;
    const ctx = parentId ? await loadDebriefContext(db, parentId) : null;
    if (!cfg || !ctx) {
      this.send({ t: "error", code: "session_not_found", message: "Разбор пока не настроен — откройте запись разбора" });
      return this.end("engine_error");
    }
    this.cfg = cfg;
    this.ctx = ctx;
    this.state = (extra?.script_state as DebriefScriptState | null) ?? {};
    this.turns = (turnsRaw ?? []) as DebriefTurn[];
    this.seq = this.turns.length ? Math.max(...this.turns.map((t) => t.seq)) : 0;
    this.sessionStartMs = s.started_at ? new Date(s.started_at).getTime() : Date.now();
    let seg = (this.state.segment ?? 1) as DebriefSegment;
    if (seg === 2 && this.state.skipClient) seg = 3;
    const segTurns = this.turns.filter((t) => t.segment === seg);

    try {
      await this.openSegment(seg);
    } catch (e) {
      const unavailable = e instanceof EngineUnavailableError;
      this.send({ t: "error", code: "engine_unavailable", message: unavailable ? e.message : "Разбор недоступен, попробуйте через минуту" });
      console.error("[voice-debrief] engine connect failed", s.id, e);
      await db.from("voice_sessions").update({ status: s.status === "created" ? "failed" : "reconnecting", end_reason: "engine_error" }).eq("id", s.id);
      this.ws.close(1011, "engine_unavailable");
      return;
    }

    const planned = this.state.planned === true;
    this.state.planned = false;
    await db
      .from("voice_sessions")
      .update({
        status: "active",
        started_at: s.started_at ?? new Date(this.sessionStartMs).toISOString(),
        paused_at: null,
        last_heartbeat_at: new Date().toISOString(),
        // Плановое переподключение (предел функции) — не обрыв.
        reconnects: s.status === "created" || planned ? s.reconnects : s.reconnects + 1,
        script_state: this.state,
      })
      .eq("id", s.id);

    console.log("[voice-debrief] connected", s.id, { segment: seg, resumed: segTurns.length > 0, planned, notes: this.state.notes ?? ctx.notesStatus });
    this.send({ t: "ready", sessionId: s.id, secondsLeft: this.secondsLeft, resumed: segTurns.length > 0 });

    this.ws.on("message", (data: RawData, isBinary: boolean) => this.onMessage(data, isBinary));
    this.ws.on("close", () => void this.onSocketClose());
    this.timers.push(setInterval(() => void this.tick(), TICK_MS));
    this.timers.push(setInterval(() => this.ackHeard(), HEARD_MS));
    this.timers.push(setTimeout(() => (this.wantRotate = true), ROTATE_SOFT_MS));
    this.timers.push(setTimeout(() => void this.rotate(), ROTATE_HARD_MS));
    this.lastTickAt = Date.now();

    // Итог уже прозвучал до переподключения — разговор не продолжаем, разбор закрывается.
    const lastAi = [...segTurns].reverse().find((t) => t.role !== "student");
    if (seg === 3 && lastAi && segTurns[segTurns.length - 1] === lastAi && endsSegment(cfg, 3, lastAi.text, ctx.client)) {
      console.log("[voice-debrief] closing already said — finish", s.id);
      this.timers.push(setTimeout(() => this.finishAfterPlayback("completed"), 500));
      return;
    }
    const wait = Math.min(MAX_KICK_WAIT_MS, Math.max(0, (this.state.kickAt ?? 0) - Date.now() - VOICE_LEAD_MS));
    this.timers.push(setTimeout(() => this.begin(segTurns), wait));
  }

  /** Открыть движок этапа: свой голос и инструкция с тем, что уже сказано в разборе. */
  private async openSegment(seg: DebriefSegment) {
    const { cfg, ctx } = this;
    // Этапам 2–3 нужны заметки текстового разбора: если ещё считаются — подождать немного, иначе без них.
    if ((seg === 2 || seg === 3) && !this.state.notes) {
      const deadline = Date.now() + cfg.limits.wait_notes_seconds * 1000;
      while (ctx.notesStatus === "pending" && Date.now() < deadline && !this.ended) {
        await new Promise((r) => setTimeout(r, 2000));
        await refreshNotes(this.db, ctx);
      }
      this.state.notes = ctx.notesStatus === "ready" ? "notes" : "transcript";
    }
    this.seg = seg;
    this.aiRole = seg === 2 || seg === 4 ? "client" : "observer";
    const segTurns = this.turns.filter((t) => t.segment === seg);
    this.segStudentTurns = segTurns.filter((t) => t.role === "student").length;
    this.segAiTurns = segTurns.filter((t) => t.role !== "student").length;
    this.segSilences = this.state.silences?.[String(seg) as "1"] ?? 0;
    this.signals.clear();
    this.aiTurnsSinceSignal = 0;
    const seg1Students = this.turns.filter((t) => t.segment === 1 && t.role === "student");
    const selfWords = seg1Students.slice(1).reduce((n, t) => n + wordCount(t.text), 0);
    let instruction: string;
    let history: HistoryTurn[] | undefined;
    if (seg === 4) {
      // Проба: клиент снова в роли — та же карточка и встреча до его реплики.
      const r = await buildRehearsal(this.db, cfg, ctx);
      if (!r) throw new Error("проба недоступна");
      instruction = r.instruction;
      history = r.history;
    } else {
      instruction = buildDebriefInstruction({ cfg, ctx, segment: seg, state: this.state, turns: this.turns, selfMissing: selfWords < 4 });
    }
    const voiceName = seg === 2 || seg === 4 ? ctx.clientVoice : observerVoice(cfg, ctx.clientVoice);

    this.stretcher = seg !== 4 && cfg.pause_stretch ? new PauseStretcher(cfg.pause_stretch) : null;
    const gen = ++this.gen;
    const engine = createEngine(process.env.VOICE_ENGINE || "gemini");
    const mine = () => gen === this.gen;
    await engine.connect(
      { instruction, voiceName, history, silenceMs: cfg.silence_ms },
      {
        onAudio: (pcm) => {
          if (!mine()) return;
          if (this.awaitingVoice) {
            this.awaitingVoice = false;
            this.live = true;
            this.send({ t: "speaker", who: this.aiRole, segment: this.seg });
          }
          if (!this.aiSpoke) {
            this.turnAudioBytes = 0;
            this.turnAudioStartAt = Date.now();
          }
          const out = this.stretcher ? this.stretcher.process(pcm) : pcm;
          this.turnAudioBytes += out.length;
          this.aiSpoke = true;
          if (this.closingSaid) this.armCloseQuiet();
          this.clearSilenceTimer();
          this.setSpeaking("client");
          if (out.length && this.ws.readyState === this.ws.OPEN) this.ws.send(out, { binary: true });
        },
        onTranscript: (t) => {
          if (!mine()) return;
          if (t.role === "client") {
            this.aiText += t.text;
            if (this.seg === 3 && !this.closingSaid && this.segStudentTurns > 0 && endsSegment(this.cfg, 3, this.aiText, this.ctx.client)) {
              this.closingSaid = true;
              this.armCloseQuiet();
            }
          }
          this.addTranscript(t.role === "client" ? this.aiRole : "student", t.text);
        },
        onInterrupted: () => {
          if (mine()) this.send({ t: "interrupted" });
        },
        onTurnComplete: () => {
          if (!mine()) return;
          const spoke = this.aiSpoke;
          this.aiSpoke = false;
          if (this.stretcher) {
            const tail = this.stretcher.flush();
            this.stretcher.reset();
            this.turnAudioBytes += tail.length;
            if (tail.length && this.ws.readyState === this.ws.OPEN) this.ws.send(tail, { binary: true });
          }
          this.setSpeaking("idle");
          if (!spoke || this.ended || this.switching || this.rotated) return;
          // Фраза передачи уже в расшифровке — решаем сразу (быстрее переход), иначе ждём её хвост.
          const now =
            this.seg === 4 ||
            endsSegment(this.cfg, this.seg, this.aiText, this.ctx.client) ||
            (this.seg === 3 && endsSegment(this.cfg, "rehearse", this.aiText, this.ctx.client));
          this.timers.push(setTimeout(() => void this.afterAiTurn(), now ? 0 : TRANSCRIPT_TAIL_MS));
        },
        onGoAway: () => {
          if (mine()) this.wantRotate = true;
        },
        onUsage: (u) => {
          this.usage.prompt += u.promptTokens;
          this.usage.response += u.responseTokens;
        },
        onClose: (r) => {
          if (!mine() || this.ended || this.paused || this.rotated || this.switching) return;
          console.error("[voice-debrief] engine closed", this.s.id, r);
          void this.rotate();
        },
      },
    );
    if (!mine()) {
      await engine.close();
      return;
    }
    this.engine = engine;
  }

  /** Голос этапа начинает (или продолжает после обрыва). */
  private begin(segTurns: DebriefTurn[]) {
    if (this.ended || this.rotated) return;
    const last = segTurns[segTurns.length - 1];
    // Последним говорил голос и недавно — просто ждём ответа студента.
    if (last && last.role !== "student" && Date.now() - (this.state.kickAt ?? 0) < RESUME_REPEAT_MS) {
      this.send({ t: "speaker", who: this.aiRole, segment: this.seg });
      this.live = true;
      this.armStudentPause();
      this.flushPendingText();
      return;
    }
    if (!last && !this.state.startedAt) {
      this.state.startedAt = Date.now();
      void this.saveState();
    }
    this.awaitingVoice = true;
    this.live = false;
    this.engine?.kick(last ? SIGNAL.resume : SIGNAL.start);
  }

  /** Решения после реплики голоса: конец этапа, сигналы лимитов, ожидание студента. */
  private async afterAiTurn() {
    if (this.ended || this.closing || this.switching || this.rotated) return;
    const text = this.aiText.trim();
    this.aiText = "";
    this.flushTurn();
    const { cfg, ctx } = this;
    const seg = this.seg;
    const asked = /\?\s*$/.test(text);
    this.segAiTurns += 1;
    if (this.signals.size) this.aiTurnsSinceSignal += 1;
    // Фраза конца этапа не принимается во вступлении («сначала вы, потом Вера»), пока студент не ответил
    // (в этапе 1 — дважды), разве что он молчит или пришёл сигнал лимита.
    const answered = this.segStudentTurns >= (seg === 1 ? SEG1_MIN_ANSWERS : 1);
    const mayEnd = seg === 2 || answered || this.segSilences >= 2 || this.signals.size > 0;
    const segSec = (Date.now() - (this.state.startedAt ?? this.connOpenedAt)) / 1000;

    // Проба: клиент в роли ответил — слово снова наблюдателю; что это было, решаем по смыслу.
    if (seg === 4) return this.afterProbe();

    if (seg === 3) {
      // Наблюдатель зовёт сказать фразу клиенту — клиент на одну реплику возвращается в роль.
      if (!this.state.rehearsed && endsSegment(cfg, "rehearse", text, ctx.client) && rehearsalTarget(ctx)) return this.switchTo(4, null);
      if (mayEnd && this.segAiTurns > 1 && endsSegment(cfg, 3, text, ctx.client)) return this.finishAfterPlayback("completed");
      const totalSec = this.s.seconds_limit - this.secondsLeft;
      if (!this.signals.has("wrap") && (segSec >= cfg.limits.seg3_seconds || totalSec >= cfg.limits.total_seconds)) {
        this.signal("wrap", SIGNAL.wrap, asked);
      } else if (this.signals.has("wrap") && this.aiTurnsSinceSignal > FORCE_AFTER_TURNS + 1) {
        return this.finishAfterPlayback("time_limit");
      }
    } else {
      if (mayEnd && endsSegment(cfg, seg, text, ctx.client)) return this.handover();
      if (seg === 1) await this.checkNotes(segSec);
      const turnsCap = seg === 1 ? cfg.limits.seg1_student_turns : cfg.limits.seg2_student_turns;
      const secCap = seg === 1 ? cfg.limits.seg1_seconds : cfg.limits.seg2_seconds;
      const notesKnown = seg !== 1 || this.notesSignaled;
      if (!this.signals.has("pass") && notesKnown && (this.segStudentTurns >= turnsCap || segSec >= secCap)) {
        this.signal("pass", SIGNAL.pass, asked);
      } else if (this.signals.has("pass") && this.aiTurnsSinceSignal > FORCE_AFTER_TURNS) {
        return this.handover();
      }
    }
    if (this.wantRotate) return this.rotate();
    this.armStudentPause();
    this.flushPendingText();
  }

  /**
   * После пробы: была ли это фраза клиенту, а не переспрос или сомнение. Наблюдатель получает то,
   * что реально прозвучало, — оценка пробы опирается на настоящий ответ клиента. Переспрос или
   * сомнение — не проба: наблюдатель отвечает и зовёт ещё раз (одна повторная попытка).
   */
  private async afterProbe() {
    this.live = false;
    // Только последняя попытка: после переспроса студента зовут к пробе ещё раз.
    const lastOther = this.turns.findLastIndex((t) => t.segment !== 4);
    const seg4 = this.turns.slice(lastOther + 1);
    const studentLine = seg4.filter((t) => t.role === "student").map((t) => t.text).join(" ").trim();
    const reply = [...seg4].reverse().find((t) => t.role !== "student")?.text ?? "";
    const target = rehearsalTarget(this.ctx);
    const move = studentLine
      ? await classifyProbe({ clientLine: target?.clientLine ?? "", studentLine, clientName: this.ctx.client.name })
      : "hesitation";
    console.log("[voice-debrief] probe", this.s.id, move);
    if (this.ended || this.rotated) return;
    const tries = (this.state.probeTries ?? 0) + 1;
    this.state.probeTries = tries;
    if (move === "attempt") {
      this.state.rehearsed = true;
      return this.switchTo(3, SIGNAL.probeDone(studentLine, reply, this.ctx.client.name));
    }
    if (move !== "refusal" && tries < 2) return this.switchTo(3, SIGNAL.probeNotYet(move, studentLine));
    this.state.rehearsed = true;
    return this.switchTo(3, SIGNAL.rehearsalSkipped);
  }

  /** Сигнал модели: если она только что задала вопрос — учтёт после ответа студента, иначе — сразу. */
  private signal(key: string, text: string, asked: boolean) {
    this.signals.add(key);
    this.aiTurnsSinceSignal = 0;
    if (asked) this.engine?.sendHiddenText(text);
    else this.engine?.kick(text);
  }

  /**
   * Этап 1: текстовый разбор считается в фоне, пока студент говорит о себе. «Разбор готов» —
   * когда он готов и студент ответил дважды (или молчит, или вышло время этапа).
   */
  private async checkNotes(segSec: number) {
    if (this.notesSignaled) return;
    if (!this.state.notes) {
      const status = await refreshNotes(this.db, this.ctx);
      if (status === "ready") this.state.notes = "notes";
      else if (status === "none" || segSec >= this.cfg.limits.seg1_seconds + this.cfg.limits.wait_notes_seconds) this.state.notes = "transcript";
      if (this.state.notes) void this.saveState();
    }
    const studentDone = this.segStudentTurns >= SEG1_MIN_ANSWERS || this.segSilences >= 2 || segSec >= this.cfg.limits.seg1_seconds;
    if (!this.state.notes || !studentDone) return;
    this.notesSignaled = true;
    console.log("[voice-debrief] notes", this.s.id, this.state.notes, Math.round(segSec), "s");
    this.engine?.sendHiddenText(SIGNAL.notesReady);
  }

  /** Передать слово следующему голосу — на сервере, без переподключения браузера. */
  private handover(): Promise<void> {
    return this.switchTo(this.seg === 1 ? (this.state.skipClient ? 3 : 2) : 3, null);
  }

  /**
   * Сменить голос: старый движок закрыть, новый открыть со своей инструкцией и голосом.
   * signal — с чем новый голос начинает (по умолчанию «начинай»); на пробу (этап 4) клиент
   * в роли не начинает сам — ждёт фразу студента, его звук за время смены досылается.
   */
  private async switchTo(next: DebriefSegment, signal: string | null): Promise<void> {
    if (this.switching || this.ended || this.rotated) return;
    const from = this.seg;
    this.switching = true;
    this.live = false;
    this.clearPauseTimer();
    this.clearSilenceTimer();
    this.flushTurn();
    if (next === 4) this.pendingAudio = [];
    const kickAt = Math.max(Date.now(), this.playbackEndAt()) + 300;
    this.send({ t: "handover", to: next === 2 || next === 4 ? "client" : "observer", segment: next });
    const old = this.engine;
    this.engine = null;
    this.gen += 1;
    void old?.close();
    // Проба — вставка внутри этапа 3: его время идёт дальше.
    const keepClock = next === 4 || from === 4;
    this.state = {
      ...this.state,
      segment: next,
      kickAt,
      startedAt: keepClock ? this.state.startedAt : undefined,
      // Проба засчитана только по смыслу (afterProbe) или если студент не стал пробовать.
      silences: { ...(this.state.silences ?? {}), [String(from)]: this.segSilences },
    };
    const t0 = Date.now();
    try {
      await this.inserts;
      // Голос не открылся за разумное время — не ждём минутами: проба пропускается, иначе переподключение.
      await Promise.race([
        this.openSegment(next),
        new Promise((_, reject) => setTimeout(() => reject(new Error("voice open timeout")), OPEN_TIMEOUT_MS)),
      ]);
    } catch (e) {
      console.error("[voice-debrief] next voice failed", this.s.id, next, e);
      this.switching = false;
      this.pendingAudio = null;
      // Проба не открылась — продолжает наблюдатель; иначе пусть браузер переподключится.
      if (next === 4) {
        this.state.rehearsed = true;
        return this.switchTo(3, SIGNAL.rehearsalSkipped);
      }
      return this.rotate();
    }
    this.switching = false;
    // Пока открывался голос, соединение сменилось (плановое переподключение) — продолжает новое.
    if (this.ended || this.rotated) return;
    void this.saveState();
    console.log("[voice-debrief] switch", this.s.id, from, "→", next, "voice open in", Date.now() - t0, "ms");
    if (next === 4) {
      // Клиент в роли ждёт фразу студента: сказанное за время смены — в движок.
      this.send({ t: "speaker", who: "client", segment: 4 });
      this.live = true;
      // openSegment уже поставил новый движок (поток выполнения TS этого не видит).
      const eng = this.engine as VoiceEngine | null;
      for (const b of this.pendingAudio ?? []) eng?.sendAudio(b);
      this.pendingAudio = null;
      this.armStudentPause();
      this.flushPendingText();
      return;
    }
    const wait = Math.max(0, kickAt - Date.now() - VOICE_LEAD_MS);
    this.timers.push(
      setTimeout(() => {
        if (this.ended || this.rotated || this.switching) return;
        if (!signal) return this.begin([]);
        this.awaitingVoice = true;
        this.live = false;
        this.engine?.kick(signal);
      }, wait),
    );
  }

  /** Переподключение браузера (предел функции, сбой движка): новое соединение продолжит тот же этап. */
  private async rotate() {
    if (this.rotated || this.ended) return;
    // Посреди передачи слова не переподключаемся — дождёмся её конца.
    if (this.switching) {
      this.timers.push(setTimeout(() => void this.rotate(), 2_000));
      return;
    }
    this.rotated = true;
    this.live = false;
    this.stopTimers();
    this.flushTurn();
    await this.inserts;
    const kickAt = Math.max(Date.now(), this.playbackEndAt()) + 300;
    const silences = { ...(this.state.silences ?? {}), [String(this.seg)]: this.segSilences };
    const nextState: DebriefScriptState = { ...this.state, segment: this.seg, kickAt, planned: true, silences };
    const t = newTicket();
    await this.db
      .from("voice_sessions")
      .update({ script_state: nextState, ticket_hash: t.hash, ticket_expires_at: t.expiresAt })
      .eq("id", this.s.id);
    console.log("[voice-debrief] rotate", this.s.id, { segment: this.seg });
    this.send({ t: "rotate", ticket: t.ticket });
    this.gen += 1;
    await this.engine?.close();
    this.engine = null;
    await this.tickNow();
    await this.flushUsage();
    // Браузер закроет этот сокет, когда новое соединение будет готово; если нет — сами.
    setTimeout(() => {
      try {
        if (this.ws.readyState === this.ws.OPEN) this.ws.close(1000, "rotate");
      } catch {}
    }, 15_000);
  }

  /** Итог сказан, а конец хода не пришёл: нет нового звука CLOSE_QUIET_MS — закрываемся. */
  private armCloseQuiet() {
    if (this.closeQuietTimer) clearTimeout(this.closeQuietTimer);
    this.closeQuietTimer = setTimeout(() => {
      this.closeQuietTimer = null;
      if (!this.closing && !this.ended && !this.rotated) {
        this.flushTurn();
        this.finishAfterPlayback("completed");
      }
    }, CLOSE_QUIET_MS);
  }

  /** Итог сказан: дождаться, пока он доиграет у студента, выдержать паузу и закрыть разбор. */
  private finishAfterPlayback(reason: EndReason) {
    if (this.closing) return;
    this.closing = true;
    this.live = false;
    this.clearPauseTimer();
    this.clearSilenceTimer();
    if (this.closeQuietTimer) clearTimeout(this.closeQuietTimer);
    this.closeQuietTimer = null;
    const wait = Math.max(CLOSE_AFTER_MS, this.playbackEndAt() - Date.now() + CLOSE_AFTER_MS);
    console.log("[voice-debrief] finish", this.s.id, reason, "in", wait, "ms");
    this.timers.push(setTimeout(() => void this.end(reason), wait));
  }

  private onMessage(data: RawData, isBinary: boolean) {
    if (this.ended) return;
    if (isBinary) {
      const buf = data as Buffer;
      this.countHeard(buf);
      if (this.live && !this.paused) this.engine?.sendAudio(buf);
      else if (this.pendingAudio && this.pendingAudio.reduce((n, b) => n + b.length, 0) < PENDING_MAX_BYTES) this.pendingAudio.push(buf);
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
    else if (msg.t === "say" && this.stand && typeof msg.text === "string" && msg.text.trim()) {
      this.pendingText.push(msg.text);
      this.flushPendingText();
    }
  }

  /** Стенд проверки: реплика студента текстом — как распознанная речь; голос отвечает. */
  private flushPendingText() {
    if (!this.live || this.paused || this.switching || this.rotated || !this.engine || this.aiSpoke) return;
    const text = this.pendingText.join(" ");
    this.pendingText = [];
    if (!text) return;
    this.addTranscript("student", text);
    this.flushBuf("student");
    this.engine.kick(text);
  }

  private countHeard(buf: Buffer) {
    this.rxBytes += buf.length;
    const n = buf.length >> 1;
    if (!n) return;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = buf.readInt16LE(i * 2);
      sum += v * v;
    }
    if (Math.sqrt(sum / n) / 0x8000 > VOICE_RMS) {
      this.rxSpeechMs += buf.length / 32;
      if (this.pauseTimer && this.live && Date.now() > this.playbackEndAt()) this.clearPauseTimer();
    }
  }

  private ackHeard() {
    if (this.ended || this.rxBytes === this.heardBytes) return;
    this.heardBytes = this.rxBytes;
    this.send({ t: "heard", bytes: this.rxBytes, speechMs: Math.round(this.rxSpeechMs) });
  }

  /** Звук генерируется быстрее, чем звучит: когда реплика голоса доиграет у студента. */
  private playbackEndAt(): number {
    return this.turnAudioStartAt + this.turnAudioBytes / 48; // PCM16 24 кГц = 48 байт/мс
  }

  private setSpeaking(speaking: "client" | "student" | "idle") {
    this.send({ t: "state", speaking, secondsLeft: this.secondsLeft });
  }

  /** Студент молчит после реплики голоса: мягкий повтор, потом «не настаивай», потом дальше. */
  private armStudentPause() {
    this.clearPauseTimer();
    const playLeft = Math.max(0, this.playbackEndAt() - Date.now());
    this.pauseTimer = setTimeout(() => {
      this.pauseTimer = null;
      if (this.ended || this.paused || this.switching || this.rotated || this.closing) return;
      // Проба: студент молчит — как «не знаю, что сказать»: наблюдатель поддержит и позовёт ещё раз (один раз).
      if (this.seg === 4) return void this.afterProbe();
      this.segSilences += 1;
      if (this.segSilences === 1) this.engine?.kick(SIGNAL.silent);
      else if (this.segSilences === 2) this.engine?.kick(SIGNAL.silentAgain);
      else if (this.seg === 3) this.signal("wrap", SIGNAL.wrap, false);
      else this.signal("pass", SIGNAL.pass, false);
    }, (this.seg === 4 ? PROBE_PAUSE_MS : STUDENT_PAUSE_MS) + playLeft);
  }

  private clearPauseTimer() {
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.pauseTimer = null;
  }

  private addTranscript(role: DebriefTurn["role"], text: string) {
    const at = Date.now() - this.sessionStartMs;
    if (role === "student") {
      this.clearPauseTimer();
      // Голос уже договорил — его реплика была раньше: записать её первой.
      if (this.aiBuf && !this.aiSpoke) this.flushBuf("ai");
      if (!this.studentBuf) this.studentBuf = { role, text: "", startMs: at };
      this.studentBuf.text += text;
      this.setSpeaking("student");
      this.armSilenceTimer();
      return;
    }
    // Голос заговорил — сказанное студентом до этого ложится перед ним.
    if (this.studentBuf) this.flushBuf("student");
    if (this.aiBuf && this.aiBuf.role !== role) this.flushBuf("ai");
    if (!this.aiBuf) this.aiBuf = { role, text: "", startMs: at };
    this.aiBuf.text += text;
  }

  /** Записать накопленное: сначала студента, потом голос. */
  private flushTurn() {
    this.flushBuf("student");
    this.flushBuf("ai");
  }

  private flushBuf(which: "student" | "ai") {
    const b = which === "student" ? this.studentBuf : this.aiBuf;
    if (which === "student") this.studentBuf = null;
    else this.aiBuf = null;
    // Служебные пометки распознавания («<no speech detected>») — не речь.
    if (b) b.text = b.text.replace(/<[^>]*>|\{[^}]*\}/g, "");
    if (!b || !/[\p{L}\p{N}]/u.test(b.text)) return;
    if (b.role === "student") {
      b.text = cyrillicBackchannel(b.text);
      this.segStudentTurns += 1;
      this.segSilences = 0;
    }
    this.seq += 1;
    const row = { seq: this.seq, role: b.role, text: b.text.trim(), segment: this.seg };
    this.turns.push(row);
    // Записи — по цепочке: перед сменой голоса и переподключением все реплики должны лечь в БД.
    this.inserts = this.inserts.then(() =>
      this.db
        .from("voice_turns")
        .insert({ session_id: this.s.id, ...row, t_start_ms: b.startMs, t_end_ms: Date.now() - this.sessionStartMs })
        .then(({ error }) => {
          if (error) console.error("[voice-debrief] turn insert failed", this.s.id, error.message);
        }),
    );
  }

  /** Студент договорил, а голос молчит: один толчок. */
  private armSilenceTimer() {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = null;
      if (this.ended || this.switching || this.rotated || this.closing) return;
      // Клиент в роли не отвечает на фразу — как в звонке: «продолжай».
      this.engine?.kick(this.seg === 4 ? "[СИСТЕМА: продолжай]" : SIGNAL.resume);
    }, MODEL_SILENCE_MS);
  }

  private clearSilenceTimer() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
  }

  private saveState() {
    return this.db.from("voice_sessions").update({ script_state: this.state }).eq("id", this.s.id).then(() => undefined);
  }

  private async tick() {
    if (this.ended || this.rotated) return;
    // Сессию забрало новое соединение (вторая вкладка) — это закрываем.
    const { data: owner } = await this.db.from("voice_sessions").select("conn_id, status").eq("id", this.s.id).single();
    if (owner && (owner.conn_id !== this.s.conn_id || owner.status === "ended")) {
      this.ended = true;
      this.stopTimers();
      this.gen += 1;
      await this.engine?.close();
      this.send({ t: "error", code: "superseded", message: "Разбор продолжается в другом окне" });
      if (this.ws.readyState === this.ws.OPEN) this.ws.close(1000, "superseded");
      return;
    }
    await this.tickNow();
    void this.flushUsage();
    if (this.secondsLeft <= 0 && !this.closing) {
      this.signal("wrap", SIGNAL.wrap, false);
      this.finishAfterPlayback("time_limit");
    }
  }

  private async tickNow() {
    const now = Date.now();
    const seconds = this.paused ? 0 : Math.round((now - this.lastTickAt) / 1000);
    this.lastTickAt = now;
    const { data, error } = await this.db.rpc("voice_session_tick", { p_session_id: this.s.id, p_seconds: seconds });
    if (error) return console.error("[voice-debrief] tick failed", this.s.id, error.message);
    this.secondsLeft = Number(data ?? 0);
  }

  private async flushUsage() {
    const { prompt, response } = this.usage;
    if (!prompt && !response) return;
    this.usage = { prompt: 0, response: 0 };
    await this.db.rpc("voice_session_add_usage", { p_session_id: this.s.id, p_prompt: prompt, p_response: response });
  }

  private stopTimers() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    this.clearPauseTimer();
    this.clearSilenceTimer();
    if (this.closeQuietTimer) clearTimeout(this.closeQuietTimer);
    this.closeQuietTimer = null;
  }

  async end(reason: EndReason) {
    if (this.ended) return;
    this.ended = true;
    this.live = false;
    this.stopTimers();
    this.flushTurn();
    await this.inserts;
    this.gen += 1;
    await this.engine?.close();
    if (!this.rotated) await this.tickNow();
    const silences = { ...(this.state.silences ?? {}), [String(this.seg)]: this.segSilences };
    await this.db
      .from("voice_sessions")
      .update({ status: "ended", end_reason: reason, ended_at: new Date().toISOString(), script_state: { ...this.state, segment: this.seg, silences } })
      .eq("id", this.s.id)
      .in("status", LIVE);
    await this.flushUsage();
    console.log("[voice-debrief] ended", this.s.id, reason, { segment: this.seg });
    this.send({ t: "ended", reason });
    if (this.ws.readyState === this.ws.OPEN) this.ws.close(1000, "ended");
  }

  private async onSocketClose() {
    if (this.ended || this.rotated) return;
    this.ended = true;
    this.stopTimers();
    this.flushTurn();
    await this.inserts;
    this.gen += 1;
    await this.engine?.close();
    await this.tickNow();
    await this.flushUsage();
    const silences = { ...(this.state.silences ?? {}), [String(this.seg)]: this.segSilences };
    // Разбор закрывает не сокет: браузер переподключится; брошенный добирает уборка.
    await this.db
      .from("voice_sessions")
      .update({
        status: this.paused ? "paused" : "reconnecting",
        paused_at: this.paused ? new Date().toISOString() : null,
        script_state: { ...this.state, segment: this.seg, silences, kickAt: Date.now() },
      })
      .eq("id", this.s.id)
      .eq("conn_id", this.s.conn_id)
      .in("status", ["active"]);
  }
}
