import { createClient, createServiceClient } from "@/lib/supabase-server";
import { requireAuth, apiError } from "@/lib/api-helpers";
import { createRateLimit } from "@/lib/rate-limit";

// Per-user rate limit: 3 отвязки в минуту.
const checkRateLimit = createRateLimit({ windowMs: 60_000, max: 3 });

// Body не используется — действие определяется только по auth (user.id)
export async function POST() {
  const supabase = await createClient();

  const { user, response } = await requireAuth(supabase);
  if (response) return response;

  if (!checkRateLimit(user.id)) {
    return apiError("Слишком много запросов. Подожди минуту.", 429);
  }

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
