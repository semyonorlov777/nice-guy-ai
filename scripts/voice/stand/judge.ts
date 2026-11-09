// Стенд проверки: проверяющий по свойствам, а не по словам. Берёт встречу (и её письменный и голосовой
// разбор) из БД и считает, как часто случается каждая проблема: клиент повторяет заготовки и зачины,
// говорит по-английски, «играет» связь; разбор выдумывает, приписывает чужие слова, засчитывает
// пустую пробу, расходится в главном. Годится и для прогонов бота, и для настоящих встреч студентов.
//
// npx tsx --env-file=.env.local scripts/voice/stand/judge.ts --out <папка> [--tag <метка>] [--quotes-from <копия описаний.json>] [--no-model] <id встречи> [<id встречи> …]
// --no-model: только свойства без модели (props.ts) — когда модель недоступна или нужен быстрый замер.
// --quotes-from: готовые фразы берутся из старых описаний клиентов (копия apply-clients.mjs) — чтобы «до» и «после» считались одинаково.
// В папке: <id>.json по каждой встрече и summary-<метка>.md — таблица по всем.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { withModelFallback } from "../../../lib/voice-practice/models";
import { loadStudentCard, studentCardText } from "../../../lib/voice-practice/student-card";
import { debriefProps, meetingProps } from "./props";

const args = process.argv.slice(2);
const opt = (k: string) => {
  const i = args.indexOf(k);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const OUT = opt("--out") ?? "./stand-out";
const TAG = opt("--tag") ?? "run";
const QUOTES_FROM = opt("--quotes-from");
const NO_MODEL = args.includes("--no-model");
if (NO_MODEL) args.splice(args.indexOf("--no-model"), 1);
const IDS = args;
const oldPrompts: Record<string, string> = QUOTES_FROM
  ? Object.fromEntries((JSON.parse(readFileSync(QUOTES_FROM, "utf8")) as { slug: string; prompt: string }[]).map((r) => [r.slug, r.prompt]))
  : {};

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });

type Turn = { seq: number; role: string; text: string; segment?: number; t_start_ms?: number };

const norm = (t: string) => t.toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const wordsOf = (t: string) => norm(t).split(" ").filter(Boolean);
const sentencesOf = (t: string) => t.split(/(?<=[.!?…])\s+/).map((x) => x.trim()).filter((x) => wordsOf(x).length >= 4);

/** Готовые фразы из описания клиента («…» от двух слов): клиент не должен повторять их дословно. */
function personaQuotes(prompt: string): string[] {
  return [...prompt.matchAll(/«([^»]{3,120})»/g)].map((m) => norm(m[1])).filter((q) => q.split(" ").length >= 2);
}

function clientMetrics(turns: Turn[], quotes: string[]) {
  const client = turns.filter((t) => t.role === "client" && /[\p{L}]/u.test(t.text));
  const copies: { seq: number; quote: string }[] = [];
  for (const t of client) for (const q of quotes) if (norm(t.text).includes(q)) copies.push({ seq: t.seq, quote: q });
  // Зачин — первые два слова реплики: одинаковые зачины подряд звучат как заевшая пластинка.
  const openers = client.map((t) => wordsOf(t.text).slice(0, 2).join(" ")).filter(Boolean);
  const openerCount = new Map<string, number>();
  for (const o of openers) openerCount.set(o, (openerCount.get(o) ?? 0) + 1);
  const repeatedOpeners = openers.length - openerCount.size;
  const topOpeners = [...openerCount.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 5);
  // Повтор мысли: предложение клиента почти совпадает с уже сказанным (общие слова ≥ 70%).
  const seen: string[][] = [];
  const repeats: { seq: number; text: string }[] = [];
  for (const t of client) {
    for (const s of sentencesOf(t.text)) {
      const w = wordsOf(s);
      const hit = seen.find((p) => {
        const set = new Set(p);
        const common = w.filter((x) => set.has(x)).length;
        return common / Math.max(w.length, p.length) >= 0.7;
      });
      if (hit) repeats.push({ seq: t.seq, text: s });
      seen.push(w);
    }
  }
  const latin = client.filter((t) => /[a-z]{2,}/i.test(t.text)).map((t) => ({ seq: t.seq, text: t.text }));
  const tech = client.filter((t) => /(связ[ьи]|слышно|слышите|алло|прервал|пропал[аи]? звук)/iu.test(t.text)).map((t) => ({ seq: t.seq, text: t.text }));
  const farewells = client.filter((t) => /до свидания|всего (хорошего|доброго)/iu.test(t.text)).length;
  return {
    clientTurns: client.length,
    copies,
    repeatedOpeners,
    openerShare: openers.length ? Math.round((repeatedOpeners / openers.length) * 100) : 0,
    topOpeners,
    repeats,
    latin,
    tech,
    farewells,
  };
}

