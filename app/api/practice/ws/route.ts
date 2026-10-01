// Голосовая сессия: WebSocket держит функция Vercel. Первый кадр — {t:"auth", ticket}.
// Предел функции 300 с: за 30 с до него сервер шлёт {t:"rotate"}, браузер
// берёт новый билет и переподключается — разговор продолжается по истории из БД.
import { experimental_upgradeWebSocket } from "@vercel/functions";
import { runVoiceSession } from "@/lib/voice-practice/session-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  return experimental_upgradeWebSocket(
    (ws) => {
      runVoiceSession(ws).catch((e) => {
        console.error("[voice] session crashed", e);
        try {
          ws.close(1011, "internal_error");
        } catch {}
      });
    },
    { maxPayload: 256 * 1024 },
  );
}
