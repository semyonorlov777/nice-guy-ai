import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { BalanceClient } from "@/components/BalanceClient";
import { PublicHeader } from "@/components/PublicHeader";

export default async function BalancePage() {
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

  // Payment history (table may not exist yet)
  const { data: payments } = await supabase
    .from("payments")
    .select("id, created_at, amount, tokens, type, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <>
      <PublicHeader />
      <div style={{ paddingTop: 56 }}>
        <BalanceClient balance={balance} payments={payments ?? []} />
      </div>
    </>
  );
}
