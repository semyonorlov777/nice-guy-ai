// Ретранслятор голосового практикума. Этап 0: проверка связи.
//   GET  /health  — жив ли сервис (для пробы задержки)
//   POST /echo    — возвращает тело как есть (ловит «заморозку после 16 КБ»)
//   WS   /probe   — эхо двоичных кадров (поток 3 минуты, как живой звонок)
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8787);
const ALLOWED = (process.env.ALLOWED_ORIGINS || "https://nice-guy-ai.vercel.app,http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const MAX_ECHO_BYTES = 256 * 1024;

function cors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (origin && ALLOWED.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

const server = createServer((req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ ok: true, t: Date.now() }));
    return;
  }
  if (req.url === "/echo" && req.method === "POST") {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_ECHO_BYTES) req.destroy();
      else chunks.push(c);
    });
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" });
      res.end(Buffer.concat(chunks));
    });
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });

server.on("upgrade", (req, socket, head) => {
  const origin = req.headers.origin;
  const path = (req.url || "").split("?")[0];
  if (path !== "/probe" || (origin && !ALLOWED.includes(origin))) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    let bytes = 0;
    const started = Date.now();
    const limit = setTimeout(() => ws.close(1000, "probe_time_limit"), 5 * 60_000);
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
  });
});

server.listen(PORT, () => console.log(`voice-relay слушает :${PORT}`));
