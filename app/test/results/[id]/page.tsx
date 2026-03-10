import { createClient, createServiceClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  TestResultsPage,
  type TestResultsProps,
} from "@/components/test-results/TestResultsPage";

// UUID v4 regex
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) return { title: "Результат не найден" };

  const svc = createServiceClient();
  const { data } = await svc
    .from("test_results")
    .select("total_score, interpretation")
    .eq("id", id)
    .single();

  if (!data) return { title: "Результат не найден" };

  const score = data.total_score;
  const levelLabel =
    (data.interpretation as { level_label?: string } | null)?.level_label ??
    "Результаты теста";

  return {
    title: `ИССП ${score}/100 — ${levelLabel} | Nice Guy AI`,
    description: `Индекс синдрома славного парня: ${score}/100. Узнай свои паттерны и начни путь к изменениям.`,
    openGraph: {
      title: `Мой Индекс синдрома славного парня — ${score}/100`,
      description:
        "Узнай свои паттерны и начни путь к изменениям. Бесплатный тест по книге Роберта Гловера.",
      url: `https://nice-guy-ai.vercel.app/test/results/${id}`,
      type: "website",
    },
  };
}

export default async function TestResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Validate UUID format
  if (!UUID_RE.test(id)) notFound();

  // Fetch test result (bypass RLS — page is public by URL)
  const svc = createServiceClient();
  const { data: result } = await svc
    .from("test_results")
    .select(
      "id, user_id, program_id, total_score, scores_by_scale, top_scales, recommended_exercises, interpretation, created_at"
    )
    .eq("id", id)
    .single();

  if (!result) notFound();

  // Fetch program slug
  const { data: program } = await svc
    .from("programs")
    .select("slug")
    .eq("id", result.program_id)
    .single();

  const programSlug = program?.slug ?? "nice-guy";

  // Check ownership via cookie auth
  let isOwner = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && user.id === result.user_id) {
      isOwner = true;
    }
  } catch {
    // Not authenticated — public view
  }

  const props: TestResultsProps = {
    id: result.id,
    totalScore: result.total_score,
    scoresByScale: result.scores_by_scale as TestResultsProps["scoresByScale"],
    topScales: (result.top_scales as string[]) ?? [],
    recommendedExercises: (result.recommended_exercises as number[]) ?? [],
    interpretation:
      (result.interpretation as TestResultsProps["interpretation"]) ?? null,
    isOwner,
    createdAt: result.created_at,
    programSlug,
  };

  return <TestResultsPage {...props} />;
}
