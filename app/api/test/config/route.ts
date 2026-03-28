import { getTestConfigByProgram } from "@/lib/queries/test-config";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";
import { getScaleNames } from "@/lib/test-config";
import { apiError } from "@/lib/api-helpers";

/**
 * GET /api/test/config — return questions + scaleNames for the default program test.
 * Used by the debug page (client-side) to load test data dynamically.
 */
export async function GET() {
  const testConfig = await getTestConfigByProgram(DEFAULT_PROGRAM_SLUG);

  if (!testConfig) {
    return apiError("Конфигурация теста не найдена", 404);
  }

  return Response.json({
    slug: testConfig.slug,
    title: testConfig.title,
    totalQuestions: testConfig.total_questions,
    questions: testConfig.questions,
    scaleNames: getScaleNames(testConfig),
  });
}
