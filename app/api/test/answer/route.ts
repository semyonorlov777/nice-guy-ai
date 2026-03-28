import { after } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";
import { calculateTestScore } from "@/lib/test-scoring";
import { generateTestInterpretation } from "@/lib/test-interpretation";
import type { TestAnswer } from "@/lib/test-scoring";
import type { TestConfig } from "@/lib/test-config";
import { getTestConfig, getTestConfigByProgram } from "@/lib/queries/test-config";
import { createRateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-helpers";
import { insertMessage } from "@/lib/queries/messages";
import { UUID_RE, buildAnswerFromConfig, type TestState } from "@/lib/test-helpers";

// ── Rate limiting (anonymous only) ──

const checkRateLimit = createRateLimit();

export async function POST(request: Request) {
  const body = await request.json();
  const {
    chat_id: rawChatId,
    session_id: rawSessionId,
    question_index: questionIndex,
    score,
    program_slug: rawProgramSlug,
    test_slug: rawTestSlug,
  } = body;

  // ── Load test config: prefer test_slug (direct), fallback to program_slug ──
  let testConfig: TestConfig | null = null;
  if (typeof rawTestSlug === "string" && rawTestSlug) {
    testConfig = await getTestConfig(rawTestSlug);
  }
  if (!testConfig) {
    const programSlug: string = (typeof rawProgramSlug === "string" && rawProgramSlug) ? rawProgramSlug : DEFAULT_PROGRAM_SLUG;
    testConfig = await getTestConfigByProgram(programSlug);
  }
  if (!testConfig) {
    return apiError("test_config_not_found", 404);
  }

  const [minScore, maxScore] = testConfig.scoring.answer_range;
  const totalQuestions = testConfig.total_questions;
  const authWallQuestion = testConfig.ui_config.auth_wall_question;
  const questionsPerBlock = testConfig.ui_config.questions_per_block;

  // ── Validate score ──
  if (typeof score !== "number" || score < minScore || score > maxScore || !Number.isInteger(score)) {
    return apiError("invalid_score", 400);
  }
  if (typeof questionIndex !== "number" || questionIndex < 0 || questionIndex >= totalQuestions) {
    return apiError("invalid_question_index", 400);
  }

  // ── Auth: soft (works for both authenticated and anonymous) ──
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = !!user;
  const serviceClient = createServiceClient();

  // ── Mode-specific: load state ──
  let chatId: string | undefined;
  let sessionId: string | undefined;
  let testState: TestState;
  let session: {
    current_question: number;
    created_at: string;
    answers: TestAnswer[];
    status: string;
  } | null = null;
  let programId: string;
  let autoCreatedChatId: string | null = null;

  if (isAuthenticated) {
    // Determine chat_id
    if (rawChatId && UUID_RE.test(rawChatId)) {
      chatId = rawChatId;
    } else if (rawSessionId && UUID_RE.test(rawSessionId)) {
      // Auto-create chat for authenticated user with session_id
      const { data: program } = await serviceClient
        .from("programs")
        .select("id")
        .eq("id", testConfig.program_id)
        .single();

      if (!program) {
        return apiError("program_not_found", 404);
      }

      const { data: existingChat } = await serviceClient
        .from("chats")
        .select("id")
        .eq("user_id", user!.id)
        .eq("program_id", program.id)
        .eq("chat_type", "test")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (existingChat) {
        chatId = existingChat.id;
      } else {
        const { data: newChat, error: chatErr } = await serviceClient
          .from("chats")
          .insert({
            user_id: user!.id,
            program_id: program.id,
            chat_type: "test",
            status: "active",
            test_state: {
              current_question: 0,
              status: "in_progress",
              started_at: new Date().toISOString(),
              answers: [],
            },
          })
          .select("id")
          .single();

        if (chatErr || !newChat) {
          return apiError("chat_create_failed", 500);
        }

        chatId = newChat.id;
        autoCreatedChatId = newChat.id;
      }
    } else {
      return apiError("invalid_chat_id", 400);
    }

    // Load chat + test_state + program_id (with user_id ownership check)
    const { data: chat } = await serviceClient
      .from("chats")
      .select("id, test_state, user_id, program_id")
      .eq("id", chatId)
      .eq("user_id", user!.id)
      .single();

    if (!chat?.test_state) {
      return apiError("no_test_state", 404);
    }

    testState = chat.test_state as TestState;
    programId = chat.program_id;
  } else {
    // Anonymous mode
    sessionId = rawSessionId;
    if (!sessionId || !UUID_RE.test(sessionId)) {
      return apiError("invalid_session_id", 400);
    }

    // Rate limiting
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (!checkRateLimit(ip)) {
      return apiError("rate_limited", 429);
    }

    const { data: existingSession } = await serviceClient
      .from("test_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (!existingSession || existingSession.status !== "in_progress") {
      return apiError("session_not_found", 404);
    }

    session = existingSession;
    testState = {
      current_question: existingSession.current_question as number,
      status: "in_progress",
      started_at: existingSession.created_at as string,
      answers: (existingSession.answers || []) as TestAnswer[],
    };
    programId = ""; // not needed for anonymous (no test_results insert)
  }

  // Desync is now handled atomically inside RPC (FOR UPDATE lock + expected_question check)
  // for both authenticated and anonymous modes — no pre-RPC check needed.

  // ── Build answer ──
  const answer = buildAnswerFromConfig(score, questionIndex, String(score), testConfig);

  // ── Record answer ──
  if (isAuthenticated) {
    // Atomic append via RPC (with desync check)
    const { data: newState, error: rpcError } = await serviceClient.rpc(
      "append_test_answer",
      { p_chat_id: chatId, p_answer: answer, p_expected_question: questionIndex }
    );

    if (rpcError) {
      console.error("[test:answer] append_test_answer error:", rpcError);
      return apiError("rpc_error", 500);
    }

    // RPC returns question_mismatch instead of throwing — handle as 409
    if (newState?.error === "question_mismatch") {
      const extra: Record<string, unknown> = {
        server_question: newState.server_question,
      };

      // If test already complete, include result info
      if (newState.server_question >= totalQuestions || newState.answers_count >= totalQuestions) {
        const { data: existingResult } = await serviceClient
          .from("test_results")
          .select("id, status")
          .eq("chat_id", chatId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        extra.test_complete = true;
        extra.result_id = existingResult?.id || null;
        extra.result_ready = existingResult?.status === "ready";
      }

      return apiError("question_mismatch", 409, extra);
    }

    const updatedState = newState as TestState;

    // Save user message (no assistant message — user never sees the score)
    await insertMessage(serviceClient, {
      chatId: chatId!,
      role: "user",
      content: String(score),
    });

    await supabase
      .from("chats")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", chatId);

    const answersCount = updatedState.answers.length;
    const nextQuestion = updatedState.current_question;

    // ═══ TEST COMPLETE ═══
    if (answersCount >= totalQuestions) {
      console.log("[test-answer] Test complete detected, answers count:", answersCount);
      const testResult_ = calculateTestScore(updatedState.answers, testConfig);

      const { data: testResult, error: insertError } = await serviceClient
        .from("test_results")
        .insert({
          user_id: user!.id,
          program_id: programId,
          chat_id: chatId,
          test_slug: testConfig.slug,
          total_score: testResult_.totalScore,
          total_raw: testResult_.totalRaw,
          scores_by_scale: testResult_.scoresByScale,
          answers: updatedState.answers,
          recommended_exercises: testResult_.recommendedExercises,
          top_scales: testResult_.topScales,
          status: "processing",
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[test-answer] INSERT test_results failed:", insertError);
        return Response.json(
          { success: false, error: "Failed to save test results" },
          { status: 500 }
        );
      }

      console.log("[test-answer] INSERT result id:", testResult.id);

      // Update chat status
      await serviceClient
        .from("chats")
        .update({
          test_state: { ...updatedState, status: "completed" },
          status: "completed",
        })
        .eq("id", chatId);

      // Generate interpretation in background via after()
      const resultId = testResult.id;
      after(async () => {
        try {
          console.log("[test-answer] after() starting interpretation for:", resultId);
          const interpretation = await generateTestInterpretation(
            testResult_.totalScore,
            testResult_.scoresByScale,
            testConfig
          );
          const { error: updateError } = await serviceClient
            .from("test_results")
            .update({ interpretation, status: "ready" })
            .eq("id", resultId);
          if (updateError) {
            console.error("[test-answer] UPDATE interpretation failed:", updateError);
          } else {
            console.log("[test-answer] Interpretation saved for result:", resultId);
          }
        } catch (err) {
          console.error("[test-answer] Interpretation generation failed:", err);
          await serviceClient
            .from("test_results")
            .update({ status: "ready" })
            .eq("id", resultId);
        }
      });

      return Response.json({
        success: true,
        next_question: nextQuestion,
        test_complete: true,
        calculating: true,
        chat_id: autoCreatedChatId || chatId,
      });
    }

    // ═══ BLOCK BOUNDARY ═══
    const blockComplete = questionsPerBlock > 0 && answersCount % questionsPerBlock === 0 && answersCount < totalQuestions;

    return Response.json({
      success: true,
      next_question: nextQuestion,
      score,
      block_complete: blockComplete || undefined,
      chat_id: autoCreatedChatId || chatId,
    });
  } else {
    // ═══ ANONYMOUS MODE — atomic via RPC ═══
    const { data: rpcResult, error: rpcError } = await serviceClient.rpc(
      "append_anonymous_test_answer",
      {
        p_session_id: sessionId,
        p_answer: answer,
        p_expected_question: questionIndex,
      }
    );

    if (rpcError) {
      console.error("[test:answer] append_anonymous_test_answer error:", rpcError);
      return apiError("rpc_error", 500);
    }

    // RPC returns question_mismatch instead of throwing — handle as 409
    if (rpcResult?.error === "question_mismatch") {
      return apiError("question_mismatch", 409, {
        server_question: rpcResult.server_question,
      });
    }

    const answersCount = rpcResult.answers_count as number;
    const nextQuestion = rpcResult.current_question as number;

    // AUTH WALL for anonymous
    if (authWallQuestion !== null && answersCount >= authWallQuestion) {
      return Response.json({
        success: true,
        requires_auth: true,
        next_question: nextQuestion,
      });
    }

    // Block boundary
    const blockComplete = questionsPerBlock > 0 && answersCount % questionsPerBlock === 0 && answersCount < totalQuestions;

    return Response.json({
      success: true,
      next_question: nextQuestion,
      score,
      block_complete: blockComplete || undefined,
    });
  }
}
