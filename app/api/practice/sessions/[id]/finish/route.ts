// Завершение сессии из браузера — на случай, если соединение уже оборвалось
// и сервер звонка не успел закрыть сессию сам. Идемпотентно.
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { apiError, requireAuth } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, response } = await requireAuth(supabase);
  if (response) return response;

  const db = createServiceClient();
  const { data: s } = await db.from("voice_sessions").select("id, kind, status").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!s) return apiError("Не найдено", 404);

  if (s.status !== "ended" && s.status !== "failed") {
    await db
      .from("voice_sessions")
      .update({ status: "ended", end_reason: "student", ended_at: new Date().toISOString(), conn_id: null })
      .eq("id", id)
      .in("status", ["created", "active", "paused", "reconnecting"]);
  }
  if (s.kind !== "debrief") {
    await db.from("voice_debriefs").upsert({ session_id: id, status: "queued" }, { onConflict: "session_id", ignoreDuplicates: true });
  }
  return Response.json({ ok: true });
}
