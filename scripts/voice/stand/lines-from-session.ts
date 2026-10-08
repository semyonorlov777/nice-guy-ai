// Стенд проверки: реплики студента из настоящей встречи (и её голосового разбора) — в файл для повтора ботом.
// Обрывки распознавания (одно слово, кроме «да/угу/нет») отбрасываются; разбор — по этапам «## N».
//
// npx tsx --env-file=.env.local scripts/voice/stand/lines-from-session.ts <id встречи> <файл встречи> [<файл разбора>]
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [meetingId, meetingOut, debriefOut] = process.argv.slice(2);
if (!meetingId || !meetingOut) throw new Error("нужны <id встречи> <файл встречи>");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const KEEP_SHORT = /^(да|нет|угу|ага|хорошо|понятно|давайте)[.!?…]*$/iu;
const words = (t: string) => t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const keep = (t: string) => words(t) >= 2 || KEEP_SHORT.test(t.trim());

async function main() {
  const { data: turns } = await db.from("voice_turns").select("role, text").eq("session_id", meetingId).order("seq");
  const lines = (turns ?? []).filter((t) => t.role === "student" && keep(t.text)).map((t) => t.text.trim());
  writeFileSync(meetingOut, `# реплики студента встречи ${meetingId}\n${lines.join("\n")}\n`);
  console.log(meetingOut, lines.length, "реплик");
  if (!debriefOut) return;
  const { data: d } = await db.from("voice_sessions").select("id").eq("parent_session_id", meetingId).eq("kind", "debrief").order("created_at").limit(1).maybeSingle();
  if (!d) return console.log("голосового разбора нет");
  const { data: dt } = await db.from("voice_turns").select("role, text, segment").eq("session_id", d.id).order("seq");
  const out: string[] = [`# реплики студента разбора ${d.id}`];
  let seg = 0;
  for (const t of dt ?? []) {
    if (t.role !== "student" || !keep(t.text)) continue;
    if (t.segment !== seg) {
      seg = t.segment;
      out.push(`## ${seg}`);
    }
    out.push(t.text.trim());
  }
  writeFileSync(debriefOut, out.join("\n") + "\n");
  console.log(debriefOut, out.length - 1, "строк");
}
void main();