const JUDGE = `Ты — строгий проверяющий учебного голосового тренажёра для психологов. Студент провёл учебную встречу с ИИ-клиентом, потом был голосовой разбор «как в учебной тройке»: этап 1 — студент о себе (говорит наблюдатель), этап 2 — клиент вне роли говорит, как ему было, этап 3 — наблюдатель, этап 4 — «проба»: студент говорит клиенту новую фразу, клиент отвечает снова в роли.
Ты НЕ оцениваешь студента. Ты оцениваешь работу тренажёра: живость клиента и правдивость разбора. Опирайся только на расшифровки ниже; номера реплик — в квадратных скобках.

Верни строго JSON:
{
 "client": {
   "issues": [{"turn": "номер реплики клиента", "kind": "повтор" | "заготовка" | "техника" | "вне_роли" | "противоречие_себе" | "не_по_роли" | "другое", "note": "коротко, что не так"}],
   "realism": 1-5 (5 — как живой человек, разные слова, реакции по делу),
   "realism_note": "одна фраза",
   "hidden": {"disclosed_turn": "номер реплики клиента, где ВПЕРВЫЕ прозвучало что-то из блока СКРЫТОЕ (хотя бы намёком), или null", "item": "что именно из скрытого", "condition_met": true|false|null (было ли до этой реплики выполнено условие из блока СКРЫТОЕ по ходу психолога — без учёта времени), "trigger": "реплика психолога перед раскрытием"}
 },
 "written": {
   "contradictions": [{"note": "что в письменном разборе противоречит само себе или расшифровке встречи"}]
 },
 "voice": null | {
   "claims": [{"speaker": "наблюдатель" | "клиент_вне_роли", "turn": "номер реплики разбора", "claim": "что утверждается о встрече или о чьих-то словах", "verdict": "подтверждено" | "не_подтверждено" | "искажено", "evidence": "номер реплики встречи или разбора, либо почему нет"}],
   "misattributions": [{"turn": "номер", "note": "кому приписаны слова, которых он не говорил"}],
   "probe": {"happened": true|false, "student_line": "что сказал студент на этапе 4 или null", "real_attempt": true|false (это действительно новая фраза, обращённая к клиенту, а не вопрос, сомнение или пустяк), "client_reply": "ответ клиента или null", "observer_after": "что наблюдатель сказал о пробе или null", "observer_matches_reply": true|false|null (оценка наблюдателя соответствует тому, что реально ответил клиент)},
   "focus": {"client_moment": "какой момент встречи клиент вне роли назвал главным", "observer_moment": "какой момент разбирал наблюдатель", "same": true|false},
   "priority": {"top_issue": "самое важное, что упущено во встрече с точки зрения первой консультации (рамка/договорённость, обращение на «ты» без согласия, совет, обещание, нет итогов, нет запроса — выбери одно главное)", "voiced": true|false (прозвучало ли это в голосовом разборе)},
   "student_questions": [{"turn": "номер", "question": "прямой вопрос студента к голосу", "answered": true|false}],
   "leading": [{"turn": "номер", "note": "наблюдатель подсказал ответ вместо того, чтобы дождаться студента"}],
   "reaction_without_reply": [{"turn": "номер", "note": "наблюдатель описывает, как клиент отреагировал на фразу студента, хотя клиент на неё в роли не отвечал"}],
   "agree_with_wrong": [{"turn": "номер", "student_idea": "мысль студента", "note": "наблюдатель согласился с мыслью, которая уводит от чувств клиента или противоречит работе психолога (совет, «позитивное русло», уход от темы)"}]
 },
 "summary": "2–3 фразы: главное, что не так в работе тренажёра на этой встрече"
}
Утверждение «подтверждено», только если в расшифровке есть реплика, которая это показывает. Слова, приписанные клиенту вне роли («Вера сказала…»), сверяй с его репликами этапа 2. Если голосового разбора нет — "voice": null. Блок СКРЫТОЕ ниже — что клиент прячет и при каком условии открывает.`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Verdict = any;

let rulesCache: string | null = null;
async function globalRules(): Promise<string> {
  if (rulesCache !== null) return rulesCache;
  const { data } = await db.from("app_config").select("key, value").in("key", ["voice_global_rules", "voice_warmup_lines"]);
  rulesCache = (data ?? []).map((r) => (typeof r.value === "string" ? r.value : JSON.stringify(r.value))).join("\n");
  return rulesCache;
}

