import { createClient } from "@/lib/supabase-server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Не авторизован" }, { status: 401 });
  }

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
