// Голосовой разбор после учебной консультации — «как в учебной тройке».
// Разбор — отдельная сессия kind='debrief', привязанная к встрече. Три этапа, на каждом
// соединении говорит один голос: 1 — наблюдатель снимает роли и слушает студента о себе;
// 2 — клиент вне роли: как ему было; 3 — наблюдатель: что сработало, одна правка, повтор
// фразы, вывод студента, итог. Тексты сценария — закрытая настройка app_config.voice_debrief
// (репозиторий публичный); здесь — допуск, состояние между соединениями и сборка данных.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "@/lib/config";
import { computeClientFlags, type TurnLite } from "./counters";
import { LANG_LOCK, buildInstruction } from "./prompt";
import { loadStudentCard, studentCardText, type StudentCard } from "./student-card";
import type { HistoryTurn } from "./engine/types";
import type { PauseStretchConfig } from "./audio/pause-stretch";
import { newTicket } from "./ticket";
import type { DebriefResult } from "./debrief";

/** 1 — студент о себе (наблюдатель), 2 — клиент вне роли, 3 — наблюдатель, 4 — проба: клиент снова в роли на одну реплику. */
export type DebriefSegment = 1 | 2 | 3 | 4;

/** Закрытая настройка app_config.voice_debrief (файл _mipp-praktika/seed/voice-debrief.json). */
export interface DebriefVoiceConfig {
  observer_voice: string;
  observer_voice_fallback: string;
  silence_ms: number;
  /** Общие правила для обоих голосов. */
  rules: string;
  observer: string;
  client: string;
  segments: Record<"1" | "2" | "3", string>;
  /** Последняя фраза этапа 1: передать слово клиенту или (клиент сбился во встрече) сразу наблюдателю. */
  handover_line: { client: string; self: string };
  /** Этап 3, если в начале студент о себе не сказал: бережный возврат. */
  self_missing: string;
  /** Этапы 2–3 без заметок текстового разбора. */
  no_notes: string;
  /** Фокус наблюдателя по режиму: ключ — mode_templates.key или debrief_mode. */
  modes: Record<string, string>;
  /** Фразы конца этапа (регулярные выражения, {name} — основа имени клиента); rehearse — наблюдатель зовёт к пробе. */
  phrases: Record<"1" | "2" | "3" | "rehearse", string>;
  /** Наблюдатель, этап 3: как позвать к пробе — с клиентом в роли или просто вслух (нет заметки о правке). */
  rehearse_line: { client: string; aloud: string };
  /** Клиент снова в роли на одну реплику — добавка к рамке режима ({client_line} — его реплика на встрече). */
  rehearsal_frame: string;
  /** Напоминание в самом конце инструкции (модели лучше помнят последнее): запретные слова и т. п. */
  final_reminder?: string;
  /** Воздух между фразами наблюдателя и клиента вне роли (просьба «говори медленнее» на темп не влияет); null — без. */
  pause_stretch?: PauseStretchConfig | null;
  limits: {
    seg1_student_turns: number;
    seg1_seconds: number;
    seg2_student_turns: number;
    seg2_seconds: number;
    seg3_seconds: number;
    total_seconds: number;
    wait_notes_seconds: number;
    hard_seconds: number;
  };
}

/** Состояние сценария между соединениями (voice_sessions.script_state). */
export interface DebriefScriptState {
  segment?: DebriefSegment;
  /** Когда следующему голосу можно начинать: у студента доигрывает хвост прошлой реплики (мс). */
  kickAt?: number;
  /** Переподключение плановое (передача слова), а не обрыв связи. */
  planned?: boolean;
  /** Клиент во встрече выходил из роли — этап 2 пропускаем. */
  skipClient?: boolean;
  /** На что опираются этапы 2–3: проверенные заметки текстового разбора или только расшифровка. */
  notes?: "notes" | "transcript";
  /** Когда начался текущий этап (мс). */
  startedAt?: number;
  /** Сколько раз студент промолчал на этапе. */
  silences?: Partial<Record<"1" | "2" | "3" | "4", number>>;
  /** Проба с клиентом в роли уже была (один раз за разбор). */
  rehearsed?: boolean;
  /** Сколько раз студента звали к пробе (переспрос или сомнение — ещё одна попытка). */
  probeTries?: number;
}

