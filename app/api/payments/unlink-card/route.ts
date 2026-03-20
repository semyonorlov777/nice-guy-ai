import { createClient, createServiceClient } from "@/lib/supabase-server";
import { requireAuth } from "@/lib/api-helpers";

// Body не используется — действие определяется только по auth (user.id)
export async function POST() {
  const supabase = await createClient();

  const { user, response } = await requireAuth(supabase);
  if (response) return response;

  const serviceClient = createServiceClient();
  await serviceClient
    .from("profiles")
    .update({
      subscription_payment_method_id: null,
      card_last4: null,
    })
    .eq("id", user.id);

  return Response.json({ success: true });
}
