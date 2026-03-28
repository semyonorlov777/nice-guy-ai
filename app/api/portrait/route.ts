import { createClient } from "@/lib/supabase-server";
import { requireAuth, apiError } from "@/lib/api-helpers";
import { EMPTY_PORTRAIT } from "@/types/portrait";

export async function GET(request: Request) {
  const supabase = await createClient();

  // 1. Auth
  const { user, response } = await requireAuth(supabase);
  if (response) return response;

  // 2. Get program_id from query params
  const { searchParams } = new URL(request.url);
  const programId = searchParams.get("program_id");
  if (!programId) {
    return apiError("Не указан program_id", 400);
  }

  // 3. Load portrait
  const { data: portrait, error } = await supabase
    .from("portraits")
    .select("content")
    .eq("user_id", user.id)
    .eq("program_id", programId)
    .maybeSingle();

  if (error) {
    console.error("[portrait] Failed to load portrait:", error);
    return apiError("Ошибка загрузки портрета", 500);
  }

  // 4. Return portrait or empty structure
  const content = portrait?.content || EMPTY_PORTRAIT;

  return Response.json(content);
}
