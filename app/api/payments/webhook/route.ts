import { createServiceClient } from "@/lib/supabase-server";
import yookassa from "@/lib/yookassa";

export async function POST(request: Request) {
  try {
    // HTTP Basic Auth verification
    const webhookSecret = process.env.YOOKASSA_WEBHOOK_SECRET;
    if (webhookSecret) {
      const authHeader = request.headers.get("authorization");
      if (!authHeader || authHeader !== `Basic ${webhookSecret}`) {
        console.error("[webhook] Invalid authorization header");
        return new Response("Unauthorized", { status: 401 });
      }
    }

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
          return new Response("Retry", { status: 500 });
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
          tokens_added: order.tokens_to_add,
          yookassa_id: order.yookassa_payment_id,
          status: "completed",
        });

        // Активация подписки
        if (order.type === "subscription") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pm = (verifiedPayment as any).payment_method;
          const paymentMethodId = pm?.id;
          const cardLast4 = pm?.card?.last4 || null;

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          await supabase
            .from("profiles")
            .update({
              subscription_plan: order.product_key,
              subscription_expires_at: expiresAt.toISOString(),
              subscription_payment_method_id: paymentMethodId || null,
              card_last4: cardLast4,
            })
            .eq("id", order.user_id);

          console.log(
            "[webhook] Subscription activated:",
            order.product_key,
            "until",
            expiresAt.toISOString()
          );
        }

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
