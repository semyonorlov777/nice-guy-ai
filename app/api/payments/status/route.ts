import { createClient } from "@/lib/supabase-server";
import { requireAuth, apiError } from "@/lib/api-helpers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("order_id");

  if (!orderId) {
    return apiError("order_id обязателен", 400);
  }

  const supabase = await createClient();

  const { user, response } = await requireAuth(supabase);
  if (response) return response;

  const { data: order } = await supabase
    .from("orders")
    .select("yookassa_status")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .single();

  if (!order) {
    return apiError("Заказ не найден", 404);
  }

  return Response.json({ status: order.yookassa_status || "created" });
}
