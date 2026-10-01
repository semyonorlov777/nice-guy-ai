// Проверка связи: возвращает тело как есть (ловит «заморозку после 16 КБ»).
export const dynamic = "force-dynamic";

const MAX_BYTES = 256 * 1024;

export async function POST(req: Request) {
  const body = await req.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return new Response(null, { status: 413 });
  return new Response(body, {
    headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
  });
}
