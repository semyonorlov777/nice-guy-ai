// Голосовой разбор без звука: собрать инструкции трёх голосов по встрече (проверка сценария и данных).
// npx tsx --env-file=.env.local scripts/voice/debrief-voice-dry.ts <id встречи> [этап 1|2|3] [--transcript]
import { createClient } from "@supabase/supabase-js";
import { buildDebriefInstruction, getDebriefConfig, loadDebriefContext, observerVoice, type DebriefSegment } from "../../lib/voice-practice/debrief-voice";

async function main() {
  const [parentId, segArg] = process.argv.slice(2);
  if (!parentId) throw new Error("нужен id встречи");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const cfg = await getDebriefConfig();
  const ctx = await loadDebriefContext(db, parentId);
  if (!cfg || !ctx) throw new Error("нет настройки voice_debrief или встречи");
  const notes = process.argv.includes("--transcript") ? "transcript" : ctx.notesStatus === "ready" ? "notes" : "transcript";
  console.log(`встреча ${parentId}: ${ctx.modeName}, ${ctx.clientDisplay}; заметки: ${ctx.notesStatus} → ${notes}`);
  console.log(`голоса: наблюдатель ${observerVoice(cfg, ctx.clientVoice)}, клиент ${ctx.clientVoice}`);
  for (const seg of (segArg ? [Number(segArg)] : [1, 2, 3]) as DebriefSegment[]) {
    const text = buildDebriefInstruction({ cfg, ctx, segment: seg, state: { segment: seg, notes }, turns: [], selfMissing: seg === 3 });
    console.log(`\n==================== ЭТАП ${seg} (${text.length} знаков) ====================\n${text}`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
