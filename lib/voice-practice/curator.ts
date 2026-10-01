// Сводка куратора по потоку (макет к показу): демо-студенты из app_config + реальные сессии владельцев.
// Демо-данные вымышленные и лежат вне git (app_config.voice_curator_demo, исходник — приватная папка).
import { createServiceClient } from "@/lib/supabase-server";
import { getConfig } from "@/lib/config";

export const SKILLS = [
  { key: "open", name: "Открытые вопросы", short: "Откр. вопросы" },
  { key: "feel", name: "Отражение чувств", short: "Отраж. чувств" },
  { key: "para", name: "Перефразирование", short: "Перефраз." },
  { key: "why", name: "Без «почему»", short: "Без «почему»" },
  { key: "talk", name: "Слушает больше, чем говорит", short: "Слушает" },
] as const;
export type SkillKey = (typeof SKILLS)[number]["key"];
/** Балл 0–100: [первая сессия с поводом, последняя]. null — повода не было. */
export type SkillPair = [number | null, number | null];

export interface CuratorFlag {
  kind: "inactive" | "stuck" | "safety" | "integrity" | "pattern" | "divergence";
  text: string;
}

export interface CuratorDebrief {
  date: string;
  mode: string;
  client: string;
  minutes: number;
  headline: string | null;
  strength: { skill?: string; quote: string } | null;
  fix: { skill?: string; quote: string; alternative?: string } | null;
  attention: string[];
  sessionId?: string;
}

export interface CuratorStudent {
  id: string;
  name: string;
  real: boolean;
  sessions: number;
  minutes: number;
  lastDate: string | null;
  modes: Record<string, number>;
  skills: Record<SkillKey, SkillPair>;
  confidence: [number | null, number | null];
  flags: CuratorFlag[];
  debriefs: CuratorDebrief[];
}

interface DemoStudent {
  id: string;
  name: string;
  sessions: number;
  minutes: number;
  last_days_ago: number;
  modes: Record<string, number>;
  skills: Record<SkillKey, SkillPair>;
  confidence: [number | null, number | null];
  flags: CuratorFlag[];
  debriefs: (Omit<CuratorDebrief, "date"> & { days_ago: number })[];
}

const DAY = 86_400_000;
const INACTIVE_DAYS = 7;
const DEV_TEST_EMAIL = "dev_test@niceguy.local";

/** Куратор — строка voice_access с пометкой «куратор» или «владелец». */
export async function isCurator(userId: string, programId: string): Promise<boolean> {
  const { data } = await createServiceClient()
    .from("voice_access")
    .select("note")
    .eq("user_id", userId)
    .eq("program_id", programId)
    .maybeSingle();
  const note = (data?.note as string | null)?.toLowerCase() ?? "";
  return note.includes("куратор") || note.includes("владелец");
}

// Шкалы из проекта разбора (02 §4.4): рубричные — уровень модели, счётные — код.
const levelScore = (l: unknown): number | null => {
  const n = typeof l === "string" ? Number(l) : (l as number);
  return Number.isFinite(n) ? ([0, 35, 70, 100][Math.max(0, Math.min(3, n))] ?? null) : null;
};
const whyScore = (n: number): number => (n <= 0 ? 100 : n === 1 ? 70 : n === 2 ? 40 : 10);
const talkScore = (share: number): number => (share <= 0.35 ? 100 : share <= 0.45 ? 70 : share <= 0.6 ? 40 : 10);

function skillKeyOf(s: { id?: string; name?: string }): SkillKey | null {
  const id = s.id ?? "";
  const name = (s.name ?? "").toLowerCase();
  if (id === "open_questions" || name.includes("открыт")) return "open";
  if (id === "reflect_feeling" || name.includes("отражение чувств")) return "feel";
  if (id === "paraphrase" || name.includes("перефраз")) return "para";
  return null;
}

/** Отметки, которые считаются сами: давно не практикует, уверенность растёт без навыка. */
function derivedFlags(st: Omit<CuratorStudent, "flags">, now: number): CuratorFlag[] {
  const flags: CuratorFlag[] = [];
  if (st.lastDate) {
    const days = Math.floor((now - new Date(st.lastDate).getTime()) / DAY);
    if (days >= INACTIVE_DAYS) flags.push({ kind: "inactive", text: `Не практикует ${days} дн.` });
  }
  const [c0, c1] = st.confidence;
  const deltas = SKILLS.map(({ key }) => st.skills[key]).filter((p): p is [number, number] => p[0] != null && p[1] != null).map(([a, b]) => b - a);
  if (c0 != null && c1 != null && c1 - c0 >= 8 && deltas.length >= 3 && deltas.reduce((a, b) => a + b, 0) / deltas.length < 20) {
    flags.push({ kind: "divergence", text: "Уверенность выросла заметно сильнее навыков" });
  }
  return flags;
}

