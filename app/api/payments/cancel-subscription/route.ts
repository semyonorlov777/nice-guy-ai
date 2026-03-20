import { createClient, createServiceClient } from "@/lib/supabase-server";

// Body не используется — действие определяется только по auth (user.id)
export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Не авторизован" }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  await serviceClient
    .from("profiles")
    .update({
      subscription_plan: null,
      subscription_payment_method_id: null,
      card_last4: null,
    })
    .eq("id", user.id);

  return Response.json({ success: true });
}
