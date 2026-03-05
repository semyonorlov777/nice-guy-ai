import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { BalanceClient } from "@/components/BalanceClient";
import { PublicHeader } from "@/components/PublicHeader";

export default async function BalancePage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; order?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("balance_tokens")
    .eq("id", user.id)
    .single();

  const balance = profile?.balance_tokens ?? 0;

  // Payment history
  const { data: payments } = await supabase
    .from("payments")
    .select("id, created_at, amount, tokens_added, yookassa_id, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const params = await searchParams;

  return (
    <>
      <PublicHeader />
      <div style={{ paddingTop: 56 }}>
        <BalanceClient
          balance={balance}
          payments={payments ?? []}
          paymentComplete={params.payment === "complete"}
          orderId={params.order}
        />
      </div>
    </>
  );
}
