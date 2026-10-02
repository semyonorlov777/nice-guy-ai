// Разбор сессии без браузера (после ws-client.ts): захватывает очередь и считает разбор.
// npx tsx --env-file=.env.local scripts/voice/run-debrief.ts <sessionId> [<sessionId>…]
import { claimDebrief } from "../../lib/voice-practice/debrief";

async function main() {
  for (const id of process.argv.slice(2)) {
    const run = await claimDebrief(id);
    if (!run) {
      console.log(id, "— разбор уже идёт или готов");
      continue;
    }
    await run();
    console.log(id, "— готово");
  }
}
void main();
