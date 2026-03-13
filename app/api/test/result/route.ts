import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chat_id");

  if (!chatId) {
    return Response.json({ error: "chat_id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: result } = await supabase
    .from("test_results")
    .select("id, status")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!result) {
    return Response.json({ ready: false, status: "not_found" });
  }

  return Response.json({
    ready: result.status === "ready",
    status: result.status,
    result_id: result.id,
  });
}
