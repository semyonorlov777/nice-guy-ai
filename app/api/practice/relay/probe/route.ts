// Проверка связи: эхо двоичных кадров по WebSocket (поток как в живом звонке).
// Долгое соединение держит функция Vercel (WebSocket, бета, Fluid compute).
import { experimental_upgradeWebSocket } from "@vercel/functions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  return experimental_upgradeWebSocket(
    (ws) => {
      let bytes = 0;
      const started = Date.now();
      const limit = setTimeout(() => ws.close(1000, "probe_time_limit"), 290_000);
      ws.on("message", (data, isBinary) => {
        if (isBinary) {
          const buf = data as Buffer;
          bytes += buf.length;
          ws.send(buf, { binary: true });
        } else {
          ws.send(JSON.stringify({ t: "stat", bytes, ms: Date.now() - started }));
        }
      });
      ws.on("close", () => clearTimeout(limit));
    },
    { maxPayload: 256 * 1024 },
  );
}
