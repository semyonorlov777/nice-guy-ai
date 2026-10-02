// Сравнить подсказку разминки «было → стало» на готовых попытках: та же попытка оценивается
// рубрикой из app_config и рубрикой из файла (текст — вне git). Ничего не записывает.
//
// npx tsx --env-file=.env.local scripts/voice/warmup-compare.ts --rubric <файл> <sessionId> [<sessionId> …]
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_WARMUP_SET,
  splitAttempt,
  warmupVerdict,
  type WarmupTurn,
} from "../../lib/voice-practice/warmup";

const args = process.argv.slice(2);
const ri = args.indexOf("--rubric");
if (ri < 0) throw new Error("--rubric <файл> обязателен");
const newRubric = readFileSync(args[ri + 1], "utf8");
const ids = args.filter((_, i) => i !== ri && i !== ri + 1);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { data: cfgRow } = await db
    .from("app_config")
    .select("value")
    .eq("key", "voice_warmup_lines")
    .single();
  const cfg = JSON.parse(cfgRow!.value as string);
  const set = cfg.sets[DEFAULT_WARMUP_SET];
  for (const id of ids) {
    const { data: s } = await db
      .from("voice_sessions")
      .select("program_mode_id, drill_moment_id")
      .eq("id", id)
      .single();
    const { data: mode } = await db
      .from("voice_modes")
      .select("drill_moments")
      .eq("program_mode_id", s!.program_mode_id)
      .maybeSingle();
    const moment = (
      (mode?.drill_moments as { id: string; n?: number }[] | null) ?? []
    ).find((m) => m.id === s!.drill_moment_id);
    const line = set.lines.find((l: { n: number }) => l.n === moment?.n);
    const { data: turns } = await db
      .from("voice_turns")
      .select("seq, role, text")
      .eq("session_id", id)
      .order("seq");
    const { answer, reply } = splitAttempt((turns ?? []) as WarmupTurn[]);
    if (!line || !answer) {
      console.log(`\n=== ${id}: нет реплики или ответа`);
      continue;
    }
    const [was, now] = await Promise.all([
      warmupVerdict(cfg.rubric, set.client_name, line, answer, reply),
      warmupVerdict(newRubric, set.client_name, line, answer, reply),
    ]);
    console.log(
      `\n=== ${id} · реплика ${line.n}: «${line.line}»\nОтвет: «${answer}»\nКлиент: «${reply}»`,
    );
    console.log(
      `БЫЛО  (${was.reaction}) сработало: ${was.got}\n      попробуйте: ${was.try}`,
    );
    console.log(
      `СТАЛО (${now.reaction}) сработало: ${now.got}\n      попробуйте: ${now.try}`,
    );
  }
}

void main();
