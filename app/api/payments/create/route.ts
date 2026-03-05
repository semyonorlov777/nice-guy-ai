import { createClient, createServiceClient } from "@/lib/supabase-server";
import yookassa from "@/lib/yookassa";
import { PRODUCTS } from "@/lib/products";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  const supabase = await createClient();

  // 1. Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Не авторизован" }, { status: 401 });
  }

  // 2. Parse body
  const { productKey } = await request.json();
  const product = PRODUCTS[productKey];
  if (!product) {
    return Response.json({ error: "Неизвестный продукт" }, { status: 400 });
  }

  // 3. Idempotency key
  const idempotencyKey = randomUUID();

  // 4. Создать заказ в БД
  const serviceClient = createServiceClient();
  const { data: order, error: orderError } = await serviceClient
    .from("orders")
    .insert({
      user_id: user.id,
      type: product.type,
      product_key: product.key,
      amount: product.amount,
      tokens_to_add: product.tokens,
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("[payments/create] Order creation failed:", orderError);
    return Response.json(
      { error: "Ошибка создания заказа" },
      { status: 500 }
    );
  }

  // 5. Создать платёж в ЮKassa
  try {
    const payment = await yookassa.createPayment(
      {
        amount: {
          value: product.amount.toFixed(2),
          currency: "RUB",
        },
        capture: true,
        ...(product.type === "subscription" ? { save_payment_method: true } : {}),
        confirmation: {
          type: "redirect",
          return_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://nice-guy-ai.vercel.app"}/balance?payment=complete&order=${order.id}`,
        },
        description: product.description,
        metadata: {
          order_id: order.id,
          user_id: user.id,
          product_key: product.key,
        },
        receipt: {
          customer: {
            email: user.email || undefined,
          },
          items: [
            {
              description: product.description,
              quantity: "1.00",
              amount: {
                value: product.amount.toFixed(2),
                currency: "RUB",
              },
              vat_code: 1,
              payment_subject: "service",
              payment_mode: "full_payment",
            },
          ],
        },
      },
      idempotencyKey
    );

    // 6. Обновить заказ
    await serviceClient
      .from("orders")
      .update({
        yookassa_payment_id: payment.id,
        yookassa_status: payment.status,
      })
      .eq("id", order.id);

    // 7. Вернуть URL
    const confirmationUrl = payment.confirmation?.confirmation_url;
    if (!confirmationUrl) {
      console.error("[payments/create] No confirmation_url:", payment);
      return Response.json(
        { error: "Не получен URL для оплаты" },
        { status: 500 }
      );
    }

    return Response.json({
      confirmation_url: confirmationUrl,
      order_id: order.id,
    });
  } catch (err) {
    console.error("[payments/create] YooKassa error:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
    await serviceClient.from("orders").delete().eq("id", order.id);
    return Response.json(
      { error: "Ошибка платёжной системы" },
      { status: 500 }
    );
  }
}
