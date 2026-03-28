import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateTestScore } from "@/lib/test-scoring";
import { generateTestInterpretation } from "@/lib/test-interpretation";
import type { TestConfig } from "@/lib/test-config";
import type { TestState } from "@/lib/test-helpers";

/**
 * Background task: calculate test scores, insert test_results,
 * update chat status, generate interpretation.
 *
 * Used by both test/route.ts (typed quick answers) and test/answer/route.ts.
 */
export async function calculateAndSaveResult({
  serviceClient,
  user,
  chatId,
  programId,
  testState,
  testConfig,
}: {
  serviceClient: SupabaseClient;
  user: { id: string };
  chatId: string;
  programId: string;
  testState: TestState;
  testConfig: TestConfig;
}): Promise<void> {
  try {
    // Step 1: Calculate scores
    console.log("[test:bg] Step 1: calculateTestScore, answers:", testState.answers.length);
    const testResult = calculateTestScore(testState.answers, testConfig);
    console.log("[test:bg] Step 1 done. Score:", testResult.totalScore, "topScales:", testResult.topScales);

    // Step 2: Insert test_results with status='processing'
    console.log("[test:bg] Step 2: INSERT test_results (status=processing)");
    const { data: insertData, error: insertError } = await serviceClient
      .from("test_results")
      .insert({
        user_id: user.id,
        program_id: programId,
        chat_id: chatId,
        test_slug: testConfig.slug,
        total_score: testResult.totalScore,
        total_raw: testResult.totalRaw,
        scores_by_scale: testResult.scoresByScale,
        answers: testState.answers,
        recommended_exercises: testResult.recommendedExercises,
        top_scales: testResult.topScales,
        status: "processing",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[test:bg] Step 2 FAILED: insert test_results error:", insertError);
      return;
    }
    const resultId = insertData!.id;
    console.log("[test:bg] Step 2 done. result_id:", resultId);

    // Step 3: Update chat status to completed
    console.log("[test:bg] Step 3: UPDATE chat status to completed");
    testState.status = "completed";
    await serviceClient
      .from("chats")
      .update({ test_state: testState, status: "completed" })
      .eq("id", chatId);
    console.log("[test:bg] Step 3 done.");

    // Step 4: Generate interpretation (slow, 20-30s)
    console.log("[test:bg] Step 4: generateTestInterpretation (slow)");
    try {
      const interpretation = await generateTestInterpretation(
        testResult.totalScore,
        testResult.scoresByScale,
        testConfig,
      );
      console.log("[test:bg] Step 4 done. Updating interpretation + status=ready...");

      await serviceClient
        .from("test_results")
        .update({ interpretation, status: "ready" })
        .eq("id", resultId);
      console.log("[test:bg] Interpretation saved for result:", resultId);
    } catch (interpErr) {
      console.error("[test:bg] Step 4 FAILED: generateTestInterpretation error:", interpErr);
      // Still mark as ready so user isn't stuck
      await serviceClient
        .from("test_results")
        .update({ status: "ready" })
        .eq("id", resultId);
      console.log("[test:bg] Marked as ready (without interpretation) for result:", resultId);
    }
  } catch (err) {
    console.error("[test:bg] calculateAndSaveResult FAILED:", err);
  }
}
