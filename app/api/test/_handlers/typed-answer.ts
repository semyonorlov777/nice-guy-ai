import { streamText } from "ai";
import { chatModel, CHAT_PROVIDER_OPTIONS } from "@/lib/ai";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAIResponse, extractScoreFromUserMessage } from "@/lib/test-parser";
import { buildMiniPrompt } from "@/lib/test-mini-prompt";
import type { TestAnswer } from "@/lib/test-scoring";
import type { TestConfig } from "@/lib/test-config";
import { apiError } from "@/lib/api-helpers";
import { insertMessages } from "@/lib/queries/messages";
import { UUID_RE, buildAnswer, type TestState, type TestSession } from "@/lib/test-helpers";
import { createSSEResponse, streamToSSE } from "@/lib/test-sse";
import { calculateAndSaveResult } from "@/lib/test-completion";

export async function handleTypedAnswer({
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
  serviceClient: SupabaseClient;
  supabase: SupabaseClient;
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
}): Promise<Response> {
  // ── Step 1: Load state ──
  let serverCurrentQuestion: number;
  let existingAnswers: TestAnswer[];
  let session: TestSession | null = null;
  let testState: TestState | null = null;

  if (isAuthenticated) {
    if (!chatId || !UUID_RE.test(chatId)) {
      return apiError("Невалидный chat_id", 400);
    }

    const { data: chat } = await supabase
      .from("chats")
      .select("id, chat_type, status")
      .eq("id", chatId)
      .single();

    if (!chat || chat.chat_type !== "test") {
      return apiError("Чат не найден или не является тестом", 404);
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
      return apiError("Невалидный session_id", 400);
    }

    const { data: existingSession } = await serviceClient
      .from("test_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (existingSession && existingSession.status !== "in_progress") {
      return apiError("Сессия не найдена или завершена", 400);
    }

    if (existingSession) {
      session = existingSession as TestSession;
    } else {
      // Auto-create session for typed-answer tests (session created lazily on first answer)
      const { data: newSession, error: createErr } = await serviceClient
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

      if (createErr || !newSession) {
        console.error("[test:typed] Auto-create session failed:", createErr);
        return apiError("Не удалось создать сессию", 500);
      }
      session = newSession as TestSession;
    }

    serverCurrentQuestion = session.current_question;
    existingAnswers = (session.answers || []) as TestAnswer[];
  }

  // ── Step 2: Validate question_index ──
  if (questionIndex !== serverCurrentQuestion) {
    const extra: Record<string, unknown> = {
      server_question: serverCurrentQuestion,
      message: `Ожидался вопрос ${serverCurrentQuestion}, получен ${questionIndex}`,
    };

    if (isAuthenticated && serverCurrentQuestion >= testConfig.total_questions) {
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

  // ── Step 3: Handle answer_type === "quick" ──
  const lastQuestionIdx = testConfig.total_questions - 1;
  const authWallQuestion = testConfig.ui_config.auth_wall_question;

  if (answerType === "quick" && score !== undefined) {
    const answer = buildAnswer(score, questionIndex, String(score), testConfig.questions, testConfig.scoring.answer_range);

    if (isAuthenticated) {
      await insertMessages(supabase, [
        { chatId: chatId!, role: "user", content: String(score) },
        { chatId: chatId!, role: "assistant", content: `Записываю как ${score}.` },
      ]);

      if (questionIndex === lastQuestionIdx) {
        const { data: newState, error: rpcError } = await serviceClient.rpc(
          "append_test_answer",
          { p_chat_id: chatId, p_answer: answer },
        );
        if (rpcError) {
          console.error("[test:typed] append_test_answer error:", rpcError);
          return apiError("Не удалось записать ответ", 500);
        }

        const finalState = newState as TestState;
        if (finalState.answers.length >= testConfig.total_questions) {
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

        await supabase
          .from("chats")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", chatId);
        return Response.json({ success: true, next_question: questionIndex + 1, score, chat_id: chatId });
      }

      // Normal authenticated answer
      const { error: rpcError } = await serviceClient.rpc(
        "append_test_answer",
        { p_chat_id: chatId, p_answer: answer },
      );
      if (rpcError) {
        console.error("[test:typed] append_test_answer error:", rpcError);
        return apiError("Не удалось записать ответ", 500);
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
      const updatedMessages = [
        ...existingMessages,
        { role: "user", content: String(score) },
        { role: "assistant", content: `Записываю как ${score}.` },
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
        model: chatModel(),
        providerOptions: CHAT_PROVIDER_OPTIONS,
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
        send({ type: "answer_rejected", reason: "parse_failed" });
        send({ type: "done" });
        return;
      }

      const answer = buildAnswer(extractedScore, questionIndex, answerText, testConfig.questions, testConfig.scoring.answer_range);

      if (isAuthenticated) {
        await insertMessages(supabase, [
          { chatId: chatId!, role: "user", content: answerText },
          { chatId: chatId!, role: "assistant", content: fullText },
        ]);

        if (questionIndex === lastQuestionIdx) {
          const { data: newState, error: rpcError } = await serviceClient.rpc(
            "append_test_answer",
            { p_chat_id: chatId, p_answer: answer },
          );
          if (rpcError) {
            console.error("[test:typed:text] append_test_answer error:", rpcError);
            send({ type: "error", message: "Не удалось записать ответ" });
            send({ type: "done" });
            return;
          }

          const finalState = newState as TestState;
          if (finalState.answers.length >= testConfig.total_questions) {
            send({ type: "answer_confirmed", score: extractedScore, next_question: testConfig.total_questions });
            send({ type: "calculating" });
            send({ type: "done" });

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
          { p_chat_id: chatId, p_answer: answer },
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

        if (authWallQuestion !== null && updatedAnswers.length >= authWallQuestion) {
          send({ type: "requires_auth" });
        }

        send({ type: "done" });
      }
    });
  }

  // Fallback
  return apiError("Невалидные параметры запроса", 400);
}
