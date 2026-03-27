import { NextResponse } from "next/server";
import { getTestConfigByProgram } from "@/lib/queries/test-config";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";
import { getScaleNames } from "@/lib/test-config";

/**
 * GET /api/test/config — return questions + scaleNames for the default program test.
 * Used by the debug page (client-side) to load test data dynamically.
 */
export async function GET() {
  const testConfig = await getTestConfigByProgram(DEFAULT_PROGRAM_SLUG);

  if (!testConfig) {
    return NextResponse.json(
      { error: "Test config not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    slug: testConfig.slug,
    title: testConfig.title,
    totalQuestions: testConfig.total_questions,
    questions: testConfig.questions,
    scaleNames: getScaleNames(testConfig),
  });
}
