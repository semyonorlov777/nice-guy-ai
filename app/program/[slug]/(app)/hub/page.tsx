import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getProgramModes, getLastActiveMode } from "@/lib/queries/modes";
import { HubScreen } from "@/components/hub/HubScreen";
import { getProgramThemes, getThemesOrdered } from "@/lib/queries/themes";

type HubState = "first" | "returning-test" | "returning-notest";

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
    .select("id, title, landing_data, hub_messages")
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
    themes,
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
    getProgramThemes(supabase, program.id),
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
  const orderedThemes = getThemesOrdered(themes, testScores);

  // Top 2 scales are recommended
  const recommendedKeys = hasTestResult ? orderedThemes.slice(0, 2).map((t) => t.key) : [];

  // TODO: determine engaged keys from chat data (future)
  const engagedKeys: string[] = [];

  // Resolve AI message from hub_messages with {theme1}/{theme2} placeholders
  const hubMessages = (program.hub_messages as Record<string, string>) ?? {};
  const stateKey = state.replace("-", "_"); // "returning-test" → "returning_test"
  let aiMessage = hubMessages[stateKey] ?? "";
  if (state === "returning-test" && orderedThemes.length >= 2) {
    aiMessage = aiMessage
      .replace("{theme1}", orderedThemes[0].title.toLowerCase())
      .replace("{theme2}", orderedThemes[1].title.toLowerCase());
  }

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
      themes={orderedThemes}
      engagedKeys={engagedKeys}
      recommendedKeys={recommendedKeys}
      hasTestResult={hasTestResult}
      balance={profile?.balance_tokens ?? 0}
      aiMessage={aiMessage}
    />
  );
}
