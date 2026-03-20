import { createClient } from "@/lib/supabase-server";
import { requireAuth } from "@/lib/api-helpers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chat_id");

  if (!chatId) {
    return Response.json({ error: "chat_id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { user, response } = await requireAuth(supabase);
  if (response) return response;

  const { data: result, error } = await supabase
    .from("test_results")
    .select("id, status")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[test-result] polling query error:", error);
  }

  if (!result) {
    console.log("[test-result] polling chat_id=%s → not_found", chatId);
    return Response.json({ ready: false, status: "not_found" });
  }

  console.log("[test-result] polling chat_id=%s → status=%s, id=%s", chatId, result.status, result.id);

  return Response.json({
    ready: result.status === "ready",
    status: result.status,
    result_id: result.id,
  });
}
