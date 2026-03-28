import { streamText } from "ai";
import { google } from "@/lib/ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TestAnswer } from "@/lib/test-scoring";
import type { TestConfig } from "@/lib/test-config";
import { buildAnswer, extractScores, type TestSession } from "@/lib/test-helpers";
import { createSSEResponse, streamToSSE } from "@/lib/test-sse";

export async function handleAnonymous({
  serviceClient,
  sessionId,
  clientMessages,
  message,
  systemPrompt,
  testConfig,
}: {
  serviceClient: SupabaseClient;
  sessionId: string;
  clientMessages: Array<{ role: string; content: string }>;
  message: string;
  systemPrompt: string;
  testConfig: TestConfig;
}): Promise<Response> {
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
        { status: 400 },
      );
    }
  } else {
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
        { status: 500 },
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
        msg.role === "user" || msg.role === "assistant",
    );

  // Filter leading assistant messages (Gemini requires user-first)
  const firstUserIdx = historyMessages.findIndex(
    (m: { role: string }) => m.role === "user",
  );
  const filteredHistory =
    firstUserIdx >= 0 ? historyMessages.slice(firstUserIdx) : [];

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
        currentQuestion,
      );

      let updatedQuestion = currentQuestion;
      const updatedAnswers = [...existingAnswers];

      for (const score of scores) {
        if (updatedQuestion >= testConfig.total_questions) break;
        const answer = buildAnswer(score, updatedQuestion, message, testConfig.questions, testConfig.scoring.answer_range);
        updatedAnswers.push(answer);
        updatedQuestion++;
      }

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

      if (authWallQ !== null && updatedAnswers.length >= authWallQ) {
        send({ type: "requires_auth" });
      }
    } else {
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
