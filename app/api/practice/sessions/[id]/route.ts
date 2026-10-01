// Состояние сессии для страницы звонка и ожидания разбора. Без текстов инструкций.
import { createClient } from "@/lib/supabase-server";
import { apiError, requireAuth } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, response } = await requireAuth(supabase);
  if (response) return response;

  // RLS: владелец читает свою сессию и разбор.
  const { data: s } = await supabase
    .from("voice_sessions")
    .select("id, status, end_reason, seconds_limit, seconds_used, started_at, ended_at, voice_debriefs(status, is_fallback, result)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!s) return apiError("Не найдено", 404);
  return Response.json(s, { headers: { "Cache-Control": "no-store" } });
}
