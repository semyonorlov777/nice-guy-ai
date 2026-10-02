// Голосовая сессия на своём WebSocket-сервере, на том же коде, что и прод (session-core):
// проверять сценарии без выкладки — локальный Next WebSocket не умеет.
// npx tsx --env-file=.env.local scripts/voice/local-relay.ts [--port 8787]
// Бот: ws-client.ts --url ws://localhost:8787/api/practice/ws.
// Браузер: NEXT_PUBLIC_VOICE_WS_URL=ws://localhost:8787/api/practice/ws npm run dev.
import { WebSocketServer } from "ws";
import { runVoiceSession } from "../../lib/voice-practice/session-core";

const i = process.argv.indexOf("--port");
const port = i >= 0 ? Number(process.argv[i + 1]) : 8787;
const wss = new WebSocketServer({ port, path: "/api/practice/ws", maxPayload: 256 * 1024 });
wss.on("connection", (ws) => {
  runVoiceSession(ws).catch((e) => {
    console.error("[local-relay] session crashed", e);
    try {
      ws.close(1011, "internal_error");
    } catch {}
  });
});
console.log(`[local-relay] ws://localhost:${port}/api/practice/ws`);
