import { createClient, createServiceClient } from "@/lib/supabase-server";
import { DEFAULT_PROGRAM_SLUG, APP_URL } from "@/lib/constants";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  TestResultsPage,
  type TestResultsProps,
} from "@/components/test-results/TestResultsPage";
import { getTestConfigByProgram } from "@/lib/queries/test-config";
import { getScaleOrder, getScaleNames } from "@/lib/test-config";
import { normalizeInterpretation } from "@/lib/test-interpretation";

// Запись test_results создаётся асинхронно (after() + Gemini ~30 сек).
// Первый запрос после теста может получить null → notFound() → 404.
// Без force-dynamic Vercel edge кэширует 404 по URL и продолжает отдавать
// его даже после того, как запись стала ready.
export const dynamic = "force-dynamic";

// UUID v4 regex
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) return { title: "Результат не найден" };

  const svc = createServiceClient();
  const { data } = await svc
    .from("test_results")
    .select(
      "total_score, interpretation, programs!inner(slug, landing_data)"
    )
    .eq("id", id)
    .single();

  if (!data) return { title: "Результат не найден" };

  const rawProgram = (
    data as unknown as {
      programs:
        | { slug: string; landing_data: unknown }
        | { slug: string; landing_data: unknown }[]
        | null;
    }
  ).programs;
  const program = Array.isArray(rawProgram) ? rawProgram[0] : rawProgram;
  const programSlug = program?.slug ?? DEFAULT_PROGRAM_SLUG;
  const landingData = program?.landing_data as
    | { test?: { title?: string } }
    | null;
  const testTitle = landingData?.test?.title ?? "Результат теста";

  const score = data.total_score;
  const levelLabel =
    (data.interpretation as { level_label?: string } | null)?.level_label ??
    "Результаты теста";

  return {
    title: `${testTitle} — ${score}/100 — ${levelLabel}`,
    description: `${testTitle}: ${score}/100. Узнай свои паттерны и сильные стороны.`,
    openGraph: {
      title: `Мой результат: ${testTitle} — ${score}/100`,
      description: `${testTitle}. Бесплатный тест на платформе.`,
      url: `${APP_URL}/program/${programSlug}/test/results/${id}`,
      type: "website",
    },
  };
}

export default async function TestResultPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { id } = await params;

  // Validate UUID format
  if (!UUID_RE.test(id)) notFound();

  // Один запрос вместо двух sequential: test_results + programs через !inner-join.
  // Bypass RLS — страница публична по URL (UUID unguessable).
  const svc = createServiceClient();
  const { data: result } = await svc
    .from("test_results")
    .select(
      "id, user_id, program_id, total_score, scores_by_scale, top_scales, recommended_exercises, interpretation, created_at, programs!inner(slug, landing_data)"
    )
    .eq("id", id)
    .single();

  if (!result) notFound();

  const rawProgram = (
    result as unknown as {
      programs:
        | { slug: string; landing_data: unknown }
        | { slug: string; landing_data: unknown }[]
        | null;
    }
  ).programs;
  const program = Array.isArray(rawProgram) ? rawProgram[0] : rawProgram;

  const programSlug = program?.slug ?? DEFAULT_PROGRAM_SLUG;
  const landingData = program?.landing_data as { test?: { title?: string } } | null;
  const testTitle = landingData?.test?.title;

  // Параллельно: test config + auth-check. Оба независимы от data выше.
  const [testConfig, ownerCheck] = await Promise.all([
    getTestConfigByProgram(programSlug),
    (async () => {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        return user?.id === result.user_id;
      } catch {
        return false;
      }
    })(),
  ]);
  const isOwner = ownerCheck;

  // Derive scale metadata from testConfig (or use empty defaults)
  const scaleOrder = testConfig ? getScaleOrder(testConfig) : [];
  const scaleNameMap = testConfig ? getScaleNames(testConfig) : {};
  const scaleExercises: Record<string, number[]> = {};
  const radarLabels: Record<string, string[]> = {};
  if (testConfig) {
    for (const s of testConfig.scales) {
      if (s.exercises) {
        // mind-power и др. навыковые тесты используют slug режимов (строки) — для UI с
        // карточками упражнений оставляем только числовые номера.
        scaleExercises[s.key] = s.exercises.filter(
          (e): e is number => typeof e === "number"
        );
      }
      // radar_label может приходить строкой с \n (mind-power) — нормализуем в массив.
      const rl = s.radar_label;
      if (Array.isArray(rl)) {
        radarLabels[s.key] = rl;
      } else if (typeof rl === "string") {
        const parts = rl
          .split(/\r?\n/)
          .map((x) => x.trim())
          .filter(Boolean);
        radarLabels[s.key] = parts.length > 0 ? parts : [s.name];
      } else {
        radarLabels[s.key] = [s.name];
      }
    }
  }

  const props: TestResultsProps = {
    id: result.id,
    totalScore: result.total_score,
    scoresByScale: result.scores_by_scale as TestResultsProps["scoresByScale"],
    topScales: (result.top_scales as string[]) ?? [],
    recommendedExercises: (result.recommended_exercises as TestResultsProps["recommendedExercises"]) ?? [],
    interpretation: normalizeInterpretation(
      result.interpretation as TestResultsProps["interpretation"],
      scaleNameMap
    ),
    isOwner,
    createdAt: result.created_at,
    programSlug,
    testTitle,
    scaleOrder,
    scaleNames: scaleNameMap,
    scaleExercises,
    radarLabels,
    heroSubtitle: testConfig
      ? `${testConfig.total_questions} вопросов \u2022 ${testConfig.scales.length} шкал`
      : undefined,
    ctaText: undefined,
    testSlug: testConfig?.slug,
    scoreDirection: testConfig?.scoring.score_direction,
    levelLabels: testConfig?.scoring.level_labels,
    levelThresholds: testConfig?.scoring.level_thresholds,
  };

  return <TestResultsPage {...props} />;
}