export async function loadDemoStudents(now: number): Promise<{ title: string; students: CuratorStudent[] }> {
  const raw = await getConfig<{ stream_title?: string; students?: DemoStudent[] } | string | null>("voice_curator_demo", null);
  const demo = typeof raw === "string" ? (JSON.parse(raw) as { stream_title?: string; students?: DemoStudent[] }) : raw;
  const ago = (d: number) => new Date(now - d * DAY).toISOString();
  const students = (demo?.students ?? []).map((d) => {
    const base = {
      id: d.id,
      name: d.name,
      real: false,
      sessions: d.sessions,
      minutes: d.minutes,
      lastDate: ago(d.last_days_ago),
      modes: d.modes,
      skills: d.skills,
      confidence: d.confidence,
      debriefs: d.debriefs.map(({ days_ago, ...rest }) => ({ ...rest, date: ago(days_ago) })),
    };
    return { ...base, flags: [...(d.flags ?? []), ...derivedFlags(base, now)] };
  });
  return { title: demo?.stream_title ?? "Поток", students };
}

interface SessionRow {
  id: string;
  user_id: string;
  kind: string;
  status: string;
  seconds_used: number;
  created_at: string;
  client_id: string | null;
  program_mode_id: string;
}

interface DebriefRow {
  session_id: string;
  status: string;
  is_fallback: boolean | null;
  integrity_valid: boolean | null;
  counters: { why_count?: number; talk_share_student?: number | null } | null;
  result: { skills?: { id?: string; name?: string; level?: unknown; occasion?: unknown }[]; safety?: { level?: string } } | null;
  strength: { skill?: string; quote?: string } | null;
  fix: { skill?: string; quote?: string; alternative?: string } | null;
  curator: { headline?: string; attention?: string[] } | null;
}

