// Сравнить разбор «было → стало» на готовых сессиях, ничего не записывая в voice_debriefs:
// старый разбор берётся из БД, новый собирается инструкцией из файла (текст инструкции — вне git).
//
// npx tsx --env-file=.env.local scripts/voice/debrief-compare.ts --rubric <файл> <sessionId> [<sessionId> …]
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  debriefChecked,
  prepareDebriefInput,
} from "../../lib/voice-practice/debrief";

const args = process.argv.slice(2);
const ri = args.indexOf("--rubric");
if (ri < 0) throw new Error("--rubric <файл> обязателен");
const rubric = readFileSync(args[ri + 1], "utf8");
const ids = args.filter((_, i) => i !== ri && i !== ri + 1);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  for (const id of ids) {
    const { data: old } = await db
      .from("voice_debriefs")
      .select("strength, fix, summary, rubric_version")
      .eq("session_id", id)
      .maybeSingle();
    const input = await prepareDebriefInput(db, id);
    if (input.kind === "short") {
      console.log(`\n=== ${id}: слишком коротко`);
      continue;
    }
    const t0 = Date.now();
    const { result, model, attempts, unverified } = await debriefChecked(rubric, input);
    const fb = result.feedback ?? {};
    console.log(
      `\n=== ${id} · ${model} · ${Math.round((Date.now() - t0) / 1000)} с · попыток ${attempts} · не сошлось цитат ${unverified}`,
    );
    console.log(
      "БЫЛО:",
      JSON.stringify(
        {
          strength: old?.strength?.quote,
          fix: old?.fix?.quote,
          alt: old?.fix?.alternative,
          summary: old?.summary,
        },
        null,
        1,
      ),
    );
    const cv = fb.client_voice;
    const ok = (x?: { verified?: unknown } | null) =>
      x?.verified === false ? " [цитата не найдена]" : "";
    console.log("СТАЛО:");
    console.log(`  Клиент: ${cv?.text ?? "—"}${ok(cv)}`);
    for (const w of fb.worked ?? [])
      console.log(`  Сработало ${w.turn}: «${w.quote}» — ${w.effect}${ok(w)}`);
    for (const t of fb.try ?? [])
      console.log(
        `  Иначе: клиент ${t.client_turn} «${t.client_line}» / вы ${t.turn} «${t.quote}» → «${t.alternative}» — ${t.why}${ok(t)}`,
      );
    console.log(
      `  Застряли: ${fb.stuck_stage ? `${fb.stuck_stage.name}: ${fb.stuck_stage.note}` : "—"}`,
    );
    console.log(`  Фокус: ${fb.focus?.text ?? "—"}`);
    console.log(`  Куратору: ${result.curator?.headline ?? "—"}`);
  }
}

void main();
