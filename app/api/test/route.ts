import * as Sentry from "@sentry/nextjs";
import { streamText, generateText } from "ai";
import { google } from "@/lib/ai";
import { after } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import {
  parseAIResponse,
  extractScoreFromUserMessage,
} from "@/lib/test-parser";
import { calculateTestScore } from "@/lib/test-scoring";
import { generateTestInterpretation } from "@/lib/test-interpretation";
import { buildMiniPrompt } from "@/lib/test-mini-prompt";
import type { TestAnswer } from "@/lib/test-scoring";
import type { TestConfig, TestQuestion } from "@/lib/test-config";
import { getTestConfig, getTestConfigByProgram } from "@/lib/queries/test-config";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";
import { createRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

// ── Rate limiting (anonymous only) ──

const checkRateLimit = createRateLimit();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Types ──

type TestState = {
  current_question: number;
  status: string;
  started_at: string;
  answers: TestAnswer[];
};

interface TestSession {
  id: string;
  session_id: string;
  test_slug: string;
  status: string;
  current_question: number;
  answers: TestAnswer[];
  messages: Array<{ role: string; content: string }>;
  created_at: string;
  updated_at: string;
}

// ── SSE helpers ──

function createSSEResponse(
  handler: (send: (data: object) => void) => Promise<void>
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        await handler(send);
      } catch (err) {
        Sentry.captureException(err, {
          tags: { route: "api/test", phase: "sse-handler" },
        });
        console.error("[test] SSE handler error:", err);
        send({ type: "error", message: "Ошибка генерации ответа" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function streamToSSE(
  result: ReturnType<typeof streamText>,
  send: (data: object) => void
): Promise<string> {
  let fullText = "";
  for await (const chunk of result.textStream) {
    fullText += chunk;
    send({ type: "delta", content: chunk });
  }
  return fullText;
}

// ── Score extraction (shared logic from chat/route.ts) ──

function extractScores(
  message: string,
  aiText: string
): { scores: number[]; source: string } {
  const userScore = extractScoreFromUserMessage(message);
  const parsed = parseAIResponse(aiText, message);

  if (parsed.isConfirmation && parsed.scores.length > 0) {
    return { scores: parsed.scores, source: "ai_confirmation" };
  }
  if (userScore !== null) {
    return { scores: [userScore], source: "user_message" };
  }
  return { scores: [], source: "no_score" };
}

function buildAnswer(
  score: number,
  questionIdx: number,
  message: string,
  questions: TestQuestion[],
  answerRange: [number, number]
): TestAnswer {
  const question = questions[questionIdx];
  const reverseBase = answerRange[0] + answerRange[1];
  return {
    q: question.q,
    scale: question.scale,
    type: question.type,
    rawAnswer: score,
    score: question.type === "reverse" ? reverseBase - score : score,
    text: /^\d$/.test(message.trim()) ? undefined : message,
  };
}

// ── GET handler: restore anonymous session ──

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId || !UUID_RE.test(sessionId)) {
    return Response.json(
      { error: "Невалидный session_id" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();
  const { data: session } = await serviceClient
    .from("test_sessions")
    .select("messages, current_question, status")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!session || session.status !== "in_progress") {
    return Response.json(
      { error: "Сессия не найдена или завершена" },
      { status: 404 }
    );
  }

  return Response.json({
    messages: session.messages || [],
    current_question: session.current_question,
    status: session.status,
  });
}

// ── Main handler ──

export async function POST(request: Request) {
  // 1. Soft auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. Parse body
  const body = await request.json();
  const { message, test_slug, answer_type, answer: quickAnswer, answer_text, question_index, program_slug: rawProgramSlug } = body;

  // Load test config: prefer test_slug (direct), fallback to program_slug
  let testConfig: TestConfig | null = null;
  if (typeof test_slug === "string" && test_slug) {
    testConfig = await getTestConfig(test_slug);
  }
  if (!testConfig) {
    const programSlug: string = (typeof rawProgramSlug === "string" && rawProgramSlug) ? rawProgramSlug : DEFAULT_PROGRAM_SLUG;
    testConfig = await getTestConfigByProgram(programSlug);
  }
  if (!testConfig) {
    return Response.json(
      { error: "Тест не найден" },
      { status: 404 }
    );
  }


  const totalQuestions = testConfig.total_questions;
  const authWallQuestion = testConfig.ui_config.auth_wall_question;

  // answer_type validation
  if (answer_type && !["quick", "text"].includes(answer_type)) {
    return Response.json(
      { error: "Неизвестный answer_type" },
      { status: 400 }
    );
  }
  if (answer_type && (typeof question_index !== "number" || question_index < 0 || question_index >= totalQuestions)) {
    return Response.json(
      { error: "Невалидный question_index" },
      { status: 400 }
    );
  }
  if (answer_type === "quick") {
    const score = typeof quickAnswer === "number" ? quickAnswer : Number(message);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return Response.json(
        { error: "answer должен быть 1-5" },
        { status: 400 }
      );
    }
  }

  // message validation — only required when no answer_type
  if (!answer_type) {
    if (
      !message ||
      typeof message !== "string" ||
      message.length === 0 ||
      message.length > 5000
    ) {
      return Response.json(
        { error: "Невалидное сообщение (пусто или >5000 символов)" },
        { status: 400 }
      );
    }
  }

  const isAuthenticated = !!user;
  if (user) {
    Sentry.setUser({ id: user.id });
  } else if (body.session_id) {
    Sentry.setUser({ id: `anon:${body.session_id}` });
  }

  // 3. Load program & service client (needed for both validation and handlers)
  const serviceClient = createServiceClient();
  const { data: program } = await serviceClient
    .from("programs")
    .select("id, test_system_prompt")
    .eq("id", testConfig.program_id)
    .single();

  if (!program || !program.test_system_prompt) {
    return Response.json(
      { error: "Программа или промпт теста не найдены" },
      { status: 404 }
    );
  }

  // Mode-specific validation
  if (isAuthenticated) {
    if (body.chat_id && UUID_RE.test(body.chat_id)) {
      // Existing chat — proceed as usual
    } else if (body.session_id && UUID_RE.test(body.session_id)) {
      // Authenticated user starting fresh test — auto-create chat
      // Check for existing active test chat (idempotent)
      const { data: existingTestChat } = await serviceClient
        .from("chats")
        .select("id")
        .eq("user_id", user!.id)
        .eq("program_id", program.id)
        .eq("chat_type", "test")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (existingTestChat) {
        body.chat_id = existingTestChat.id;
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
          Sentry.captureException(chatErr ?? new Error("Auto-create test chat returned null"), {
            tags: { route: "api/test", phase: "create-chat" },
            extra: { programId: program.id },
          });
          console.error("[test] Failed to auto-create test chat:", chatErr);
          return Response.json(
            { error: "Не удалось создать тестовый чат" },
            { status: 500 }
          );
        }

        body.chat_id = newChat.id;
        console.log(`[test] Auto-created test chat ${newChat.id} for user ${user!.id}`);
      }
    } else {
      return Response.json(
        { error: "Невалидный chat_id" },
        { status: 400 }
      );
    }
  } else {
    if (!body.session_id || !UUID_RE.test(body.session_id)) {
      return Response.json(
        { error: "Невалидный session_id" },
        { status: 400 }
      );
    }
    if (!Array.isArray(body.messages)) {
      return Response.json(
        { error: "Отсутствует массив messages" },
        { status: 400 }
      );
    }

    // 3. Rate limiting (anonymous only)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (!checkRateLimit(ip)) {
      return Response.json(
        { error: "Слишком много запросов. Попробуйте позже." },
        { status: 429 }
      );
    }
  }

  const systemPrompt = program.test_system_prompt;

  // 5. Typed answer mode (quick/text) — new path
  if (answer_type === "quick" || answer_type === "text") {
    return handleTypedAnswer({
      serviceClient,
      supabase,
      user,
      isAuthenticated,
      answerType: answer_type,
      score: answer_type === "quick"
        ? (typeof quickAnswer === "number" ? quickAnswer : Number(message))
        : undefined,
      answerText: answer_type === "text" ? (answer_text ?? message) : undefined,
      questionIndex: question_index,
      sessionId: body.session_id,
      chatId: body.chat_id,
      clientMessages: body.messages,
      systemPrompt,
      programId: program.id,
      testConfig,
    });
  }

  // 6. Legacy mode (no answer_type) — existing handlers
  if (isAuthenticated) {
    return handleAuthenticated({
      supabase,
      serviceClient,
      user: user!,
      chatId: body.chat_id,
      message,
      systemPrompt,
      programId: program.id,
      testConfig,
    });
  } else {
    return handleAnonymous({
      serviceClient,
      sessionId: body.session_id,
      clientMessages: body.messages,
      message,
      systemPrompt,
      testConfig,
    });
  }
}

// ══════════════════════════════════════════════════════════
// Typed answer handler (quick / text)
// ══════════════════════════════════════════════════════════

async function handleTypedAnswer({
  serviceClient,
  supabase,
  user,
  isAuthenticated,
  answerType,
  score,
  answerText,
  questionIndex,
  sessionId,
  chatId,
  clientMessages,
  systemPrompt,
  programId,
  testConfig,
}: {
  serviceClient: ReturnType<typeof createServiceClient>;
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string } | null;
  isAuthenticated: boolean;
  answerType: "quick" | "text";
  score?: number;
  answerText?: string;
  questionIndex: number;
  sessionId?: string;
  chatId?: string;
  clientMessages?: Array<{ role: string; content: string }>;
  systemPrompt: string;
  programId: string;
  testConfig: TestConfig;
}) {
  // ── Step 1: Load state ──
  let serverCurrentQuestion: number;
  let existingAnswers: TestAnswer[];
  let session: TestSession | null = null;
  let testState: TestState | null = null;

  if (isAuthenticated) {
    if (!chatId || !UUID_RE.test(chatId)) {
      return Response.json({ error: "Невалидный chat_id" }, { status: 400 });
    }

    const { data: chat } = await supabase
      .from("chats")
      .select("id, chat_type, status")
      .eq("id", chatId)
      .single();

    if (!chat || chat.chat_type !== "test") {
      return Response.json({ error: "Чат не найден или не является тестом" }, { status: 404 });
    }

    const { data: chatRow } = await serviceClient
      .from("chats")
      .select("test_state")
      .eq("id", chatId)
      .single();

    testState = (chatRow?.test_state as TestState) || {
      current_question: 0,
      status: "in_progress",
      started_at: new Date().toISOString(),
      answers: [],
    };

    serverCurrentQuestion = testState.current_question;
    existingAnswers = testState.answers || [];
  } else {
    if (!sessionId || !UUID_RE.test(sessionId)) {
      return Response.json({ error: "Невалидный session_id" }, { status: 400 });
    }

    const { data: existingSession } = await serviceClient
      .from("test_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (!existingSession || existingSession.status !== "in_progress") {
      return Response.json(
        { error: "Сессия не найдена или завершена" },
        { status: 400 }
      );
    }

    session = existingSession as TestSession;
    serverCurrentQuestion = session.current_question;
    existingAnswers = (session.answers || []) as TestAnswer[];
  }

  // ── Step 2: Validate question_index ──
  if (questionIndex !== serverCurrentQuestion) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responseData: any = {
      error: "question_mismatch",
      server_question: serverCurrentQuestion,
      message: `Ожидался вопрос ${serverCurrentQuestion}, получен ${questionIndex}`,
    };

    // Test already completed — include result info for recovery
    if (isAuthenticated && serverCurrentQuestion >= testConfig.total_questions) {
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

  // ── Step 3: Handle answer_type === "quick" ──
  const lastQuestionIdx = testConfig.total_questions - 1;
  const authWallQuestion = testConfig.ui_config.auth_wall_question;

  if (answerType === "quick" && score !== undefined) {
    const answer = buildAnswer(score, questionIndex, String(score), testConfig.questions, testConfig.scoring.answer_range);
    const userMsg = { role: "user", content: String(score) };
    const assistantMsg = { role: "assistant", content: `Записываю как ${score}.` };

    if (isAuthenticated) {
      // Save messages to DB
      await supabase.from("messages").insert([
        { chat_id: chatId, role: "user", content: String(score), tokens_used: 0 },
        { chat_id: chatId, role: "assistant", content: `Записываю как ${score}.`, tokens_used: 0 },
      ]);

      // Check if this is the final answer
      if (questionIndex === lastQuestionIdx) {
        // Append answer via RPC first
        const { data: newState, error: rpcError } = await serviceClient.rpc(
          "append_test_answer",
          { p_chat_id: chatId, p_answer: answer }
        );
        if (rpcError) {
          console.error("[test:typed] append_test_answer error:", rpcError);
          return Response.json({ error: "Не удалось записать ответ" }, { status: 500 });
        }

        const finalState = newState as TestState;
        if (finalState.answers.length >= testConfig.total_questions) {
          // Background: calculate scores + interpretation
          after(() => calculateAndSaveResult({
            serviceClient, user: user!, chatId: chatId!,
            programId, testState: finalState, testConfig,
          }));
          return Response.json({
            success: true,
            calculating: true,
            next_question: testConfig.total_questions,
            chat_id: chatId,
          });
        }

        // Shouldn't happen, but handle gracefully
        await supabase
          .from("chats")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", chatId);
        return Response.json({ success: true, next_question: questionIndex + 1, score, chat_id: chatId });
      }

      // Normal authenticated answer (question_index 0-33)
      const { error: rpcError } = await serviceClient.rpc(
        "append_test_answer",
        { p_chat_id: chatId, p_answer: answer }
      );
      if (rpcError) {
        console.error("[test:typed] append_test_answer error:", rpcError);
        return Response.json({ error: "Не удалось записать ответ" }, { status: 500 });
      }

      await supabase
        .from("chats")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", chatId);

      return Response.json({ success: true, next_question: questionIndex + 1, score, chat_id: chatId });
    } else {
      // Anonymous mode
      const existingMessages = (session!.messages || []) as Array<{ role: string; content: string }>;
      const updatedAnswers = [...existingAnswers, answer];
      const updatedMessages = [...existingMessages, userMsg, assistantMsg];
      const nextQuestion = questionIndex + 1;

      await serviceClient
        .from("test_sessions")
        .update({
          current_question: nextQuestion,
          answers: updatedAnswers,
          messages: updatedMessages,
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId);

      // Check requires_auth: anonymous user hit auth wall
      if (authWallQuestion !== null && updatedAnswers.length >= authWallQuestion) {
        return Response.json({
          success: true,
          requires_auth: true,
          next_question: nextQuestion,
        });
      }

      return Response.json({ success: true, next_question: nextQuestion, score });
    }
  }

  // ── Step 4: Handle answer_type === "text" ──
  if (answerType === "text" && answerText) {
    const questionText = testConfig.questions[questionIndex].text;
    const miniPrompt = buildMiniPrompt(questionText, testConfig.mini_analysis_prompt_template);

    return createSSEResponse(async (send) => {
      const result = streamText({
        model: google("gemini-2.5-flash"),
        system: miniPrompt,
        messages: [{ role: "user" as const, content: answerText }],
      });

      const fullText = await streamToSSE(result, send);

      // Parse score from AI response
      const parsed = parseAIResponse(fullText, answerText);
      const userScore = extractScoreFromUserMessage(answerText);

      let extractedScore: number | null = null;
      if (parsed.isConfirmation && parsed.scores.length > 0) {
        extractedScore = parsed.scores[0];
      } else if (userScore !== null) {
        extractedScore = userScore;
      }

      if (extractedScore === null) {
        // Could not parse — stay on same question
        send({ type: "answer_rejected", reason: "parse_failed" });
        send({ type: "done" });
        return;
      }

      // Score found — record the answer
      const answer = buildAnswer(extractedScore, questionIndex, answerText, testConfig.questions, testConfig.scoring.answer_range);

      if (isAuthenticated) {
        // Save messages
        await supabase.from("messages").insert([
          { chat_id: chatId, role: "user", content: answerText, tokens_used: 0 },
          { chat_id: chatId, role: "assistant", content: fullText, tokens_used: 0 },
        ]);

        // Final answer check
        if (questionIndex === lastQuestionIdx) {
          const { data: newState, error: rpcError } = await serviceClient.rpc(
            "append_test_answer",
            { p_chat_id: chatId, p_answer: answer }
          );
          if (rpcError) {
            console.error("[test:typed:text] append_test_answer error:", rpcError);
            send({ type: "error", message: "Не удалось записать ответ" });
            send({ type: "done" });
            return;
          }

          const finalState = newState as TestState;
          if (finalState.answers.length >= testConfig.total_questions) {
            // Signal client: answer accepted, calculation starting
            send({ type: "answer_confirmed", score: extractedScore, next_question: testConfig.total_questions });
            send({ type: "calculating" });
            send({ type: "done" });

            // Background: calculate scores + interpretation
            calculateAndSaveResult({
              serviceClient, user: user!, chatId: chatId!,
              programId, testState: finalState, testConfig,
            }).catch(err => {
              console.error("[test:typed:text] Background calculation failed:", err);
            });
            return;
          }

          send({ type: "answer_confirmed", score: extractedScore, next_question: questionIndex + 1 });
          send({ type: "done" });
          return;
        }

        // Normal authenticated answer
        const { error: rpcError } = await serviceClient.rpc(
          "append_test_answer",
          { p_chat_id: chatId, p_answer: answer }
        );
        if (rpcError) {
          console.error("[test:typed:text] append_test_answer error:", rpcError);
        }

        await supabase
          .from("chats")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", chatId);

        send({ type: "answer_confirmed", score: extractedScore, next_question: questionIndex + 1 });
        send({ type: "done" });
      } else {
        // Anonymous mode
        const existingMessages = (session!.messages || []) as Array<{ role: string; content: string }>;
        const updatedAnswers = [...existingAnswers, answer];
        const updatedMessages = [
          ...existingMessages,
          { role: "user", content: answerText },
          { role: "assistant", content: fullText },
        ];
        const nextQuestion = questionIndex + 1;

        await serviceClient
          .from("test_sessions")
          .update({
            current_question: nextQuestion,
            answers: updatedAnswers,
            messages: updatedMessages,
            updated_at: new Date().toISOString(),
          })
          .eq("session_id", sessionId);

        send({ type: "answer_confirmed", score: extractedScore, next_question: nextQuestion });

        // Check requires_auth: anonymous hit auth wall
        if (authWallQuestion !== null && updatedAnswers.length >= authWallQuestion) {
          send({ type: "requires_auth" });
        }

        send({ type: "done" });
      }
    });
  }

  // Fallback — shouldn't reach here
  return Response.json({ error: "Невалидные параметры запроса" }, { status: 400 });
}

// ── Helper: background calculation (Q35 async) ──

async function calculateAndSaveResult({
  serviceClient,
  user,
  chatId,
  programId,
  testState,
  testConfig,
}: {
  serviceClient: ReturnType<typeof createServiceClient>;
  user: { id: string };
  chatId: string;
  programId: string;
  testState: TestState;
  testConfig: TestConfig;
}) {
  try {
    // Step 1: Calculate scores (sync, fast)
    console.log("[test:bg] Step 1: calculateTestScore, answers:", testState.answers.length);
    const testResult = calculateTestScore(testState.answers, testConfig);
    console.log("[test:bg] Step 1 done. Score:", testResult.totalScore, "topScales:", testResult.topScales);

    // Step 2: Insert test_results with status='processing' (not ready until interpretation done)
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

    // Step 4: Generate interpretation (slow, 20-30s) — only set 'ready' after this completes
    console.log("[test:bg] Step 4: generateTestInterpretation (slow)");
    try {
      const interpretation = await generateTestInterpretation(
        testResult.totalScore,
        testResult.scoresByScale,
        testConfig
      );
      console.log("[test:bg] Step 4 done. Updating interpretation + status=ready...");

      await serviceClient
        .from("test_results")
        .update({ interpretation, status: "ready" })
        .eq("id", resultId);
      console.log("[test:bg] Interpretation saved for result:", resultId);
    } catch (interpErr) {
      console.error("[test:bg] Step 4 FAILED: generateTestInterpretation error:", interpErr);
      // Still mark as ready so user isn't stuck — scores are available without interpretation
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

// ══════════════════════════════════════════════════════════
// Anonymous handler (legacy — no answer_type)
// ══════════════════════════════════════════════════════════

async function handleAnonymous({
  serviceClient,
  sessionId,
  clientMessages,
  message,
  systemPrompt,
  testConfig,
}: {
  serviceClient: ReturnType<typeof createServiceClient>;
  sessionId: string;
  clientMessages: Array<{ role: string; content: string }>;
  message: string;
  systemPrompt: string;
  testConfig: TestConfig;
}) {
  // Load or create session
  let session: TestSession | null = null;
  const { data: existingSession } = await serviceClient
    .from("test_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existingSession) {
    session = existingSession as TestSession;
    if (session.status !== "in_progress") {
      return Response.json(
        { error: "Сессия уже завершена или мигрирована" },
        { status: 400 }
      );
    }
  } else {
    // Create new session
    const { data: newSession, error: insertError } = await serviceClient
      .from("test_sessions")
      .insert({
        session_id: sessionId,
        test_slug: testConfig.slug,
        status: "in_progress",
        current_question: 0,
        answers: [],
        messages: [],
      })
      .select("*")
      .single();

    if (insertError || !newSession) {
      console.error("[test] Failed to create test_session:", insertError);
      return Response.json(
        { error: "Не удалось создать сессию теста" },
        { status: 500 }
      );
    }
    session = newSession as TestSession;
  }

  const currentQuestion = session.current_question;
  const existingAnswers = (session.answers || []) as TestAnswer[];
  const existingMessages = (session.messages || []) as Array<{
    role: string;
    content: string;
  }>;

  // Safety net: don't allow answers past auth wall anonymously
  const authWallQ = testConfig.ui_config.auth_wall_question;
  if (authWallQ !== null && existingAnswers.length >= authWallQ) {
    return createSSEResponse(async (send) => {
      send({ type: "requires_auth" });
      send({ type: "done" });
    });
  }

  const isFirstMessage = existingMessages.length === 0 && clientMessages.length <= 1;

  // Build AI messages from client-provided history
  const historyMessages = clientMessages
    .map((msg: { role: string; content: string }) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content || "",
    }))
    .filter(
      (msg: { role: string; content: string }) =>
        msg.role === "user" || msg.role === "assistant"
    );

  // Filter leading assistant messages (Gemini requires user-first)
  const firstUserIdx = historyMessages.findIndex(
    (m: { role: string }) => m.role === "user"
  );
  const filteredHistory =
    firstUserIdx >= 0 ? historyMessages.slice(firstUserIdx) : [];

  // clientMessages already includes the current user message,
  // so don't append it again (would create duplicate user messages → breaks Gemini)
  const aiMessages = filteredHistory.length > 0
    ? filteredHistory
    : [{ role: "user" as const, content: message }];

  // Stream response
  return createSSEResponse(async (send) => {
    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages: aiMessages,
    });

    const fullText = await streamToSSE(result, send);

    // Post-stream: parse score and update state
    if (!isFirstMessage) {
      const { scores, source } = extractScores(message, fullText);
      console.log(
        "[test:anon] Scores:",
        scores,
        "source:",
        source,
        "currentQ:",
        currentQuestion
      );

      let updatedQuestion = currentQuestion;
      const updatedAnswers = [...existingAnswers];

      for (const score of scores) {
        if (updatedQuestion >= testConfig.total_questions) break;
        const answer = buildAnswer(score, updatedQuestion, message, testConfig.questions, testConfig.scoring.answer_range);
        updatedAnswers.push(answer);
        updatedQuestion++;
      }

      // Update messages history
      const updatedMessages = [
        ...existingMessages,
        { role: "user", content: message },
        { role: "assistant", content: fullText },
      ];

      await serviceClient
        .from("test_sessions")
        .update({
          current_question: updatedQuestion,
          answers: updatedAnswers,
          messages: updatedMessages,
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId);

      // Special signal: requires_auth at auth wall
      if (authWallQ !== null && updatedAnswers.length >= authWallQ) {
        send({ type: "requires_auth" });
      }
    } else {
      // First message — just save messages (welcome exchange)
      const updatedMessages = [
        ...existingMessages,
        { role: "user", content: message },
        { role: "assistant", content: fullText },
      ];

      await serviceClient
        .from("test_sessions")
        .update({
          messages: updatedMessages,
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId);
    }

    send({ type: "done" });
  });
}

// ══════════════════════════════════════════════════════════
// Authenticated handler
// ══════════════════════════════════════════════════════════

async function handleAuthenticated({
  supabase,
  serviceClient,
  user,
  chatId,
  message,
  systemPrompt,
  programId,
  testConfig,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  serviceClient: ReturnType<typeof createServiceClient>;
  user: { id: string; email?: string };
  chatId: string;
  message: string;
  systemPrompt: string;
  programId: string;
  testConfig: TestConfig;
}) {
  // Load chat
  const { data: chat } = await supabase
    .from("chats")
    .select("id, chat_type, status")
    .eq("id", chatId)
    .single();

  if (!chat) {
    return Response.json({ error: "Чат не найден" }, { status: 404 });
  }
  if (chat.chat_type !== "test") {
    return Response.json(
      { error: "Чат не является тестом" },
      { status: 400 }
    );
  }

  // Load test_state via service client (bypass RLS for JSONB)
  const { data: chatRow } = await serviceClient
    .from("chats")
    .select("test_state")
    .eq("id", chatId)
    .single();

  const testState: TestState = (chatRow?.test_state as TestState) || {
    current_question: 0,
    status: "in_progress",
    started_at: new Date().toISOString(),
    answers: [],
  };

  // Load message history from DB
  const { data: dbMessages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  const allDbMessages = (dbMessages || []).map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));
  const firstUserIdx = allDbMessages.findIndex((m) => m.role === "user");
  const historyMessages =
    firstUserIdx >= 0 ? allDbMessages.slice(firstUserIdx) : [];

  const aiMessages = [
    ...historyMessages,
    { role: "user" as const, content: message },
  ];

  // Save user message BEFORE streaming
  const { error: msgError } = await supabase.from("messages").insert({
    chat_id: chatId,
    role: "user",
    content: message,
    tokens_used: 0,
  });

  if (msgError) {
    console.error("[test:auth] Failed to save user message:", msgError);
    return Response.json(
      { error: "Не удалось сохранить сообщение" },
      { status: 500 }
    );
  }

  // Detect potential final answer
  const lastQuestionIdx = testConfig.total_questions - 1;
  const isPotentiallyFinalAnswer =
    testState.current_question >= lastQuestionIdx && testState.status === "in_progress";

  if (isPotentiallyFinalAnswer) {
    return handleFinalTestAnswer({
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
    });
  }

  // Normal flow
  const isFirstMessage = allDbMessages.length === 0;

  return createSSEResponse(async (send) => {
    // Send chat_id to client (needed when chat was auto-created)
    send({ type: "chat_id", chat_id: chatId });

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages: aiMessages,
    });

    const fullText = await streamToSSE(result, send);

    // Save AI message
    await supabase.from("messages").insert({
      chat_id: chatId,
      role: "assistant",
      content: fullText,
      tokens_used: 0,
    });

    // Update chat metadata
    await supabase
      .from("chats")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", chatId);

    // Parse score and update test_state
    if (!isFirstMessage && testState.status === "in_progress") {
      const { scores, source } = extractScores(message, fullText);
      console.log(
        "[test:auth] Scores:",
        scores,
        "source:",
        source,
        "currentQ:",
        testState.current_question
      );

      for (const score of scores) {
        if (testState.current_question >= testConfig.total_questions) break;
        const answer = buildAnswer(score, testState.current_question, message, testConfig.questions, testConfig.scoring.answer_range);

        const { error: rpcError } = await serviceClient.rpc(
          "append_test_answer",
          { p_chat_id: chatId, p_answer: answer }
        );

        if (rpcError) {
          console.error("[test:auth] append_test_answer error:", rpcError);
          break;
        }
        testState.current_question++;
        testState.answers.push(answer);
      }
    }

    send({ type: "done" });
  });
}