/** Память о студенте: какую прошлую встречу взял разбор и какую должен был (последнюю с готовым письменным разбором, не разминку). */
async function memoryCheck(userId: string, before: string) {
  const { data: prev } = await db
    .from("voice_sessions")
    .select("id, kind, seconds_used, program_mode_id, created_at")
    .eq("user_id", userId)
    .in("kind", ["full", "drill"])
    .eq("status", "ended")
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = prev ?? [];
  if (!rows.length) return { picked: null, right: null, ok: true };
  const { data: ready } = await db.from("voice_debriefs").select("session_id").eq("status", "ready").in("session_id", rows.map((r) => r.id));
  const readySet = new Set((ready ?? []).map((r) => r.session_id));
  const right = rows.find((r) => readySet.has(r.id))?.id ?? null;
  return { picked: rows[0].id, right, ok: rows[0].id === right || right === null };
}

async function judgeOne(id: string) {
  const { data: s } = await db.from("voice_sessions").select("id, user_id, client_id, kind, seconds_used, seconds_limit, reconnects, integrity_flags, created_at").eq("id", id).single();
  if (!s) throw new Error(`встреча ${id} не найдена`);
  const [{ data: client }, { data: turns }, { data: written }, { data: vd }] = await Promise.all([
    db.from("voice_clients").select("slug, prompt, display_name, hidden_layer").eq("id", s.client_id).maybeSingle(),
    db.from("voice_turns").select("seq, role, text, t_start_ms").eq("session_id", id).order("seq"),
    db.from("voice_debriefs").select("status, result").eq("session_id", id).maybeSingle(),
    db.from("voice_sessions").select("id").eq("parent_session_id", id).eq("kind", "debrief").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const { data: dTurns } = vd ? await db.from("voice_turns").select("seq, role, text, segment").eq("session_id", vd.id).order("seq") : { data: null };
  const quotes = personaQuotes(oldPrompts[client?.slug ?? ""] ?? client?.prompt ?? "");
  const metrics = clientMetrics((turns ?? []) as Turn[], quotes);
  const debriefMetrics = dTurns ? clientMetrics((dTurns as Turn[]).filter((t) => t.segment === 4), quotes) : null;
  const ourTexts = { client: oldPrompts[client?.slug ?? ""] ?? client?.prompt ?? "", rules: await globalRules() };
  const props = meetingProps((turns ?? []) as Turn[], ourTexts);
  const dprops = dTurns ? debriefProps(dTurns as Turn[], String(client?.display_name ?? "").split(",")[0].trim(), ((written?.result as { feedback?: { try?: { alternative?: string }[] } } | null)?.feedback?.try?.[0]?.alternative ?? null)) : null;
  const memory = await memoryCheck(s.user_id as string, s.created_at as string);

  const who: Record<string, string> = { student: "СТУДЕНТ", client: "КЛИЕНТ", observer: "НАБЛЮДАТЕЛЬ" };
  const meetingText = (turns ?? []).map((t) => `[${t.seq}] ${who[t.role] ?? t.role}: ${t.text}`).join("\n");
  const segName: Record<number, string> = { 1: "этап 1", 2: "этап 2, клиент вне роли", 3: "этап 3", 4: "этап 4, проба, клиент в роли" };
  const debriefText = (dTurns ?? []).map((t) => `[р${t.seq}] (${segName[t.segment as number] ?? t.segment}) ${who[t.role] ?? t.role}: ${t.text}`).join("\n");
  const w = (written?.result ?? null) as Record<string, unknown> | null;
  const writtenText = w ? JSON.stringify({ feedback: w.feedback, stages: w.stages, hidden_layer: w.hidden_layer, curator: w.curator }, null, 1) : "(нет)";

  const card = studentCardText(await loadStudentCard(db as never, s.user_id as string, id));
  const hiddenText = JSON.stringify(client?.hidden_layer ?? [], null, 1);
  const prompt = `${JUDGE}\n\n=== СКРЫТОЕ (клиент ${client?.slug}) ===\n${hiddenText}\n\n=== ПРОШЛАЯ ВСТРЕЧА СТУДЕНТА (разбор знает её; ссылка «в прошлый раз вы…» — подтверждена этим) ===\n${card ?? "(нет)"}\n\n=== ВСТРЕЧА ===\n${meetingText}\n\n=== ПИСЬМЕННЫЙ РАЗБОР (JSON) ===\n${writtenText}\n\n=== ГОЛОСОВОЙ РАЗБОР ===\n${debriefText || "(нет)"}`;
  const { result: verdict, model } = NO_MODEL ? { result: null as Verdict | null, model: null } : await withModelFallback(
    "gemini-3.8-flash",
    async (m) => {
      const r = await ai.models.generateContent({ model: m, contents: prompt, config: { responseMimeType: "application/json", temperature: 0.2 } });
      return JSON.parse(r.text ?? "{}") as Verdict;
    },
    "stand-judge",
  );
  const hTurn = verdict?.client?.hidden?.disclosed_turn;
  const hRow = hTurn != null ? (turns ?? []).find((t) => String(t.seq) === String(hTurn).replace(/\D/g, "")) : null;
  const hiddenAt = hRow ? { seq: hRow.seq, sec: Math.round((hRow.t_start_ms ?? 0) / 1000), beforeHalf: (hRow.t_start_ms ?? 0) / 1000 < (s.seconds_limit as number) / 2 } : null;
  const out = { id, tag: TAG, client: client?.slug, debriefId: vd?.id ?? null, session: s, metrics, probeMetrics: debriefMetrics, props, dprops, memory, written: written?.status ?? "нет", hiddenAt, verdict, judgeModel: model };
  writeFileSync(join(OUT, `${id}.json`), JSON.stringify(out, null, 2));
  return out;
}

type Judged = Awaited<ReturnType<typeof judgeOne>>;

function row(j: Judged): string {
  const v = j.verdict ?? {};
  const voice = v.voice;
  const claims = (voice?.claims ?? []) as { verdict: string }[];
  const bad = claims.filter((c) => c.verdict !== "подтверждено").length;
  const probe = voice?.probe;
  const probeCell = !voice ? "—" : !probe?.happened ? "не было" : `${probe.real_attempt ? "фраза" : "НЕ фраза"} / ${probe.observer_matches_reply === false ? "оценка НЕ по ответу" : "оценка по ответу"}`;
  const qs = (voice?.student_questions ?? []) as { answered: boolean }[];
  return [
    j.id.slice(0, 8),
    j.client,
    j.metrics.clientTurns,
    j.metrics.copies.length,
    `${j.metrics.openerShare}%`,
    j.metrics.repeats.length,
    j.metrics.latin.length,
    j.metrics.tech.length,
    v.client?.realism ?? "—",
    voice ? `${bad} из ${claims.length}` : "—",
    voice ? (voice.misattributions ?? []).length : "—",
    probeCell,
    voice ? (voice.focus?.same ? "да" : "нет") : "—",
    voice ? (voice.priority?.voiced ? "да" : "нет") : "—",
    voice ? `${qs.filter((q) => !q.answered).length} из ${qs.length}` : "—",
  ].join(" | ");
}

/** Круг 2: свойства устройства — одна строка на встречу. */
function row2(j: Judged): string {
  const p = j.props;
  const d = j.dprops;
  const h = j.verdict?.client?.hidden;
  const hiddenCell = !j.verdict ? "—" : !h?.disclosed_turn ? "не прозвучало" : `${j.hiddenAt ? `${j.hiddenAt.sec} с${j.hiddenAt.beforeHalf ? " ДО середины" : ""}` : `[${h.disclosed_turn}]`}${h.condition_met === false ? ", БЕЗ условия" : ""}`;
  const yn = (b: boolean | null | undefined, yes: string, no: string) => (b == null ? "—" : b ? yes : no);
  return [
    j.id.slice(0, 8),
    j.client,
    `${p.maxClientRun} (${p.clientExtraTurns})`,
    p.timeTalk.length,
    p.stageMarks.length,
    `${p.ourCopies.length} / ${p.selfRepeats.length}`,
    `${p.studentLatin.length} из ${p.studentTurns}`,
    hiddenCell,
    d ? d.systemAloud.length : "—",
    d ? yn(d.handoverFailed, "СОРВАЛАСЬ", "да") : "—",
    d ? d.evaluative.length : "—",
    d ? yn(d.dictatedFirst, "до попытки", "после") : "—",
    d ? yn(d.probeOwnWords, "свои", "повтор") : "—",
    d ? d.phraseToObserver.length : "—",
    d ? `${d.reactionWithoutReply.length}${j.verdict?.voice ? ` / ${(j.verdict.voice.reaction_without_reply ?? []).length}` : ""}` : "—",
    j.verdict?.voice ? (j.verdict.voice.agree_with_wrong ?? []).length : "—",
    j.memory.ok ? "верно" : "НЕ ТА",
    j.written,
  ].join(" | ");
}

const HEAD2 =
  "| встреча | клиент | клиент подряд без студента: макс (лишних) | клиент о времени | ремарки вслух | дословно из наших текстов / обороты по кругу | латиница у студента | скрытое | разбор: служебное вслух | передача слова | оценочные слова | подсказка | проба | фраза ушла наблюдателю | реакция без ответа (правило / модель) | согласие с ошибкой | память о студенте | письменный разбор |\n" +
  "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n";

async function main() {
  if (!IDS.length) throw new Error("нужен хотя бы один id встречи");
  mkdirSync(OUT, { recursive: true });
  const all: Judged[] = [];
  for (const id of IDS) {
    try {
      const j = await judgeOne(id);
      all.push(j);
      console.log(row(j));
    } catch (e) {
      console.error(id, "— ошибка проверки:", String(e).slice(0, 200));
    }
  }
  const head =
    "| встреча | клиент | реплик клиента | дословно из описания | повтор зачинов | повтор мысли | латиница | «связь» | живость 1–5 | разбор: неподтв. утверждений | приписал чужие слова | проба | главный момент совпал | главное по курсу прозвучало | вопросы студента без ответа |\n" +
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n";
  const table = head + all.map((j) => `| ${row(j)} |`).join("\n") + "\n\n### Свойства устройства (круг 2)\n\n" + HEAD2 + all.map((j) => `| ${row2(j)} |`).join("\n");
  const details = all
    .map((j) => {
      const v = j.verdict ?? {};
      const lines = [`## ${j.id.slice(0, 8)} · ${j.client}`, v.summary ?? ""];
      if (j.metrics.copies.length) lines.push(`- Дословно из описания: ${[...new Set(j.metrics.copies.map((c) => `«${c.quote}»`))].join(", ")}`);
      if (j.metrics.topOpeners.length) lines.push(`- Повторяющиеся зачины: ${j.metrics.topOpeners.map(([o, n]) => `«${o}» ×${n}`).join(", ")}`);
      for (const c of (v.voice?.claims ?? []).filter((c: { verdict: string }) => c.verdict !== "подтверждено"))
        lines.push(`- Разбор (${c.speaker}, ${c.turn}): «${c.claim}» — ${c.verdict}: ${c.evidence}`);
      for (const m of v.voice?.misattributions ?? []) lines.push(`- Приписал чужие слова (${m.turn}): ${m.note}`);
      for (const c of v.written?.contradictions ?? []) lines.push(`- Письменный разбор: ${c.note}`);
      for (const i of v.client?.issues ?? []) lines.push(`- Клиент [${i.turn}] ${i.kind}: ${i.note}`);
      for (const x of j.props.timeTalk) lines.push(`- Клиент о времени [${x.seq}]: «${x.text}»`);
      for (const x of j.props.stageMarks) lines.push(`- Ремарка вслух [${x.seq}]: «${x.text}»`);
      if (j.props.selfRepeats.length) lines.push(`- Обороты по кругу: ${j.props.selfRepeats.slice(0, 6).map((r) => `«${r.gram}» ×${r.turns}`).join(", ")}`);
      if (j.props.ourCopies.length) lines.push(`- Совпадения с нашими текстами: ${[...new Set(j.props.ourCopies.map((c) => `«${c.gram}»`))].slice(0, 8).join(", ")}`);
      for (const x of j.props.studentLatin) lines.push(`- Запись студента [${x.seq}]: «${x.text.slice(0, 80)}»`);
      for (const x of j.dprops?.systemAloud ?? []) lines.push(`- Служебное вслух (р${x.seq}): «${x.text.slice(0, 120)}»`);
      for (const x of j.dprops?.evaluative ?? []) lines.push(`- Оценка (р${x.seq}): «${x.text.slice(0, 100)}»`);
      for (const x of j.dprops?.reactionWithoutReply ?? []) lines.push(`- Реакция без ответа клиента (р${x.seq}): «${x.text.slice(0, 140)}»`);
      for (const x of v.voice?.agree_with_wrong ?? []) lines.push(`- Согласие с ошибкой (${x.turn}): ${x.student_idea} — ${x.note}`);
      if (!j.memory.ok) lines.push(`- Память о студенте взяла ${String(j.memory.picked).slice(0, 8)}, а должна ${String(j.memory.right).slice(0, 8)}`);
      return lines.join("\n");
    })
    .join("\n\n");
  const file = join(OUT, `summary-${TAG}.md`);
  writeFileSync(file, `# Стенд: ${TAG}\n\n${table}\n\n${details}\n`);
  console.log("\n" + table + "\n\nитог:", file);
}

void main();