/** Реальные сессии владельцев (пометка «владелец» в voice_access), у кого есть хотя бы одна консультация от минуты. */
export async function loadRealStudents(programId: string, now: number): Promise<CuratorStudent[]> {
  const db = createServiceClient();
  const { data: access } = await db.from("voice_access").select("user_id, note").eq("program_id", programId);
  const owners = (access ?? []).filter((a) => ((a.note as string | null) ?? "").toLowerCase().includes("владелец")).map((a) => a.user_id as string);
  if (!owners.length) return [];

  const [{ data: sessionsRaw }, { data: profiles }, { data: clients }, { data: modes }, { data: reports }] = await Promise.all([
    db
      .from("voice_sessions")
      .select("id, user_id, kind, status, seconds_used, created_at, client_id, program_mode_id")
      .eq("program_id", programId)
      .in("user_id", owners)
      .eq("status", "ended")
      .order("created_at"),
    db.from("profiles").select("id, name, email").in("id", owners),
    db.from("voice_clients").select("id, display_name").eq("program_id", programId),
    db.from("program_modes").select("id, mode_templates!inner(name)").eq("program_id", programId),
    db.from("voice_self_reports").select("user_id, kind, sum, created_at").eq("program_id", programId).in("user_id", owners).in("kind", ["confidence_pre", "confidence_post"]).order("created_at"),
  ]);
  const sessions = (sessionsRaw ?? []) as SessionRow[];
  if (!sessions.length) return [];
  const { data: debriefsRaw } = await db
    .from("voice_debriefs")
    .select("session_id, status, is_fallback, integrity_valid, counters, result, strength, fix, curator")
    .in("session_id", sessions.map((s) => s.id));
  const debriefs = new Map(((debriefsRaw ?? []) as DebriefRow[]).map((d) => [d.session_id, d]));
  const clientName = new Map((clients ?? []).map((c) => [c.id as string, c.display_name as string]));
  const modeName = new Map((modes ?? []).map((m) => [m.id as string, (m.mode_templates as unknown as { name: string }).name]));

  const out: CuratorStudent[] = [];
  for (const uid of owners) {
    const mine = sessions.filter((s) => s.user_id === uid);
    if (!mine.length) continue;
    // Как в «Моей практике»: консультация — завершённая сессия от минуты.
    const done = mine.filter((s) => s.seconds_used >= 60);
    const profile = (profiles ?? []).find((p) => p.id === uid);
    // Тестовый вход разработчика (им гоняет робот) и аккаунты без консультаций в сводку не попадают.
    if (!done.length || profile?.email === DEV_TEST_EMAIL) continue;
    const modeCounts: Record<string, number> = {};
    for (const s of mine) {
      const m = modeName.get(s.program_mode_id) ?? "Консультация";
      modeCounts[m] = (modeCounts[m] ?? 0) + 1;
    }

    // Ряды баллов по сессиям в хронологии — для «первая → последняя».
    const series: Record<SkillKey, number[]> = { open: [], feel: [], para: [], why: [], talk: [] };
    const flags: CuratorFlag[] = [];
    let crashed = 0;
    let risk = false;
    for (const s of mine) {
      const d = debriefs.get(s.id);
      if (!d || d.status !== "ready" || d.is_fallback) continue;
      if (d.integrity_valid === false) {
        crashed++;
        continue;
      }
      if (d.result?.safety?.level === "risk") risk = true;
      for (const sk of d.result?.skills ?? []) {
        const key = skillKeyOf(sk);
        const score = sk.occasion === false || sk.occasion === "false" ? null : levelScore(sk.level);
        if (key && score != null) series[key].push(score);
      }
      // Счётные навыки — только по полным консультациям: в одной реплике «Трудного момента» им неоткуда взяться.
      if (s.kind === "full" && d.counters) {
        series.why.push(whyScore(d.counters.why_count ?? 0));
        if (d.counters.talk_share_student != null) series.talk.push(talkScore(d.counters.talk_share_student));
      }
    }
    if (risk) flags.push({ kind: "safety", text: "В разборе отмечен риск по безопасности клиента" });
    if (crashed) flags.push({ kind: "integrity", text: `Учебный клиент сбился в ${crashed} консультац. — не засчитаны` });

    const skills = Object.fromEntries(
      SKILLS.map(({ key }) => [key, series[key].length ? [series[key][0], series[key][series[key].length - 1]] : [null, null]]),
    ) as Record<SkillKey, SkillPair>;

    const myReports = (reports ?? []).filter((r) => r.user_id === uid && r.sum != null);
    const pre = myReports.find((r) => r.kind === "confidence_pre");
    const last = myReports[myReports.length - 1];

    const recent = [...mine]
      .reverse()
      .filter((s) => {
        const d = debriefs.get(s.id);
        return d?.status === "ready" && !d.is_fallback && (d.strength?.quote || d.fix?.quote);
      })
      .slice(0, 3)
      .map((s): CuratorDebrief => {
        const d = debriefs.get(s.id)!;
        return {
          date: s.created_at,
          mode: modeName.get(s.program_mode_id) ?? "Консультация",
          client: s.client_id ? clientName.get(s.client_id) ?? "" : "",
          minutes: Math.max(1, Math.round(s.seconds_used / 60)),
          headline: d.curator?.headline ?? null,
          strength: d.strength?.quote ? { skill: d.strength.skill, quote: d.strength.quote } : null,
          fix: d.fix?.quote ? { skill: d.fix.skill, quote: d.fix.quote, alternative: d.fix.alternative } : null,
          attention: d.curator?.attention ?? [],
          sessionId: s.id,
        };
      });

    const rawName = ((profile?.name as string | null) || (profile?.email as string | null) || "Владелец").trim();
    const name = rawName === rawName.toUpperCase() ? rawName.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : rawName;

    const base = {
      id: uid,
      name,
      real: true,
      sessions: done.length,
      minutes: Math.round(done.reduce((n, s) => n + s.seconds_used, 0) / 60),
      lastDate: mine[mine.length - 1].created_at,
      modes: modeCounts,
      skills,
      confidence: [pre?.sum ?? null, last && last !== pre ? last.sum : null] as [number | null, number | null],
      debriefs: recent,
    };
    out.push({ ...base, flags: [...flags, ...derivedFlags(base, now)] });
  }
  return out;
}

/** Вся сводка разом: реальные строки первыми, затем демо — сначала с отметками, потом по свежести. */
export async function loadCuratorBoard(programId: string): Promise<{ title: string; students: CuratorStudent[] }> {
  const now = Date.now();
  const [{ title, students: demo }, real] = await Promise.all([loadDemoStudents(now), loadRealStudents(programId, now)]);
  demo.sort((x, y) => y.flags.length - x.flags.length || (y.lastDate ?? "").localeCompare(x.lastDate ?? ""));
  return { title, students: [...real, ...demo] };
}
