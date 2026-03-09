import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { google } from "@/lib/ai";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { updatePortrait } from "@/app/api/portrait/update/route";
import { parseAIResponse } from "@/lib/issp-parser";
import { calculateISSP, formatISSPScoresMessage } from "@/lib/issp-scoring";
import { ISSP_QUESTIONS } from "@/lib/issp-config";
import type { TestAnswer } from "@/lib/issp-scoring";

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

  // 2. Parse body — useChat отправляет { messages: UIMessage[], ...body }
  const body = await request.json();
  const { messages: clientMessages, chatId, programId, exerciseId, chatType } =
    body;

  // Извлекаем текст последнего user-сообщения из UIMessage parts
  const lastClientMsg = clientMessages?.[clientMessages.length - 1];
  const message =
    lastClientMsg?.parts
      ?.filter((p: { type: string }) => p.type === "text")
      ?.map((p: { text: string }) => p.text)
      ?.join("") || lastClientMsg?.content;

  if (!message || !programId) {
    return Response.json(
      { error: "Не указано сообщение или программа" },
      { status: 400 }
    );
  }

  if (typeof message !== "string" || message.length > 10000) {
    return Response.json(
      { error: "Сообщение слишком длинное" },
      { status: 400 }
    );
  }

  // 3. Get or create user record + check balance
  let { data: userData } = await supabase
    .from("profiles")
    .select("balance_tokens")
    .eq("id", user.id)
    .maybeSingle();

  if (!userData) {
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
  let exercise: {
    id: string;
    system_prompt: string;
    title: string;
    welcome_message: string | null;
  } | null = null;
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
  let currentChatType = isTestMode
    ? "test"
    : exerciseId
      ? "exercise"
      : "free";

  if (!currentChatId) {
    // Multi-chat: всегда создаём новый чат, не ищем существующий
    {
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

      if (!isTestMode) {
        const welcomeText =
          exercise?.welcome_message || program.free_chat_welcome;
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
    const { data: chatData } = await supabase
      .from("chats")
      .select("chat_type")
      .eq("id", currentChatId)
      .single();
    if (chatData?.chat_type) {
      currentChatType = chatData.chat_type;
    }
  }

  // 7.5. Load test_state for test mode (to detect 35th answer)
  type TestState = {
    current_question: number;
    status: string;
    started_at: string;
    answers: TestAnswer[];
  };
  let testState: TestState | null = null;

  if (currentChatType === "test" && currentChatId) {
    const svc = createServiceClient();
    const { data: chatRow } = await svc
      .from("chats")
      .select("test_state")
      .eq("id", currentChatId)
      .single();
    if (chatRow?.test_state) {
      testState = chatRow.test_state as TestState;
    }
  }

  // current_question начинается с 0, инкрементируется после каждого подтверждённого ответа.
  // Когда current_question === 34 → собрано 34 ответа, текущий будет 35-м.
  const isPotentiallyFinalAnswer =
    testState !== null &&
    testState.current_question >= 34 &&
    testState.status === "in_progress";

  // 8. Load message history from DB
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

  // 10. Build messages for AI SDK
  // Фильтруем leading assistant messages (Gemini требует начинать с user)
  const allDbMessages = (dbMessages || []).map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));
  const firstUserIdx = allDbMessages.findIndex((m) => m.role === "user");
  const historyMessages =
    firstUserIdx >= 0 ? allDbMessages.slice(firstUserIdx) : [];

  // Добавляем текущее сообщение
  const aiMessages = [
    ...historyMessages,
    { role: "user" as const, content: message },
  ];

  // 11. Save user message BEFORE streaming
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

  // 12. Stream with Vercel AI SDK
  //
  // Для 35-го ответа теста: двухфазный стриминг
  // (сервер считает баллы → Gemini только интерпретирует)
  //
  if (isPotentiallyFinalAnswer && testState) {
    return handleFinalTestAnswer({
      systemPrompt,
      aiMessages,
      currentChatId: currentChatId!,
      message,
      user,
      programId,
      supabase,
      testState,
    });
  }

  //
  // Обычный поток для всех остальных случаев
  //
  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt || undefined,
    messages: aiMessages,
    onFinish: async ({ text, usage }) => {
      const tokensUsed = usage.totalTokens || 0;

      // Save AI message (критичная операция — await)
      await supabase.from("messages").insert({
        chat_id: currentChatId,
        role: "assistant",
        content: text,
        tokens_used: tokensUsed,
      });

      // Update chat metadata: last_message_at + auto-title
      const chatUpdate: Record<string, unknown> = {
        last_message_at: new Date().toISOString(),
      };
      if (isNewChat) {
        chatUpdate.title = message.slice(0, 50);
      }
      await supabase
        .from("chats")
        .update(chatUpdate)
        .eq("id", currentChatId);

      // Deduct tokens atomically via RPC (prevents race conditions)
      if (tokensUsed > 0) {
        const { data: deducted } = await supabase.rpc("deduct_tokens", {
          p_user_id: user.id,
          p_amount: tokensUsed,
        });
        if (!deducted) {
          console.warn("[chat] Failed to deduct tokens — insufficient balance, user:", user.id);
        }
      }

      // ISSP test parsing (fire-and-forget)
      if (currentChatType === "test") {
        const isspPromise = (async () => {
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

            const parsed = parseAIResponse(text, message);
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

              if (testState.answers.length >= 35) {
                testState.status = "completed";
                const isspResult = calculateISSP(testState.answers);

                await svc.from("test_results").insert({
                  user_id: user.id,
                  program_id: programId,
                  chat_id: currentChatId,
                  total_score: isspResult.totalScore,
                  total_raw: isspResult.totalRaw,
                  scores_by_scale: isspResult.scoresByScale,
                  answers: testState.answers,
                  recommended_exercises: isspResult.recommendedExercises,
                  top_scales: isspResult.topScales,
                });

                await svc
                  .from("chats")
                  .update({ test_state: testState, status: "completed" })
                  .eq("id", currentChatId);

                console.log(
                  "[ISSP] Test completed for user:",
                  user.id
                );
              } else {
                await svc
                  .from("chats")
                  .update({ test_state: testState })
                  .eq("id", currentChatId);
              }
            }
          }
        })();
        isspPromise.catch((err) => {
          console.error("[ISSP] Test state update error:", err);
        });
      }

      // Portrait auto-update (fire-and-forget)
      if (currentChatType !== "test") {
        const portraitPromise = (async () => {
          const svc = createServiceClient();
          const { count: userMsgCount } = await svc
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("chat_id", currentChatId)
            .eq("role", "user");

          if (userMsgCount && userMsgCount > 0 && userMsgCount % 5 === 0) {
            console.log(
              "[PORTRAIT] Triggering update for chat:",
              currentChatId
            );
            await updatePortrait(currentChatId, "message_count");
          }
        })();
        portraitPromise.catch((err) => {
          console.error("[PORTRAIT] Background update failed:", err);
        });
      }
    },
  });

  // 13. Return stream response with metadata
  return result.toUIMessageStreamResponse({
    messageMetadata: () => {
      return { chatId: currentChatId };
    },
  });
}