export const SIGNAL = {
  start: "[СИСТЕМА: начинай]",
  resume: "[СИСТЕМА: продолжай с того же места]",
  silent: "[СИСТЕМА: студент молчит]",
  silentAgain: "[СИСТЕМА: студент снова молчит]",
  notesReady: "[СИСТЕМА: разбор готов]",
  pass: "[СИСТЕМА: пора передавать слово]",
  wrap: "[СИСТЕМА: время на исходе — переходи к итогу]",
  afterRehearsal: "[СИСТЕМА: студент сказал фразу клиенту, клиент ответил в роли — продолжай]",
  /** Проба состоялась: что сказал студент и что на самом деле ответил клиент. */
  probeDone: (student: string, reply: string, client: string) =>
    `[СИСТЕМА: студент сказал фразу клиенту, клиент ответил в роли — продолжай. Студент сказал: «${student}». ${client} ответил(а): «${reply || "(промолчал(а))"}». Об изменении говори только по этому ответу: если ответ короткий или клиент закрылся — честно скажи это, не приукрашивай]`,
  /** Не проба: переспрос или сомнение — ответить и позвать ещё раз. */
  probeNotYet: (move: "question" | "hesitation", student: string) =>
    move === "question"
      ? `[СИСТЕМА: это ещё не проба — студент спросил: «${student}». Одной фразой ответь на его вопрос (да, прямо сейчас и прямо клиенту, своими словами) и снова позови сказать фразу клиенту — так же, как звал в первый раз]`
      : `[СИСТЕМА: это ещё не проба — студент ${student ? `засомневался: «${student}»` : "промолчал"}. Одной фразой поддержи (можно своими словами, не идеально) и снова позови сказать фразу клиенту — так же, как звал в первый раз]`,
  rehearsalSkipped: "[СИСТЕМА: студент не стал пробовать — не настаивай, продолжай]",
} as const;

export async function getDebriefConfig(): Promise<DebriefVoiceConfig | null> {
  const raw = await getConfig<DebriefVoiceConfig | string | null>("voice_debrief", null);
  let cfg: DebriefVoiceConfig | null = null;
  try {
    cfg = typeof raw === "string" ? (JSON.parse(raw) as DebriefVoiceConfig) : raw;
  } catch {
    return null;
  }
  return cfg && typeof cfg === "object" && cfg.segments && cfg.limits ? cfg : null;
}

// ——— Имя клиента в падежах (для сценария и экрана) ———

export interface ClientName {
  name: string;
  gen: string;
  dat: string;
  acc: string;
  female: boolean;
  /** Основа имени для поиска в речи: «вер», «марин», «олег». */
  stem: string;
}

export function clientName(displayName: string): ClientName {
  const name = (displayName.split(",")[0] ?? displayName).trim() || "Клиент";
  const low = name.toLowerCase();
  const last = low.slice(-1);
  const base = name.slice(0, -1);
  if (last === "а" || last === "я") {
    const soft = last === "я" || /[гкхжшчщ]$/.test(base.toLowerCase());
    return { name, gen: base + (soft ? "и" : "ы"), dat: base + "е", acc: base + (last === "я" ? "ю" : "у"), female: true, stem: low.slice(0, -1) };
  }
  if (last === "й") return { name, gen: base + "я", dat: base + "ю", acc: base + "я", female: false, stem: low.slice(0, -1) };
  return { name, gen: name + "а", dat: name + "у", acc: name + "а", female: false, stem: low };
}

// ——— Встреча, которую разбираем ———

export interface DebriefContext {
  parentId: string;
  client: ClientName;
  clientDisplay: string;
  summaryPublic: string;
  clientVoice: string;
  modeKey: string;
  modeName: string;
  debriefMode: string;
  minutes: number;
  /** Расшифровка встречи с номерами ходов. */
  transcript: string;
  notesStatus: "ready" | "pending" | "none";
  notes: DebriefResult | null;
  /** Расшифровка встречи по ходам — для пробы с клиентом в роли. */
  callTurns: HistoryTurn[];
  programModeId: string;
  clientId: string | null;
  /** Что было на прошлой встрече студента — разбор проверяет его прошлый вывод. */
  card: StudentCard;
}

