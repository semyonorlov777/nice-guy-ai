import { streamText } from "ai";
import { google } from "@/lib/ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateTestScore } from "@/lib/test-scoring";
import { generateTestInterpretation } from "@/lib/test-interpretation";
import type { TestConfig } from "@/lib/test-config";
import { insertMessage } from "@/lib/queries/messages";
import { buildAnswer, extractScores, type TestState } from "@/lib/test-helpers";
import { createSSEResponse, streamToSSE } from "@/lib/test-sse";

export async function handleFinalTestAnswer({
  serviceClient,
  supabase,
  user,
  chatId,
  message,
  systemPrompt,
  programId,
  aiMessages,
  testState,
  testConfig,
}: {
  serviceClient: SupabaseClient;
  supabase: SupabaseClient;
  user: { id: string; email?: string };
  chatId: string;
  message: string;
  systemPrompt: string;
  programId: string;
  aiMessages: { role: "user" | "assistant"; content: string }[];
  testState: TestState;
  testConfig: TestConfig;
}): Promise<Response> {
  console.log(
    "[test:final] handleFinalTestAnswer: current_question =",
    testState.current_question,
    "answers.length =",
    testState.answers.length,
  );

  return createSSEResponse(async (send) => {
    // ── Phase 1: Gemini confirms the answer ──
    const phase1SystemPrompt =
      (systemPrompt || "")
        .replace(/<result_format>[\s\S]*?<\/result_format>/g, "")
        .replace(/<interpretations>[\s\S]*?<\/interpretations>/g, "")
        .replace(/<scoring>[\s\S]*?<\/scoring>/g, "")
        .replace(/<data_output>[\s\S]*?<\/data_output>/g, "") +
      "\n\nПодтверди получение ответа ОДНИМ коротким предложением. НЕ считай баллы. НЕ пиши интерпретацию.";

    const result1 = streamText({
      model: google("gemini-2.5-flash"),
      system: phase1SystemPrompt,
      messages: aiMessages,
    });

    const phase1Text = await streamToSSE(result1, send);

    // Extract score
    const { scores: scoresToRecord, source: scoreSource } = extractScores(
      message,
      phase1Text,
    );
    console.log(
      "[test:final] Scores:",
      scoresToRecord,
      "source:",
      scoreSource,
    );

    // Update test_state atomically via RPC
    let currentTestState = testState;
    for (const score of scoresToRecord) {
      if (currentTestState.current_question >= testConfig.total_questions) break;
      const answer = buildAnswer(
        score,
        currentTestState.current_question,
        message,
        testConfig.questions,
        testConfig.scoring.answer_range,
      );

      const { data: newState, error: rpcError } = await serviceClient.rpc(
        "append_test_answer",
        { p_chat_id: chatId, p_answer: answer },
      );

      if (rpcError) {
        console.error("[test:final] append_test_answer error:", rpcError);
        break;
      }
      currentTestState = newState as TestState;
    }

    if (currentTestState.answers.length < testConfig.total_questions) {
      console.warn(
        "[test:final] Expected",
        testConfig.total_questions,
        "answers but got",
        currentTestState.answers.length,
      );

      await insertMessage(supabase, {
        chatId,
        role: "assistant",
        content: phase1Text,
      });

      await supabase
        .from("chats")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", chatId);

      send({ type: "done" });
      return;
    }

    // ── Calculate scores ──
    currentTestState.status = "completed";
    const scoringResult = calculateTestScore(currentTestState.answers, testConfig);

    console.log(
      "[test:final] Scores calculated: totalScore =",
      scoringResult.totalScore,
      "topScales =",
      scoringResult.topScales,
    );

    // Save test_results (status=processing)
    const { data: insertData, error: insertError } = await serviceClient
      .from("test_results")
      .insert({
        user_id: user.id,
        program_id: programId,
        chat_id: chatId,
        test_slug: testConfig.slug,
        total_score: scoringResult.totalScore,
        total_raw: scoringResult.totalRaw,
        scores_by_scale: scoringResult.scoresByScale,
        answers: currentTestState.answers,
        recommended_exercises: scoringResult.recommendedExercises,
        top_scales: scoringResult.topScales,
        status: "processing",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[test:final] Failed to insert test_results:", insertError);
    }

    // Send test_complete signal IMMEDIATELY
    if (insertData?.id) {
      send({ type: "test_complete", result_id: insertData.id });
    }

    // Update chat status
    const { error: updateError } = await serviceClient
      .from("chats")
      .update({ test_state: currentTestState, status: "completed" })
      .eq("id", chatId);

    if (updateError) {
      console.error("[test:final] Failed to update chat status:", updateError);
    }

    // Generate interpretation (Gemini Pro, JSON)
    let interpretation = { level_label: "не определён" } as Awaited<ReturnType<typeof generateTestInterpretation>>;
    try {
      interpretation = await generateTestInterpretation(
        scoringResult.totalScore,
        scoringResult.scoresByScale,
        testConfig,
      );

      if (insertData?.id) {
        const { error: interpError } = await serviceClient
          .from("test_results")
          .update({ interpretation, status: "ready" })
          .eq("id", insertData.id);

        if (interpError) {
          console.error(
            "[test:final] Failed to save interpretation:",
            interpError,
          );
        }
      }
    } catch (interpErr) {
      console.error("[test:final] Interpretation generation failed:", interpErr);
      if (insertData?.id) {
        await serviceClient
          .from("test_results")
          .update({ status: "ready" })
          .eq("id", insertData.id);
      }
    }

    // ── Phase 2: Gemini writes short congratulation ──
    const phase2Messages = [
      ...aiMessages,
      { role: "assistant" as const, content: phase1Text },
      {
        role: "user" as const,
        content: `[СИСТЕМА] Тест завершён. Общий балл: ${scoringResult.totalScore}/100 (${interpretation.level_label}). Напиши короткое поздравление (2-3 предложения) и скажи что подробные результаты с визуализацией по ${testConfig.scales.length} шкалам доступны на странице результатов.`,
      },
    ];

    const result2 = streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt || undefined,
      messages: phase2Messages,
    });

    const phase2Text = await streamToSSE(result2, send);

    // Save combined message
    const combinedText = phase1Text + "\n\n" + phase2Text;
    await insertMessage(supabase, {
      chatId,
      role: "assistant",
      content: combinedText,
    });

    await supabase
      .from("chats")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", chatId);

    console.log("[test:final] Two-phase streaming completed for user:", user.id);

    send({ type: "done" });
  });
}