// ──────────────────────────────────────────────────────────────
// Двухфазный стриминг для финального (35-го) ответа теста ИССП
// Фаза 1: Gemini подтверждает ответ
// Фаза 2: сервер считает баллы → Gemini интерпретирует готовые числа
// ──────────────────────────────────────────────────────────────

async function handleFinalTestAnswer({
  systemPrompt,
  aiMessages,
  currentChatId,
  message,
  user,
  programId,
  supabase,
  testState,
}: {
  systemPrompt: string;
  aiMessages: { role: "user" | "assistant"; content: string }[];
  currentChatId: string;
  message: string;
  user: { id: string; email?: string };
  programId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
  testState: {
    current_question: number;
    status: string;
    started_at: string;
    answers: TestAnswer[];
  };
}): Promise<Response> {
  console.log(
    "[ISSP] handleFinalTestAnswer: current_question =",
    testState.current_question,
    "answers.length =",
    testState.answers.length
  );

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Отправляем start с chatId в metadata
      writer.write({
        type: "start",
        messageMetadata: { chatId: currentChatId },
      } as Parameters<typeof writer.write>[0]);

      // ── Фаза 1: Gemini подтверждает ответ ──
      const result1 = streamText({
        model: google("gemini-2.5-flash"),
        system: systemPrompt || undefined,
        messages: aiMessages,
      });

      writer.merge(
        result1.toUIMessageStream({
          sendStart: false,
          sendFinish: false,
        })
      );

      const phase1Text = await result1.text;
      const phase1Usage = await result1.usage;

      // Парсим подтверждение
      const parsed = parseAIResponse(phase1Text, message);

      if (!parsed.isConfirmation || parsed.scores.length === 0) {
        // Gemini не подтвердил (запросил уточнение) — завершаем стрим одной фазой
        console.log("[ISSP] Phase 1: not confirmed, skipping phase 2");

        await supabase.from("messages").insert({
          chat_id: currentChatId,
          role: "assistant",
          content: phase1Text,
          tokens_used: phase1Usage.totalTokens || 0,
        });

        await supabase
          .from("chats")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", currentChatId);

        if ((phase1Usage.totalTokens ?? 0) > 0) {
          await supabase.rpc("deduct_tokens", {
            p_user_id: user.id,
            p_amount: phase1Usage.totalTokens ?? 0,
          });
        }

        writer.write({
          type: "finish",
          finishReason: "stop",
        } as Parameters<typeof writer.write>[0]);
        return;
      }

      // ── Обновляем test_state с новым ответом ──
      for (const score of parsed.scores) {
        if (testState.current_question >= ISSP_QUESTIONS.length) break;
        const question = ISSP_QUESTIONS[testState.current_question];
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

      if (testState.answers.length < 35) {
        // Ещё не 35 — сохраняем прогресс, завершаем одной фазой
        console.warn(
          "[ISSP] Expected 35 answers but got",
          testState.answers.length
        );

        const svc = createServiceClient();
        await svc
          .from("chats")
          .update({ test_state: testState })
          .eq("id", currentChatId);

        await supabase.from("messages").insert({
          chat_id: currentChatId,
          role: "assistant",
          content: phase1Text,
          tokens_used: phase1Usage.totalTokens || 0,
        });

        await supabase
          .from("chats")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", currentChatId);

        if ((phase1Usage.totalTokens ?? 0) > 0) {
          await supabase.rpc("deduct_tokens", {
            p_user_id: user.id,
            p_amount: phase1Usage.totalTokens ?? 0,
          });
        }

        writer.write({
          type: "finish",
          finishReason: "stop",
        } as Parameters<typeof writer.write>[0]);
        return;
      }

      // ── Подсчёт баллов сервером ──
      testState.status = "completed";
      const isspResult = calculateISSP(testState.answers);

      console.log(
        "[ISSP] Scores calculated: totalScore =",
        isspResult.totalScore,
        "topScales =",
        isspResult.topScales
      );

      // Сохраняем результаты в БД
      const svc = createServiceClient();
      await svc.from("test_results").insert({
        user_id: user.id,
        program_id: programId,
        chat_id: currentChatId,
        total_score: isspResult.totalScore,
        total_raw: isspResult.totalRaw,
        scores_by_scale: isspResult.scoresByScale,
        answers: testState.answers,
        recommended_exercises: isspResult.recommendedExercises,
        top_scales: isspResult.topScales,
      });

      await svc
        .from("chats")
        .update({ test_state: testState, status: "completed" })
        .eq("id", currentChatId);

      // ── Фаза 2: Gemini интерпретирует готовые числа ──
      const scoresMessage = formatISSPScoresMessage(isspResult);

      const phase2Messages = [
        ...aiMessages,
        { role: "assistant" as const, content: phase1Text },
        { role: "user" as const, content: scoresMessage },
      ];

      const result2 = streamText({
        model: google("gemini-2.5-flash"),
        system: systemPrompt || undefined,
        messages: phase2Messages,
      });

      writer.merge(
        result2.toUIMessageStream({
          sendStart: false,
          sendFinish: false,
        })
      );

      const phase2Text = await result2.text;
      const phase2Usage = await result2.usage;

      // Сохраняем комбинированное сообщение (подтверждение + интерпретация)
      const combinedText = phase1Text + "\n\n" + phase2Text;
      await supabase.from("messages").insert({
        chat_id: currentChatId,
        role: "assistant",
        content: combinedText,
        tokens_used:
          (phase1Usage.totalTokens || 0) + (phase2Usage.totalTokens || 0),
      });

      await supabase
        .from("chats")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", currentChatId);

      // Списываем токены за обе фазы
      const totalTokens =
        (phase1Usage.totalTokens || 0) + (phase2Usage.totalTokens || 0);
      if (totalTokens > 0) {
        const { data: deducted } = await supabase.rpc("deduct_tokens", {
          p_user_id: user.id,
          p_amount: totalTokens,
        });
        if (!deducted) {
          console.warn(
            "[chat] Failed to deduct tokens — insufficient balance, user:",
            user.id
          );
        }
      }

      writer.write({
        type: "finish",
        finishReason: "stop",
      } as Parameters<typeof writer.write>[0]);

      console.log(
        "[ISSP] Two-phase streaming completed. Total tokens:",
        totalTokens
      );
    },
    onError: (error) => {
      console.error("[ISSP] handleFinalTestAnswer error:", error);
      return String(error);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
