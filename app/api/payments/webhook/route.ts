import { createServiceClient } from "@/lib/supabase-server";
import yookassa from "@/lib/yookassa";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { event, object } = body;

    console.log("[webhook] Received:", event, object?.id);

    if (!event || !object) {
      console.error("[webhook] Invalid body");
      return new Response("OK", { status: 200 });
    }

    const supabase = createServiceClient();

    switch (event) {
      case "payment.succeeded": {
        const paymentId = object.id;
        const orderId = object.metadata?.order_id;

        if (!orderId) {
          console.error("[webhook] No order_id in metadata");
          return new Response("OK", { status: 200 });
        }

        // Верификация: проверить платёж напрямую через API ЮKassa
        let verifiedPayment;
        try {
          verifiedPayment = await yookassa.getPayment(paymentId);
        } catch (err) {
          console.error("[webhook] Failed to verify payment:", err);
          return new Response("OK", { status: 200 });
        }

        if (verifiedPayment.status !== "succeeded") {
          console.error(
            "[webhook] Payment not succeeded:",
            verifiedPayment.status
          );
          return new Response("OK", { status: 200 });
        }

        // Загрузить заказ
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single();

        if (orderError || !order) {
          console.error("[webhook] Order not found:", orderId, orderError);
          return new Response("OK", { status: 200 });
        }

        // Защита от двойного начисления
        if (order.yookassa_status === "succeeded") {
          console.log("[webhook] Order already processed:", orderId);
          return new Response("OK", { status: 200 });
        }

        // Начислить токены атомарно через rpc
        const { error: balanceError } = await supabase.rpc("add_tokens", {
          p_user_id: order.user_id,
          p_tokens: order.tokens_to_add,
        });

        if (balanceError) {
          // Fallback: обычный select + update (rpc предпочтительнее для атомарности)
          console.warn("[webhook] rpc add_tokens failed, using fallback:", balanceError);
          const { data: profile } = await supabase
            .from("profiles")
            .select("balance_tokens")
            .eq("id", order.user_id)
            .single();

          const { error: updateError } = await supabase
            .from("profiles")
            .update({
              balance_tokens: (profile?.balance_tokens || 0) + order.tokens_to_add,
            })
            .eq("id", order.user_id);

          if (updateError) {
            console.error("[webhook] Failed to add tokens:", updateError);
            // Вернуть 500 чтобы ЮKassa повторила запрос
            return new Response("Retry", { status: 500 });
          }
        }

        // Обновить статус заказа
        await supabase
          .from("orders")
          .update({
            yookassa_status: "succeeded",
            paid_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        // Записать в историю платежей (для UI на странице /balance)
        await supabase.from("payments").insert({
          user_id: order.user_id,
          amount: order.amount,
          tokens: order.tokens_to_add,
          type: order.product_key,
          status: "completed",
        });

        console.log(
          "[webhook] Payment processed:",
          orderId,
          "+",
          order.tokens_to_add,
          "tokens"
        );
        break;
      }

      case "payment.canceled": {
        const orderId = object.metadata?.order_id;
        if (orderId) {
          await supabase
            .from("orders")
            .update({ yookassa_status: "canceled" })
            .eq("id", orderId);
          console.log("[webhook] Payment canceled:", orderId);
        }
        break;
      }

      case "refund.succeeded": {
        console.log("[webhook] Refund succeeded:", object.id);
        // TODO: списать токены обратно, обновить payments
        break;
      }

      default:
        console.log("[webhook] Unknown event:", event);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[webhook] Unexpected error:", err);
    return new Response("OK", { status: 200 });
  }
}