interface ParentRow {
  id: string;
  user_id: string;
  kind: string;
  status: string;
  program_id: string;
  program_mode_id: string;
  client_id: string | null;
  client_version: number | null;
  seconds_used: number;
}

const PARENT_COLS = "id, user_id, kind, status, program_id, program_mode_id, client_id, client_version, seconds_used";

async function loadNotes(db: SupabaseClient, parentId: string): Promise<{ status: DebriefContext["notesStatus"]; result: DebriefResult | null; safety: string | null }> {
  const { data: d } = await db.from("voice_debriefs").select("status, is_fallback, result").eq("session_id", parentId).maybeSingle();
  if (!d || d.status === "queued" || d.status === "processing") return { status: "pending", result: null, safety: null };
  const result = (d.result as DebriefResult | null) ?? null;
  if (d.status !== "ready" || d.is_fallback || !result?.feedback) return { status: "none", result: null, safety: null };
  const safety = (result as { safety?: { level?: string } }).safety?.level ?? null;
  return { status: "ready", result, safety };
}

export async function loadDebriefContext(db: SupabaseClient, parentId: string): Promise<DebriefContext | null> {
  const { data: p } = await db.from("voice_sessions").select(PARENT_COLS).eq("id", parentId).maybeSingle();
  if (!p) return null;
  const parent = p as ParentRow;
  const [{ data: client }, { data: pm }, { data: turns }, notes, card] = await Promise.all([
    parent.client_id
      ? db.from("voice_clients").select("display_name, summary_public, voice_name").eq("id", parent.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("program_modes").select("config, mode_templates!inner(key, name)").eq("id", parent.program_mode_id).maybeSingle(),
    db.from("voice_turns").select("seq, role, text").eq("session_id", parentId).order("seq"),
    loadNotes(db, parentId),
    loadStudentCard(db, parent.user_id, parentId),
  ]);
  const display = (client?.display_name as string | undefined) ?? "Учебный клиент";
  const cn = clientName(display);
  const mt = pm?.mode_templates as unknown as { key: string; name: string } | undefined;
  let sN = 0;
  let cN = 0;
  const transcript = (turns ?? [])
    .map((t) => (t.role === "student" ? `[S${++sN}] Студент: ${t.text}` : `[C${++cN}] ${cn.name}: ${t.text}`))
    .join("\n");
  return {
    parentId,
    client: cn,
    clientDisplay: display,
    summaryPublic: (client?.summary_public as string | undefined) ?? "",
    clientVoice: (client?.voice_name as string | undefined) ?? "Kore",
    modeKey: mt?.key ?? "",
    modeName: mt?.name ?? "Учебная консультация",
    debriefMode: (pm?.config as { voice?: { debrief_mode?: string } } | null)?.voice?.debrief_mode ?? "full",
    minutes: Math.max(1, Math.round(parent.seconds_used / 60)),
    transcript,
    notesStatus: notes.status,
    notes: notes.result,
    callTurns: (turns ?? []).map((t) => ({ role: t.role as HistoryTurn["role"], text: t.text as string })),
    programModeId: parent.program_mode_id,
    clientId: parent.client_id,
    card,
  };
}

/** Перечитать готовность текстового разбора (пока студент говорит о себе, он считается в фоне). */
export async function refreshNotes(db: SupabaseClient, ctx: DebriefContext): Promise<DebriefContext["notesStatus"]> {
  const n = await loadNotes(db, ctx.parentId);
  ctx.notesStatus = n.status;
  ctx.notes = n.result;
  return n.status;
}

// ——— Допуск и создание ———

export type DebriefDenied = "not_found" | "not_full" | "not_ended" | "mode_off" | "too_short" | "safety" | "done" | "busy";

const MIN_STUDENT_TURNS = 3;
const MIN_SECONDS = 60;
/** Брошенный разбор старше этого не продолжаем — остаётся текст. */
const STALE_MS = 10 * 60_000;
const LIVE = ["created", "active", "paused", "reconnecting"];

/** Включён ли голосовой разбор в режиме этой встречи (program_modes.config.voice.voice_debrief). */
export async function voiceDebriefEnabled(db: SupabaseClient, programModeId: string): Promise<boolean> {
  const { data } = await db.from("program_modes").select("config").eq("id", programModeId).maybeSingle();
  return (data?.config as { voice?: { voice_debrief?: boolean } } | null)?.voice?.voice_debrief === true;
}

/** Можно ли разбирать эту встречу голосом. Без звонков в базу, кроме самого необходимого. */
export async function debriefAvailability(
  db: SupabaseClient,
  parentId: string,
  userId: string,
): Promise<{ ok: true; parent: ParentRow; skipClient: boolean } | { ok: false; reason: DebriefDenied }> {
  const { data: p } = await db.from("voice_sessions").select(PARENT_COLS).eq("id", parentId).eq("user_id", userId).maybeSingle();
  if (!p) return { ok: false, reason: "not_found" };
  const parent = p as ParentRow;
  if (parent.kind !== "full") return { ok: false, reason: "not_full" };
  if (parent.status !== "ended") return { ok: false, reason: "not_ended" };
  if (!(await voiceDebriefEnabled(db, parent.program_mode_id))) return { ok: false, reason: "mode_off" };
  const { data: turns } = await db.from("voice_turns").select("seq, role, text").eq("session_id", parentId).order("seq");
  const lite = (turns ?? []) as TurnLite[];
  if (lite.filter((t) => t.role === "student").length < MIN_STUDENT_TURNS || parent.seconds_used < MIN_SECONDS) {
    return { ok: false, reason: "too_short" };
  }
  const notes = await loadNotes(db, parentId);
  if (notes.safety === "risk") return { ok: false, reason: "safety" };
  // Клиент во встрече выходил из роли (называл себя программой и т. п.) — его голос вне роли не нужен.
  const flags = computeClientFlags(lite);
  return { ok: true, parent, skipClient: flags.includes("client_ai_words") || flags.includes("client_claims_human") };
}

/** Найти разбор этой встречи (кроме сорвавшихся). */
export async function findDebrief(db: SupabaseClient, parentId: string) {
  const { data } = await db
    .from("voice_sessions")
    .select("id, status, last_heartbeat_at, created_at, script_state")
    .eq("parent_session_id", parentId)
    .eq("kind", "debrief")
    .neq("status", "failed")
    .maybeSingle();
  return data as { id: string; status: string; last_heartbeat_at: string | null; created_at: string; script_state: DebriefScriptState } | null;
}

/**
 * Создать разбор встречи или продолжить начатый. Возвращает новый билет подключения.
 * Брошенный больше 10 минут назад разбор закрывается — остаётся текстовая запись.
 */
export async function createOrResumeDebrief(
  db: SupabaseClient,
  userId: string,
  parentId: string,
): Promise<{ ok: true; sessionId: string; ticket: string; resumed: boolean } | { ok: false; reason: DebriefDenied }> {
  const avail = await debriefAvailability(db, parentId, userId);
  if (!avail.ok) return avail;
  const existing = await findDebrief(db, parentId);
  const t = newTicket();
  if (existing) {
    if (!LIVE.includes(existing.status)) return { ok: false, reason: "done" };
    const lastSign = new Date(existing.last_heartbeat_at ?? existing.created_at).getTime();
    if (Date.now() - lastSign > STALE_MS) {
      await db.from("voice_sessions").update({ status: "ended", end_reason: "relay_lost_client", ended_at: new Date().toISOString(), conn_id: null }).eq("id", existing.id);
      return { ok: false, reason: "done" };
    }
    const { data } = await db
      .from("voice_sessions")
      .update({ ticket_hash: t.hash, ticket_expires_at: t.expiresAt })
      .eq("id", existing.id)
      .in("status", LIVE)
      .select("id")
      .maybeSingle();
    if (!data) return { ok: false, reason: "done" };
    return { ok: true, sessionId: existing.id, ticket: t.ticket, resumed: true };
  }

  // Другая живая сессия (звонок в соседней вкладке) — не мешаем ей; недоговорённый чужой разбор закрываем.
  await db
    .from("voice_sessions")
    .update({ status: "ended", end_reason: "student", ended_at: new Date().toISOString(), conn_id: null })
    .eq("user_id", userId)
    .eq("kind", "debrief")
    .in("status", LIVE);
  const { data: live } = await db.from("voice_sessions").select("id").eq("user_id", userId).in("status", LIVE).maybeSingle();
  if (live) return { ok: false, reason: "busy" };

  const cfg = await getDebriefConfig();
  const p = avail.parent;
  const state: DebriefScriptState = { segment: 1, skipClient: avail.skipClient };
  const { data: s, error } = await db
    .from("voice_sessions")
    .insert({
      user_id: userId,
      program_id: p.program_id,
      program_mode_id: p.program_mode_id,
      client_id: p.client_id,
      client_version: p.client_version,
      kind: "debrief",
      parent_session_id: p.id,
      engine_model: process.env.VOICE_GEMINI_MODEL || "gemini-3.8-live",
      seconds_limit: cfg?.limits.hard_seconds ?? 480,
      counts_toward_quota: false,
      script_state: state,
      ticket_hash: t.hash,
      ticket_expires_at: t.expiresAt,
    })
    .select("id")
    .single();
  if (error || !s) {
    // Гонка двух нажатий: разбор уже создан — продолжаем его.
    if (error?.code === "23505") return createOrResumeDebrief(db, userId, parentId);
    console.error("[voice-debrief] insert failed", error);
    return { ok: false, reason: "busy" };
  }
  return { ok: true, sessionId: s.id as string, ticket: t.ticket, resumed: false };
}

// ——— Сборка инструкции голоса ———

/** Откуда голос знает то, что говорит: у каждого факта свой источник, чужие слова не приписываются. */
const SOURCES = `ОТКУДА ТЫ ЗНАЕШЬ ТО, ЧТО ГОВОРИШЬ
— Что сказали студент и {client_name} на встрече — только из расшифровки встречи.
— Что {client_name} сказал{a} вне роли — только из реплик «вне роли» в разборе выше. Чего там нет, того {she_he} не говорил{a}: не начинай с «{client_name} сказал{a}…».
— Заметки разбора — выводы анализа, а не чьи-то слова: говори их от себя («мне кажется», «я заметил»).
— Как {client_name} ответил{a} на пробу — только то, что прозвучало в ответ; если ответа по существу не было, так и скажи.
— Что студент сказал о себе — только его реплики в разборе.
Не уверен, что кто-то это говорил, — не приписывай. Если студент задал тебе прямой вопрос — сначала коротко ответь на него.`;

export interface DebriefTurn {
  seq: number;
  role: "student" | "client" | "observer";
  text: string;
  segment: number;
}

function fill(text: string, c: ClientName): string {
  return text
    .replaceAll("{client_name_gen}", c.gen)
    .replaceAll("{client_name_dat}", c.dat)
    .replaceAll("{client_name_acc}", c.acc)
    .replaceAll("{client_name}", c.name)
    .replaceAll("{client_gender}", c.female ? "женский род («я почувствовала»)" : "мужской род («я почувствовал»)")
    .replaceAll("{she_he}", c.female ? "она" : "он")
    .replaceAll("{a}", c.female ? "а" : "")
    .replaceAll("{played}", c.female ? "играла" : "играл")
    .replaceAll("{decided}", c.female ? "решилась" : "решился");
}

const q = (s?: string | null) => (s ? `«${s}»` : "");
const unsure = (v?: boolean) => (v === false ? " (цитата не сверилась — дословно не цитируй)" : "");

/** Заметки текстового разбора для наблюдателя: только то, что прошло проверку цитат. */
function observerNotes(r: DebriefResult): string {
  const fb = r.feedback ?? {};
  const lines: string[] = [];
  if (fb.client_voice?.text) lines.push(`— Предположение анализа, как могло быть клиенту (это НЕ слова клиента; что он сказал на самом деле — его реплики «вне роли» в разборе): ${fb.client_voice.text}`);
  const main = fb.main;
  if (main?.note) lines.push(`— Главное по карте важного курса${main.name ? ` (${main.name})` : ""}: ${main.note}${main.quote ? ` — ${q(main.quote)} (${main.turn ?? "?"})` : ""}`);
  const progress = fb.progress;
  if (progress?.note) lines.push(`— Рост с прошлой встречи: ${progress.note}${progress.quote ? ` — ${q(progress.quote)} (${progress.turn ?? "?"})` : ""}`);
  for (const w of fb.worked ?? []) {
    lines.push(`— Сработало: ${q(w.quote)} (${w.turn ?? "?"})${w.skill ? ` — ${w.skill}` : ""}${w.effect ? `; после этого: ${w.effect}` : ""}${unsure(w.verified as boolean | undefined)}`);
  }
  for (const t of fb.try ?? []) {
    lines.push(
      `— Правка: клиент сказал ${q(t.client_line as string)} (${t.client_turn ?? "?"}), студент ответил ${q(t.quote)} (${t.turn ?? "?"})${unsure(t.verified as boolean | undefined)}; ` +
        `можно было: ${q(t.alternative as string)}${t.why ? `; по оценке анализа, это дало бы клиенту: ${t.why}` : ""}`,
    );
  }
  if (fb.focus?.text) lines.push(`— Фокус на следующую попытку: ${fb.focus.text}`);
  if (fb.stuck_stage?.note) lines.push(`— Где встреча застряла${fb.stuck_stage.name ? ` (${fb.stuck_stage.name})` : ""}: ${fb.stuck_stage.note}`);
  const tps = (r as { turning_points?: { client_turn?: string; kind?: string; trigger_turn?: string; note?: string }[] }).turning_points ?? [];
  if (tps.length) {
    const kind: Record<string, string> = { open: "клиент открылся", close: "клиент закрылся", missed: "важное прошло мимо" };
    lines.push(`— Поворотные моменты: ${tps.map((t) => `${t.client_turn} ${kind[t.kind ?? ""] ?? t.kind} после ${t.trigger_turn}${t.note ? ` (${t.note})` : ""}`).join("; ")}`);
  }
  const stages = (r as { stages?: { name?: string; status?: string; missing?: string | null }[] }).stages ?? [];
  if (stages.length) {
    const st: Record<string, string> = { present: "есть", partial: "частично", absent: "нет" };
    lines.push(`— Этапы встречи: ${stages.map((s) => `${s.name} — ${st[s.status ?? ""] ?? s.status}${s.missing && s.status !== "present" ? ` (${s.missing})` : ""}`).join("; ")}`);
  }
  const safety = (r as { safety?: { level?: string; note?: string | null } }).safety;
  if (safety?.level && safety.level !== "none") lines.push(`— Безопасность: ${safety.level}${safety.note ? `, ${safety.note}` : ""} — с этого и начни правку.`);
  return lines.join("\n");
}

/**
 * Заметки для клиента вне роли: его ощущения и то, что могло помочь, — без карточки персонажа и скрытого слоя.
 * Момент, где захотелось закрыться, — тот же, что правка наблюдателя (один главный момент на весь разбор).
 */
function clientNotes(r: DebriefResult): string {
  const cv = r.feedback?.client_voice;
  const t = r.feedback?.try?.[0] as { turn?: string; quote?: string; alternative?: string; why?: string } | undefined;
  const sameMoment = !t?.turn || !cv?.closed?.turn || cv.closed.turn === t.turn;
  const lines: string[] = [];
  if (cv?.text && sameMoment) lines.push(`Заметка «как мне было» (опирайся на неё, но говори своими словами): ${cv.text}`);
  if (cv?.heard?.quote) lines.push(`— Где стало легче: после слов студента ${q(cv.heard.quote)}`);
  const closedQuote = t?.quote ?? cv?.closed?.quote;
  if (closedQuote) lines.push(`— Где захотелось закрыться или стало тяжелее (это главный момент разбора — говори о нём, а не о другом): после слов студента ${q(closedQuote)}`);
  if (r.hidden_layer?.reached) lines.push("— Скрытое из роли ты на встрече уже рассказал(а) — не говори, что так и не решился(ась).");
  else if (cv?.unsaid) lines.push(`— Что так и не решился сказать (только общими словами): ${cv.unsaid}`);
  if (t?.alternative) lines.push(`Если студент спросит, что помогло бы, — отвечай ощущением, по смыслу этого: ${q(t.alternative)}${t.why ? ` (${t.why})` : ""}`);
  return lines.join("\n");
}

function debriefSoFar(turns: DebriefTurn[], c: ClientName): string {
  return turns
    .map((t) => {
      // Этап 4 — проба: студент говорит новую фразу клиенту, клиент отвечает снова в роли.
      const who =
        t.role === "student"
          ? t.segment === 4 ? "Студент (проба новой фразы)" : "Студент"
          : t.role === "client"
            ? t.segment === 4 ? `${c.name} (снова в роли, ответ на пробу)` : `${c.name} (вне роли)`
            : "Наблюдатель";
      return `${who}: ${t.text}`;
    })
    .join("\n");
}

export function buildDebriefInstruction(p: {
  cfg: DebriefVoiceConfig;
  ctx: DebriefContext;
  segment: DebriefSegment;
  state: DebriefScriptState;
  turns: DebriefTurn[];
  selfMissing: boolean;
}): string {
  const { cfg, ctx, segment, state } = p;
  const c = ctx.client;
  const useNotes = state.notes === "notes" && ctx.notes;
  const blocks: string[] = [LANG_LOCK, fill(cfg.rules, c), fill(segment === 2 ? cfg.client : cfg.observer, c)];
  const focus = cfg.modes[ctx.modeKey] ?? cfg.modes[ctx.debriefMode];
  if (focus) blocks.push(fill(focus, c));
  let seg = cfg.segments[String(segment) as "1" | "2" | "3"];
  if (segment === 1) seg = seg.replaceAll("{handover_line}", state.skipClient ? cfg.handover_line.self : cfg.handover_line.client);
  if (segment === 3) seg = seg.replaceAll("{rehearse_line}", !state.rehearsed && rehearsalTarget(ctx) ? cfg.rehearse_line.client : cfg.rehearse_line.aloud);
  // Студент в начале о себе не сказал — бережный возврат идёт первым, до обратной связи.
  if (segment === 3 && p.selfMissing) blocks.push(fill(cfg.self_missing, c));
  blocks.push(fill(seg, c));
  if (segment > 1 && !useNotes) blocks.push(fill(cfg.no_notes, c));

  const data = [`ВСТРЕЧА: режим «${ctx.modeName}», учебный клиент — ${ctx.clientDisplay}, около ${ctx.minutes} мин.`];
  if (segment === 2 && ctx.summaryPublic) data.push(`КОГО ТЫ ИГРАЛ(А): ${ctx.clientDisplay}. ${ctx.summaryPublic}`);
  data.push(`РАСШИФРОВКА ВСТРЕЧИ (распознана автоматически, номера ходов вслух не называй):\n${ctx.transcript || "(пусто)"}`);
  if (useNotes && ctx.notes) data.push(segment === 2 ? clientNotes(ctx.notes) : `ЗАМЕТКИ РАЗБОРА (выводы анализа; проверены по расшифровке; говори своими словами, не зачитывай):\n${observerNotes(ctx.notes)}`);
  const card = segment !== 2 ? studentCardText(ctx.card) : null;
  if (card) data.push(`${card}\nЕсли в этой встрече видно, что студент применил свой прошлый вывод, — назови это одной фразой с его цитатой (в шаге 1). Если не видно — не упрекай и не упоминай.`);
  if (p.turns.length) data.push(`РАЗБОР ДО ЭТОГО МОМЕНТА:\n${debriefSoFar(p.turns, c)}`);
  blocks.push(data.join("\n\n"));
  if (segment !== 2) blocks.push(fill(SOURCES, c));
  if (cfg.final_reminder) blocks.push(fill(cfg.final_reminder, c));
  blocks.push(LANG_LOCK);
  return blocks.filter(Boolean).join("\n\n");
}

/** Голос наблюдателя: свой, а если совпал с голосом клиента — запасной. */
export function observerVoice(cfg: DebriefVoiceConfig, clientVoice: string): string {
  return cfg.observer_voice === clientVoice ? cfg.observer_voice_fallback : cfg.observer_voice;
}

/** Фраза конца этапа в речи голоса. */
export function endsSegment(cfg: DebriefVoiceConfig, segment: DebriefSegment | "rehearse", text: string, c: ClientName): boolean {
  const src = cfg.phrases[String(segment) as "1" | "2" | "3" | "rehearse"];
  if (!src) return false;
  try {
    return new RegExp(src.replaceAll("{name}", c.stem), "iu").test(text.toLowerCase().replace(/ё/g, "е"));
  } catch {
    return false;
  }
}

// ——— «Вы о себе»: слова студента из разбора ———

export interface DebriefReflection {
  /** Ответ «как вы сейчас» — только студенту, куратору не показывается. */
  feel: string | null;
  /** Что получилось и что было трудно — его словами. */
  self: string | null;
  /** Его вывод на следующий раз. */
  takeaway: string | null;
  /** Сам / после подсказки (молчал, вернули) / не было. */
  level: "self" | "prompted" | "none";
}

const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export function reflectionFromTurns(turns: DebriefTurn[], state: DebriefScriptState | null): DebriefReflection {
  const student = (seg: number) => turns.filter((t) => t.role === "student" && t.segment === seg).map((t) => t.text.trim()).filter(Boolean);
  const s1 = student(1);
  const s3 = student(3);
  const feel = s1[0] ?? null;
  const selfParts = s1.slice(1);
  const self = selfParts.length ? selfParts.join(" ") : null;
  const takeaway = s3.length ? s3[s3.length - 1] : null;
  const selfWords = selfParts.reduce((n, t) => n + words(t), 0);
  const silences1 = state?.silences?.["1"] ?? 0;
  const level: DebriefReflection["level"] =
    selfWords >= 6 && silences1 === 0 ? "self" : selfWords > 0 || s3.length > 1 ? "prompted" : "none";
  return { feel, self, takeaway, level };
}

export async function loadDebriefTurns(db: SupabaseClient, debriefId: string): Promise<DebriefTurn[]> {
  const { data } = await db.from("voice_turns").select("seq, role, text, segment").eq("session_id", debriefId).order("seq");
  return (data ?? []) as DebriefTurn[];
}

// ——— Проба: клиент снова в роли на одну реплику ———

/** Реплика клиента из правки текстового разбора, на которую студент пробует ответить иначе. */
export function rehearsalTarget(ctx: DebriefContext): { upTo: number; clientLine: string } | null {
  const t = ctx.notes?.feedback?.try?.[0] as { client_turn?: string; client_line?: string } | undefined;
  const n = Number(/^C(\d+)$/.exec(t?.client_turn ?? "")?.[1] ?? 0);
  if (!n) return null;
  let cN = 0;
  const idx = ctx.callTurns.findIndex((x) => x.role === "client" && ++cN === n);
  if (idx < 0) return null;
  return { upTo: idx, clientLine: ctx.callTurns[idx].text };
}

/**
 * Инструкция и история клиента в роли для пробы: та же карточка, рамка режима и общие правила,
 * что во встрече, — разговор засеян до его реплики; студент отвечает на неё заново.
 */
export async function buildRehearsal(
  db: SupabaseClient,
  cfg: DebriefVoiceConfig,
  ctx: DebriefContext,
): Promise<{ instruction: string; history: HistoryTurn[] } | null> {
  const target = rehearsalTarget(ctx);
  if (!target || !ctx.clientId) return null;
  const [{ data: client }, { data: mode }, globalRules] = await Promise.all([
    db.from("voice_clients").select("prompt").eq("id", ctx.clientId).maybeSingle(),
    db.from("voice_modes").select("frame_prompt").eq("program_mode_id", ctx.programModeId).maybeSingle(),
    getConfig<string>("voice_global_rules", ""),
  ]);
  if (!client?.prompt || !mode) return null;
  const frame = `${mode.frame_prompt ?? ""}\n\n${fill(cfg.rehearsal_frame, ctx.client).replaceAll("{client_line}", target.clientLine)}`;
  return {
    instruction: buildInstruction({ globalRules: String(globalRules ?? ""), framePrompt: frame, personaPrompt: client.prompt as string, resumed: false }),
    history: ctx.callTurns.slice(0, target.upTo + 1),
  };
}
