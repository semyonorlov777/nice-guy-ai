// Проверка связи для голосового практикума: время отклика.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, t: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
