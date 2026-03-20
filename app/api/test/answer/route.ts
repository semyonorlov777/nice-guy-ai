import { after } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { calculateISSP } from "@/lib/issp-scoring";
import { generateInterpretation } from "@/lib/issp-interpretation";
import { ISSP_QUESTIONS } from "@/lib/issp-config";
import type { TestAnswer } from "@/lib/issp-scoring";

export const maxDuration = 30;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TestState = {
  current_question: number;
  status: string;
  started_at: string;
  answers: TestAnswer[];
};

function buildAnswer(
  score: number,
  questionIdx: number,
  message: string
): TestAnswer {
  const question = ISSP_QUESTIONS[questionIdx];
  return {
    q: question.q,
    scale: question.scale,
    type: question.type,
    rawAnswer: score,
    score: question.type === "reverse" ? 6 - score : score,
    text: /^\d$/.test(message.trim()) ? undefined : message,
  };
}

// ── Rate limiting (anonymous only) ──

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 30;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    chat_id: rawChatId,
    session_id: rawSessionId,
    question_index: questionIndex,
    score,
  } = body;

  // ── Validate score ──
  if (typeof score !== "number" || score < 1 || score > 5 || !Number.isInteger(score)) {
    return Response.json({ error: "invalid_score" }, { status: 400 });
  }
  if (typeof questionIndex !== "number" || questionIndex < 0 || questionIndex > 34) {
    return Response.json({ error: "invalid_question_index" }, { status: 400 });
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let session: any = null;
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
        .eq("slug", "nice-guy")
        .single();

      if (!program) {
        return Response.json({ error: "program_not_found" }, { status: 404 });
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
          return Response.json({ error: "chat_create_failed" }, { status: 500 });
        }

        chatId = newChat.id;
        autoCreatedChatId = newChat.id;
      }
    } else {
      return Response.json({ error: "invalid_chat_id" }, { status: 400 });
    }

    // Load chat + test_state + program_id (with user_id ownership check)
    const { data: chat } = await serviceClient
      .from("chats")
      .select("id, test_state, user_id, program_id")
      .eq("id", chatId)
      .eq("user_id", user!.id)
      .single();

    if (!chat?.test_state) {
      return Response.json({ error: "no_test_state" }, { status: 404 });
    }

    testState = chat.test_state as TestState;
    programId = chat.program_id;
  } else {
    // Anonymous mode
    sessionId = rawSessionId;
    if (!sessionId || !UUID_RE.test(sessionId)) {
      return Response.json({ error: "invalid_session_id" }, { status: 400 });
    }

    // Rate limiting
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (!checkRateLimit(ip)) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }

    const { data: existingSession } = await serviceClient
      .from("test_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (!existingSession || existingSession.status !== "in_progress") {
      return Response.json({ error: "session_not_found" }, { status: 404 });
    }

    session = existingSession;
    testState = {
      current_question: session.current_question,
      status: "in_progress",
      started_at: session.created_at,
      answers: session.answers || [],
    };
    programId = ""; // not needed for anonymous (no test_results insert)
  }

  // ── Desync check (authenticated only) ──
  // Anonymous mode: RPC append_anonymous_test_answer handles desync atomically under FOR UPDATE lock.
  // Pre-RPC check would use stale data and cause false 409s on fast clicks.
  if (isAuthenticated && questionIndex !== testState.current_question) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responseData: any = {
      error: "question_mismatch",
      server_question: testState.current_question,
    };

    if (testState.current_question >= 35) {
      const { data: existingResult } = await serviceClient
        .from("test_results")
        .select("id, status")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      responseData.test_complete = true;
      responseData.result_id = existingResult?.id || null;
      responseData.result_ready = existingResult?.status === "ready";
    }

    return Response.json(responseData, { status: 409 });
  }

  // ── Build answer ──
  const answer = buildAnswer(score, questionIndex, String(score));

  // ── Record answer ──
  if (isAuthenticated) {
    // Atomic append via RPC
    const { data: newState, error: rpcError } = await serviceClient.rpc(
      "append_test_answer",
      { p_chat_id: chatId, p_answer: answer }
    );

    if (rpcError) {
      console.error("[test:answer] append_test_answer error:", rpcError);
      return Response.json({ error: "rpc_error" }, { status: 500 });
    }

    const updatedState = newState as TestState;

    // Save user message (no assistant message — user never sees the score)
    await serviceClient.from("messages").insert({
      chat_id: chatId,
      role: "user",
      content: String(score),
      tokens_used: 0,
    });

    await supabase
      .from("chats")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", chatId);

    const answersCount = updatedState.answers.length;
    const nextQuestion = updatedState.current_question;

    // ═══ Q35: TEST COMPLETE ═══
    if (answersCount >= 35) {
      console.log("[test-answer] Q35 detected, answers count:", answersCount);
      const isspResult = calculateISSP(updatedState.answers);

      const { data: testResult, error: insertError } = await serviceClient
        .from("test_results")
        .insert({
          user_id: user!.id,
          program_id: programId,
          chat_id: chatId,
          total_score: isspResult.totalScore,
          total_raw: isspResult.totalRaw,
          scores_by_scale: isspResult.scoresByScale,
          answers: updatedState.answers,
          recommended_exercises: isspResult.recommendedExercises,
          top_scales: isspResult.topScales,
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
          const interpretation = await generateInterpretation(
            isspResult.totalScore,
            isspResult.scoresByScale
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

    // ═══ BLOCK BOUNDARY (every 5 questions) ═══
    const blockComplete = answersCount % 5 === 0 && answersCount < 35;

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
      return Response.json({ error: "rpc_error" }, { status: 500 });
    }

    // RPC returns question_mismatch instead of throwing — handle as 409
    if (rpcResult?.error === "question_mismatch") {
      return Response.json(
        {
          error: "question_mismatch",
          server_question: rpcResult.server_question,
        },
        { status: 409 }
      );
    }

    const answersCount = rpcResult.answers_count as number;
    const nextQuestion = rpcResult.current_question as number;

    // AUTH WALL at Q34 for anonymous
    if (answersCount >= 34) {
      return Response.json({
        success: true,
        requires_auth: true,
        next_question: nextQuestion,
      });
    }

    // Block boundary
    const blockComplete = answersCount % 5 === 0 && answersCount < 35;

    return Response.json({
      success: true,
      next_question: nextQuestion,
      score,
      block_complete: blockComplete || undefined,
    });
  }
}
