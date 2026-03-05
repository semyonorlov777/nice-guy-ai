import { createClient, createServiceClient } from "@/lib/supabase-server";
import { streamChat } from "@/lib/gemini";
import { updatePortrait } from "@/app/api/portrait/update/route";
import { parseAIResponse } from "@/lib/issp-parser";
import { calculateISSP } from "@/lib/issp-scoring";
import { ISSP_QUESTIONS } from "@/lib/issp-config";
import type { TestAnswer } from "@/lib/issp-scoring";
import type { Content } from "@google/generative-ai";

const DEFAULT_BALANCE = 1000;

export async function POST(request: Request) {
  const supabase = await createClient();

  // 1. Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Не авторизован" }, { status: 401 });
  }

  // 2. Parse body
  const { message, chatId, programId, exerciseId, chatType } = await request.json();
  if (!message || !programId) {
    return Response.json({ error: "Не указано сообщение или программа" }, { status: 400 });
  }

  // 3. Get or create user record + check balance
  let { data: userData } = await supabase
    .from("profiles")
    .select("balance_tokens")
    .eq("id", user.id)
    .maybeSingle();

  if (!userData) {
    // Auto-create user record with service client (bypasses RLS)
    console.log("[chat] Creating users record for", user.id);
    const serviceClient = createServiceClient();
    const { data: newUser, error: createError } = await serviceClient
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        balance_tokens: DEFAULT_BALANCE,
      })
      .select("balance_tokens")
      .single();

    if (createError) {
      console.error("[chat] Failed to create user record:", createError);
      return Response.json(
        { error: "Не удалось создать профиль пользователя" },
        { status: 500 }
      );
    }
    userData = newUser;
  }

  if (userData.balance_tokens <= 0) {
    return Response.json({ error: "Недостаточно токенов" }, { status: 403 });
  }

  // 4. Load program
  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("id, system_prompt, free_chat_welcome, test_system_prompt")
    .eq("id", programId)
    .single();

  if (!program) {
    console.error("[chat] Program not found:", programId, programError);
    return Response.json({ error: "Программа не найдена" }, { status: 404 });
  }

  // 5. Load exercise (if exercise chat)
  let exercise: { id: string; system_prompt: string; title: string; welcome_message: string | null } | null =
    null;
  if (exerciseId) {
    const { data } = await supabase
      .from("exercises")
      .select("id, system_prompt, title, welcome_message")
      .eq("id", exerciseId)
      .single();
    exercise = data;
  }

  // 6. Load portrait
  const { data: portrait } = await supabase
    .from("portraits")
    .select("content")
    .eq("user_id", user.id)
    .eq("program_id", programId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 7. Find or create chat
  const isTestMode = chatType === "test";
  let currentChatId = chatId;
  let isNewChat = false;
  let currentChatType = isTestMode ? "test" : exerciseId ? "exercise" : "free";

  if (!currentChatId) {
    if (isTestMode) {
      // For test mode: find active test chat
      const { data: existingChat } = await supabase
        .from("chats")
        .select("id")
        .eq("user_id", user.id)
        .eq("program_id", programId)
        .eq("chat_type", "test")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (existingChat) {
        currentChatId = existingChat.id;
      }
    } else {
      // Build query — chain properly to avoid mutation issues
      let findQuery = supabase
        .from("chats")
        .select("id")
        .eq("user_id", user.id)
        .eq("program_id", programId)
        .eq("status", "active");

      if (exerciseId) {
        findQuery = findQuery.eq("exercise_id", exerciseId);
      } else {
        findQuery = findQuery.is("exercise_id", null);
      }

      const { data: existingChat } = await findQuery.limit(1).maybeSingle();
      if (existingChat) {
        currentChatId = existingChat.id;
      }
    }

    if (!currentChatId) {
      // Create new chat
      const insertData: Record<string, unknown> = {
        user_id: user.id,
        program_id: programId,
        status: "active",
      };

      if (isTestMode) {
        insertData.chat_type = "test";
        insertData.test_state = {
          current_question: 0,
          status: "in_progress",
          started_at: new Date().toISOString(),
          answers: [],
        };
      } else {
        insertData.exercise_id = exerciseId || null;
        insertData.chat_type = exerciseId ? "exercise" : "free";
      }

      const { data: newChat, error: chatError } = await supabase
        .from("chats")
        .insert(insertData)
        .select("id")
        .single();

      if (chatError || !newChat) {
        console.error("[chat] Failed to create chat:", chatError);
        return Response.json(
          { error: "Не удалось создать чат" },
          { status: 500 }
        );
      }

      currentChatId = newChat.id;
      isNewChat = true;

      // Insert welcome message (not for test — AI generates its own)
      if (!isTestMode) {
        const welcomeText = exercise?.welcome_message || program.free_chat_welcome;
        if (welcomeText) {
          await supabase.from("messages").insert({
            chat_id: currentChatId,
            role: "assistant",
            content: welcomeText,
            tokens_used: 0,
          });
        }
      }
    }
  } else {
    // Determine chat type from existing chat
    const { data: chatData } = await supabase
      .from("chats")
      .select("chat_type")
      .eq("id", currentChatId)
      .single();
    if (chatData?.chat_type) {
      currentChatType = chatData.chat_type;
    }
  }

  // 8. Load message history
  const { data: dbMessages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("chat_id", currentChatId)
    .order("created_at", { ascending: true });

  // 9. Build system prompt
  let systemPrompt = "";
  if (currentChatType === "test") {
    systemPrompt = program.test_system_prompt || "";
  } else {
    systemPrompt = program.system_prompt || "";
    if (exercise?.system_prompt) {
      systemPrompt += `\n\n---\nТЕКУЩЕЕ УПРАЖНЕНИЕ: ${exercise.title}\n${exercise.system_prompt}`;
    }
    if (portrait?.content) {
      const p = portrait.content as { ai_context?: string };
      if (p.ai_context) {
        systemPrompt += `\n\n---\nКОНТЕКСТ ПОЛЬЗОВАТЕЛЯ (из предыдущих упражнений):\n${p.ai_context}`;
      }
    }
  }

  // 10. Convert to Gemini format
  // Filter out leading "model" messages (e.g. welcome messages) —
  // Gemini requires history to start with "user"
  const allMessages = (dbMessages || []).map((msg) => ({
    role: (msg.role === "assistant" ? "model" : "user") as "model" | "user",
    parts: [{ text: msg.content }],
  }));
  const firstUserIdx = allMessages.findIndex((m) => m.role === "user");
  const history: Content[] = firstUserIdx >= 0 ? allMessages.slice(firstUserIdx) : [];

  // 11. Save user message
  const { error: msgError } = await supabase.from("messages").insert({
    chat_id: currentChatId,
    role: "user",
    content: message,
    tokens_used: 0,
  });

  if (msgError) {
    console.error("[chat] Failed to save user message:", msgError);
    return Response.json(
      { error: "Не удалось сохранить сообщение" },
      { status: 500 }
    );
  }

  // 12. Stream response from Gemini
  let result;
  try {
    result = await streamChat(systemPrompt, history, message);
  } catch (error) {
    console.error("[chat] Gemini API error:", error);
    return Response.json(
      { error: "Ошибка AI. Проверьте API ключ." },
      { status: 502 }
    );
  }

  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      if (isNewChat) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "chat_id", chatId: currentChatId })}\n\n`
          )
        );
      }

      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            fullResponse += text;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "delta", content: text })}\n\n`
              )
            );
          }
        }

        // Get usage metadata
        const response = await result.response;
        const tokensUsed = response.usageMetadata?.totalTokenCount || 0;

        // Save AI message
        await supabase.from("messages").insert({
          chat_id: currentChatId,
          role: "assistant",
          content: fullResponse,
          tokens_used: tokensUsed,
        });

        // Deduct tokens
        if (tokensUsed > 0) {
          const newBalance = Math.max(0, userData.balance_tokens - tokensUsed);
          await supabase
            .from("profiles")
            .update({ balance_tokens: newBalance })
            .eq("id", user.id);
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", tokensUsed })}\n\n`
          )
        );

        // Test mode: parse AI response and update test state
        if (currentChatType === "test") {
          try {
            const svc = createServiceClient();
            const { data: chatRow } = await svc
              .from("chats")
              .select("test_state")
              .eq("id", currentChatId)
              .single();

            if (chatRow?.test_state) {
              const testState = chatRow.test_state as {
                current_question: number;
                status: string;
                started_at: string;
                answers: TestAnswer[];
              };

              const parsed = parseAIResponse(fullResponse, message);
              if (parsed.isConfirmation && parsed.scores.length > 0) {
                for (const score of parsed.scores) {
                  const qIdx = testState.current_question;
                  if (qIdx >= ISSP_QUESTIONS.length) break;
                  const question = ISSP_QUESTIONS[qIdx];
                  testState.answers.push({
                    q: question.q,
                    scale: question.scale,
                    type: question.type,
                    rawAnswer: score,
                    score: question.type === "reverse" ? 6 - score : score,
                    text: /^\d$/.test(message.trim()) ? undefined : message,
                  });
                  testState.current_question++;
                }

                // Check if test is complete
                if (testState.answers.length >= 35) {
                  testState.status = "completed";
                  const result = calculateISSP(testState.answers);

                  // Save test result
                  await svc.from("test_results").insert({
                    user_id: user.id,
                    program_id: programId,
                    chat_id: currentChatId,
                    total_score: result.totalScore,
                    total_raw: result.totalRaw,
                    scores_by_scale: result.scoresByScale,
                    answers: testState.answers,
                    recommended_exercises: result.recommendedExercises,
                    top_scales: result.topScales,
                  });

                  // Mark chat as completed
                  await svc
                    .from("chats")
                    .update({ test_state: testState, status: "completed" })
                    .eq("id", currentChatId);

                  console.log("[ISSP] Test completed for user:", user.id, "score:", result.totalScore);
                } else {
                  // Update test state with new answers
                  await svc
                    .from("chats")
                    .update({ test_state: testState })
                    .eq("id", currentChatId);
                }
              }
            }
          } catch (err) {
            console.error("[ISSP] Test state update error:", err);
          }
        }

        // Portrait auto-update: every 5 user messages (skip for test chats)
        if (currentChatType !== "test") try {
          const svc = createServiceClient();
          const { count: userMsgCount, error: countError } = await svc
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("chat_id", currentChatId)
            .eq("role", "user");

          console.log("[PORTRAIT] Message count:", userMsgCount, "Trigger:", userMsgCount && userMsgCount % 5 === 0, "error:", countError);

          if (userMsgCount && userMsgCount > 0 && userMsgCount % 5 === 0) {
            console.log("[PORTRAIT] Triggering update for chat:", currentChatId);
            // Fire and forget — don't await, don't block the user
            updatePortrait(currentChatId, "message_count").catch((err) => {
              console.error("[PORTRAIT] Background update failed:", err);
            });
          }
        } catch (err) {
          console.error("[PORTRAIT] Trigger check error:", err);
        }
      } catch (error) {
        console.error("[chat] Streaming error:", error);
        if (fullResponse) {
          await supabase.from("messages").insert({
            chat_id: currentChatId,
            role: "assistant",
            content: fullResponse,
            tokens_used: 0,
          });
        }
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: "Ошибка при генерации ответа" })}\n\n`
          )
        );
      }

      controller.close();
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
