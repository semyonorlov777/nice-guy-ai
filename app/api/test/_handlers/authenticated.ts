import { streamText } from "ai";
import { chatModel, CHAT_PROVIDER_OPTIONS } from "@/lib/ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TestConfig } from "@/lib/test-config";
import { apiError } from "@/lib/api-helpers";
import { insertMessage } from "@/lib/queries/messages";
import { buildAnswer, extractScores, type TestState } from "@/lib/test-helpers";
import { createSSEResponse, streamToSSE } from "@/lib/test-sse";
import { handleFinalTestAnswer } from "./final-answer";

export async function handleAuthenticated({
  supabase,
  serviceClient,
  user,
  chatId,
  message,
  systemPrompt,
  programId,
  testConfig,
}: {
  supabase: SupabaseClient;
  serviceClient: SupabaseClient;
  user: { id: string; email?: string };
  chatId: string;
  message: string;
  systemPrompt: string;
  programId: string;
  testConfig: TestConfig;
}): Promise<Response> {
  // Load chat
  const { data: chat } = await supabase
    .from("chats")
    .select("id, chat_type, status")
    .eq("id", chatId)
    .single();

  if (!chat) {
    return apiError("Чат не найден", 404);
  }
  if (chat.chat_type !== "test") {
    return apiError("Чат не является тестом", 400);
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
  const { error: msgError } = await insertMessage(supabase, {
    chatId,
    role: "user",
    content: message,
  });

  if (msgError) {
    console.error("[test:auth] Failed to save user message:", msgError);
    return apiError("Не удалось сохранить сообщение", 500);
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
    send({ type: "chat_id", chat_id: chatId });

    const result = streamText({
      model: chatModel(),
      providerOptions: CHAT_PROVIDER_OPTIONS,
      system: systemPrompt,
      messages: aiMessages,
    });

    const fullText = await streamToSSE(result, send);

    // Save AI message
    await insertMessage(supabase, {
      chatId,
      role: "assistant",
      content: fullText,
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
        testState.current_question,
      );

      for (const score of scores) {
        if (testState.current_question >= testConfig.total_questions) break;
        const answer = buildAnswer(score, testState.current_question, message, testConfig.questions, testConfig.scoring.answer_range);

        const { error: rpcError } = await serviceClient.rpc(
          "append_test_answer",
          { p_chat_id: chatId, p_answer: answer },
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
