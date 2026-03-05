import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("order_id");

  if (!orderId) {
    return Response.json({ error: "order_id required" }, { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("yookassa_status")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .single();

  if (!order) {
    return Response.json({ error: "Заказ не найден" }, { status: 404 });
  }

  return Response.json({ status: order.yookassa_status || "created" });
}
