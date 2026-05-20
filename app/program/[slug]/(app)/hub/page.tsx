import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getProgramModes, getLastActiveMode } from "@/lib/queries/modes";
import { HubScreen } from "@/components/hub/HubScreen";
import { getProgramThemes, getThemesOrdered } from "@/lib/queries/themes";
import { getFacts } from "@/lib/personalization";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";
import { isAnketaEmpty } from "@/lib/anketa/questions";
import { getRelevantThemeKeys } from "@/lib/anketa/theme-relevance";

type HubState =
  | "first"
  | "returning-test"
  | "returning-notest"
  | "anketa-only"
  | "anketa-and-test";

function truncatePhrase(text: string, max = 60): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + "…";
}

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

  // Параллельно: auth + programs (по slug). Независимы.
  const [
    {
      data: { user },
    },
    { data: program },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("programs")
      .select("id, title, landing_data, hub_messages")
      .eq("slug", slug)
      .single(),
  ]);

  if (!user) redirect("/auth");
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
    facts,
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
    getFacts(supabase, user.id),
  ]);

  const anketaEmpty = slug === DEFAULT_PROGRAM_SLUG && isAnketaEmpty(facts);

  // Первый заход в программу с пустой анкетой → редирект на /api/anketa/offer,
  // который set'нет cookie и сразу редиректнет на /anketa. Server Component
  // не может писать cookies сам.
  if (anketaEmpty) {
    const cookieStore = await cookies();
    const offeredKey = `anketa_offered_${slug}`;
    if (cookieStore.get(offeredKey)?.value !== "1") {
      redirect(`/api/anketa/offer?slug=${slug}`);
    }
  }

  const showAnketaCta = anketaEmpty;

  // Determine hub state
  const hasTestResult = !!testResult;
  const hasAnketaFacts = Object.keys(facts).length > 0;
  const isFirstVisit =
    (chatCount ?? 0) === 0 && !hasTestResult && !hasAnketaFacts;

  let state: HubState;
  if (isFirstVisit) {
    state = "first";
  } else if (hasAnketaFacts && hasTestResult) {
    state = "anketa-and-test";
  } else if (hasAnketaFacts) {
    state = "anketa-only";
  } else if (hasTestResult) {
    state = "returning-test";
  } else {
    state = "returning-notest";
  }

  // Override via query param (works in all environments)
  const override = query.hub_state;
  if (
    override === "first" ||
    override === "returning-test" ||
    override === "returning-notest" ||
    override === "anketa-only" ||
    override === "anketa-and-test"
  ) {
    state = override;
  }

  // Анкета фильтрует ЧТО релевантно (запрос пользователя — точка Б),
  // тест упорядочивает В КАКОМ ПОРЯДКЕ давать (диагностика — точка А).
  // Анкеты нет → все темы релевантны; теста нет → фильтр-порядок остаётся.
  const relevantKeys = await getRelevantThemeKeys(
    supabase,
    user.id,
    program.id,
    facts,
    themes,
  );

  const testScores = testResult?.scores_by_scale as Record<string, number> | null;
  const filteredThemes = themes.filter((t) => relevantKeys.includes(t.key));
  const themesToOrder = filteredThemes.length > 0 ? filteredThemes : themes;

  let orderedThemes: typeof themes;
  if (testScores) {
    orderedThemes = getThemesOrdered(themesToOrder, testScores);
  } else if (filteredThemes.length > 0) {
    const keyOrder = new Map(relevantKeys.map((k, i) => [k, i]));
    orderedThemes = [...themesToOrder].sort(
      (a, b) =>
        (keyOrder.get(a.key) ?? Infinity) - (keyOrder.get(b.key) ?? Infinity),
    );
  } else {
    orderedThemes = themesToOrder;
  }

  // Top 2 — рекомендованные (есть и тест, и анкета → дают рекомендацию;
  // нет ничего → не подсвечиваем).
  const hasAnketa = Object.keys(facts).length > 0;
  const recommendedKeys =
    hasTestResult || hasAnketa ? orderedThemes.slice(0, 2).map((t) => t.key) : [];

  // TODO: determine engaged keys from chat data (future)
  const engagedKeys: string[] = [];

  // Resolve AI message from hub_messages with {theme1}/{theme2}/{problem}/{context_intent}.
  const hubMessages = (program.hub_messages as Record<string, string>) ?? {};
  const stateKey = state.replace(/-/g, "_");
  let aiMessage = hubMessages[stateKey] ?? "";

  if (orderedThemes.length >= 1) {
    aiMessage = aiMessage.replace(
      "{theme1}",
      orderedThemes[0].title.toLowerCase(),
    );
  }
  if (orderedThemes.length >= 2) {
    aiMessage = aiMessage.replace(
      "{theme2}",
      orderedThemes[1].title.toLowerCase(),
    );
  }
  if (facts.problem) {
    aiMessage = aiMessage.replace("{problem}", truncatePhrase(facts.problem));
  }
  if (facts.context_intent) {
    aiMessage = aiMessage.replace(
      "{context_intent}",
      truncatePhrase(facts.context_intent),
    );
  }

  // Если остались неразрешённые плейсхолдеры — чистим и падаем в fallback.
  if (/\{(theme\d+|problem|context_intent)\}/.test(aiMessage)) {
    aiMessage = aiMessage
      .replace(/\{(theme\d+|problem|context_intent)\}/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!aiMessage) aiMessage = hubMessages["returning_notest"] ?? "";
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
      showAnketaCta={showAnketaCta}
    />
  );
}