// ══════════════════════════════════════════════════════════
// Two-phase streaming for final (35th) answer
// Pattern from chat/route.ts handleFinalTestAnswer
// ══════════════════════════════════════════════════════════

async function handleFinalTestAnswer({
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
  serviceClient: ReturnType<typeof createServiceClient>;
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string };
  chatId: string;
  message: string;
  systemPrompt: string;
  programId: string;
  aiMessages: { role: "user" | "assistant"; content: string }[];
  testState: TestState;
  testConfig: TestConfig;
}) {
  console.log(
    "[test:final] handleFinalTestAnswer: current_question =",
    testState.current_question,
    "answers.length =",
    testState.answers.length
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
      phase1Text
    );
    console.log(
      "[test:final] Scores:",
      scoresToRecord,
      "source:",
      scoreSource
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
        testConfig.scoring.answer_range
      );

      const { data: newState, error: rpcError } = await serviceClient.rpc(
        "append_test_answer",
        { p_chat_id: chatId, p_answer: answer }
      );

      if (rpcError) {
        console.error("[test:final] append_test_answer error:", rpcError);
        break;
      }
      currentTestState = newState as TestState;
    }

    if (currentTestState.answers.length < testConfig.total_questions) {
      // Not yet 35 — finish with single phase
      console.warn(
        "[test:final] Expected 35 answers but got",
        currentTestState.answers.length
      );

      await supabase.from("messages").insert({
        chat_id: chatId,
        role: "assistant",
        content: phase1Text,
        tokens_used: 0,
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
      scoringResult.topScales
    );

    // Save test_results (status=processing — not ready until interpretation done)
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

    // Send test_complete signal IMMEDIATELY after insert,
    // before interpretation (which can fail/timeout)
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

    // Generate interpretation (Gemini Pro, JSON) — set status='ready' only after this completes
    let interpretation = { level_label: "не определён" } as Awaited<ReturnType<typeof generateTestInterpretation>>;
    try {
      interpretation = await generateTestInterpretation(
        scoringResult.totalScore,
        scoringResult.scoresByScale,
        testConfig
      );

      if (insertData?.id) {
        const { error: interpError } = await serviceClient
          .from("test_results")
          .update({ interpretation, status: "ready" })
          .eq("id", insertData.id);

        if (interpError) {
          console.error(
            "[test:final] Failed to save interpretation:",
            interpError
          );
        }
      }
    } catch (interpErr) {
      console.error("[test:final] Interpretation generation failed:", interpErr);
      // Still mark as ready so user isn't stuck — scores are available
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
    await supabase.from("messages").insert({
      chat_id: chatId,
      role: "assistant",
      content: combinedText,
      tokens_used: 0,
    });

    await supabase
      .from("chats")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", chatId);

    console.log("[test:final] Two-phase streaming completed for user:", user.id);

    send({ type: "done" });
  });
}
