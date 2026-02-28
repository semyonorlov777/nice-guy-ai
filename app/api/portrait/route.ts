import { createClient } from "@/lib/supabase-server";
import { EMPTY_PORTRAIT } from "@/types/portrait";

export async function GET(request: Request) {
  const supabase = await createClient();

  // 1. Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Не авторизован" }, { status: 401 });
  }

  // 2. Get program_id from query params
  const { searchParams } = new URL(request.url);
  const programId = searchParams.get("program_id");
  if (!programId) {
    return Response.json({ error: "Не указан program_id" }, { status: 400 });
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
    return Response.json({ error: "Ошибка загрузки портрета" }, { status: 500 });
  }

  // 4. Return portrait or empty structure
  const content = portrait?.content || EMPTY_PORTRAIT;

  return Response.json(content);
}
