// Новый билет для переподключения к идущей сессии (обрыв, сворачивание, предел функции).
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { apiError, requireAuth } from "@/lib/api-helpers";
import { newTicket } from "@/lib/voice-practice/ticket";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, response } = await requireAuth(supabase);
  if (response) return response;

  const t = newTicket();
  const { data } = await createServiceClient()
    .from("voice_sessions")
    .update({ ticket_hash: t.hash, ticket_expires_at: t.expiresAt })
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["created", "active", "paused", "reconnecting"])
    .select("id")
    .maybeSingle();
  if (!data) return apiError("Консультация уже завершена", 404);
  return Response.json({ ticket: t.ticket });
}
