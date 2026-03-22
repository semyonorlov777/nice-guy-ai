import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getProgramModes, getLastActiveMode } from "@/lib/queries/modes";
import { HubScreen } from "@/components/hub/HubScreen";
import { getThemesOrdered, ISSP_THEMES } from "@/lib/hub-data";
import type { HubState } from "@/lib/hub-data";

export default async function HubPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: program } = await supabase
    .from("programs")
    .select("id, title, landing_data")
    .eq("slug", slug)
    .single();

  if (!program) redirect("/");

  const landingData = program.landing_data as Record<string, unknown> | null;
  const authorName =
    (landingData?.author as Record<string, unknown>)?.name as string ?? "";
  const coverUrl =
    (landingData?.book as Record<string, unknown>)?.cover_url as string ?? null;

  // Parallel data fetching
  const [
    { count: exerciseCount },
    modes,
    lastActive,
    { data: testResult },
    { count: chatCount },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("exercises")
      .select("id", { count: "exact", head: true })
      .eq("program_id", program.id),
    getProgramModes(supabase, program.id),
    getLastActiveMode(supabase, user.id, program.id),
    supabase
      .from("test_results")
      .select("scores_by_scale")
      .eq("user_id", user.id)
      .eq("program_id", program.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("chats")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("program_id", program.id)
      .in("status", ["active", "completed"]),
    supabase
      .from("profiles")
      .select("balance_tokens")
      .eq("id", user.id)
      .single(),
  ]);

  // Determine hub state
  const hasTestResult = !!testResult;
  const isFirstVisit = (chatCount ?? 0) === 0 && !hasTestResult;
  let state: HubState = isFirstVisit
    ? "first"
    : hasTestResult
      ? "returning-test"
      : "returning-notest";

  // Override via query param (works in all environments)
  const override = query.hub_state;
  if (override === "first" || override === "returning-test" || override === "returning-notest") {
    state = override;
  }

  // Sort themes by test scores
  const testScores = testResult?.scores_by_scale as Record<string, number> | null;
  const themes = getThemesOrdered(testScores);

  // Top 2 scales are recommended
  const recommendedKeys = hasTestResult ? themes.slice(0, 2).map((t) => t.key) : [];

  // TODO: determine engaged keys from chat data (future)
  const engagedKeys: string[] = [];

  return (
    <HubScreen
      state={state}
      modes={modes}
      lastActive={lastActive}
      program={{
        title: program.title,
        author: authorName,
        coverUrl,
        slug,
        exerciseCount: exerciseCount ?? undefined,
      }}
      themes={themes}
      engagedKeys={engagedKeys}
      recommendedKeys={recommendedKeys}
      hasTestResult={hasTestResult}
      balance={profile?.balance_tokens ?? 0}
    />
  );
}
