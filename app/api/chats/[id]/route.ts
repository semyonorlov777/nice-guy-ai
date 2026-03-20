import { createClient } from "@/lib/supabase-server";
import { requireAuth } from "@/lib/api-helpers";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, response } = await requireAuth(supabase);
  if (response) return response;

  const body = await request.json();

  if (body.status !== "archived") {
    return Response.json(
      { error: "Можно только архивировать" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("chats")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[chats] Archive error:", error);
    return Response.json(
      { error: "Не удалось архивировать" },
      { status: 500 }
    );
  }

  return Response.json({ success: true });
}
